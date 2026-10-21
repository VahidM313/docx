//! Documentation search entry extraction for the global `Ctrl + K` index.
//!
//! The command is intentionally **site-scoped**: the frontend loads one pack's
//! deep index when it is needed. Returning every installed pack's entries for
//! every site multiplied the in-memory index by the number of installed packs.

use std::fs;

use crate::pack::get_packs_dir;
use crate::server::AppState;

fn normalize_site_id(id: &str) -> &str {
    match id {
        "tw" => "tailwind",
        "sh" => "shadcn",
        "css" => "mdn_css",
        "html" => "mdn_html",
        "js" => "mdn_js",
        "wasm" => "mdn_wasm",
        other => other,
    }
}

fn humanize_route_title(route: &str, site_name: &str) -> (String, String) {
    let clean = route.trim_matches('/');
    if clean.is_empty() || clean == "index.html" || clean == "docs" || clean == "docs.html" {
        return (format!("{} Documentation Home", site_name), format!("{} Docs", site_name));
    }
    let parts: Vec<&str> = clean
        .split('/')
        .filter(|s| !s.is_empty() && *s != "docs" && *s != "en" && *s != "latest" && *s != "html")
        .collect();
    let last = parts.last().copied().unwrap_or(clean);
    let stem = last
        .trim_end_matches(".html")
        .trim_end_matches(".htm")
        .replace(['-', '_'], " ");
    let title = stem
        .split_whitespace()
        .map(|w| {
            let mut chars = w.chars();
            match chars.next() {
                None => String::new(),
                Some(f) => f.to_uppercase().collect::<String>() + chars.as_str(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ");
    let category = if parts.len() >= 2 {
        let cat_raw = parts[parts.len() - 2].replace(['-', '_'], " ");
        format!("{} • {}", site_name, cat_raw)
    } else {
        format!("{} Docs", site_name)
    };
    (
        if title.is_empty() {
            format!("{} — {}", site_name, route)
        } else {
            title
        },
        category,
    )
}

#[tauri::command]
pub(crate) fn get_extra_search_entries(
    site_id: String,
    state: tauri::State<'_, AppState>,
) -> Vec<serde_json::Value> {
    let site = normalize_site_id(&site_id).to_string();
    let packs_dir = get_packs_dir();
    let index_path = packs_dir.join(format!("{}.search.json", site));

    // Fast path: the crawler already produced a per-site deep index.
    if let Ok(bytes) = fs::read(&index_path)
        && let Ok(items) = serde_json::from_slice::<Vec<serde_json::Value>>(&bytes) {
            return items;
        }

    // Fallback: synthesize titles/headings from this one pack's HTML chunks.
    let pack = state
        .store
        .overrides
        .read()
        .ok()
        .and_then(|guard| guard.get(&site).cloned());
    let Some(pack) = pack else {
        return Vec::new();
    };

    let mut routes: Vec<&String> = pack
        .manifest
        .routes
        .iter()
        .filter(|(r, e)| {
            e.mime.contains("text/html")
                && !r.contains("_static/")
                && !r.contains("_assets/")
                && !r.ends_with(".js")
                && !r.ends_with(".css")
        })
        .map(|(r, _)| r)
        .collect();
    routes.sort();

    let mut site_entries = Vec::new();
    for route in routes {
        let (mut title, category) = humanize_route_title(route, &pack.manifest.name);
        let mut headings: Vec<String> = Vec::new();
        let mut keywords: Vec<String> = Vec::new();
        if let Some(entry) = pack.manifest.routes.get(route)
            && let Some(raw) = pack.read_chunk(entry.offset, entry.length) {
                let html = crate::server::decompress_html_body_if_needed(
                    &raw,
                    entry.encoding.as_deref(),
                    entry.gzipped,
                );
                if let Some(ts) = html.find("<title")
                    && let Some(gt) = html[ts..].find('>') {
                        let start = ts + gt + 1;
                        if let Some(te) = html[start..].find("</title>") {
                            let t_clean = html[start..start + te].trim();
                            if !t_clean.is_empty() {
                                title = t_clean.to_string();
                            }
                        }
                    }
                for tag in ["<code", "<tt", "<h1", "<h2", "<h3"] {
                    let mut pos = 0;
                    while let Some(idx) = html[pos..].find(tag) {
                        let abs = pos + idx;
                        pos = abs + tag.len();
                        if let Some(gt) = html[pos..].find('>') {
                            let c_start = pos + gt + 1;
                            if let Some(lt) = html[c_start..].find('<') {
                                let token = html[c_start..c_start + lt].trim();
                                if token.len() >= 2 && token.len() <= 48 {
                                    if tag.starts_with("<h") {
                                        if headings.len() < 20 {
                                            headings.push(token.to_string());
                                        }
                                    } else if keywords.len() < 60 {
                                        keywords.push(token.to_lowercase());
                                    }
                                }
                            }
                        }
                        if headings.len() >= 20 && keywords.len() >= 60 {
                            break;
                        }
                    }
                }
            }
        let item = serde_json::json!({
            "title": title,
            "category": category,
            "path": route,
            "site": site,
            "headings": headings,
            "keywords": keywords,
            "preview": format!("{} — {} offline documentation ({})", title, pack.manifest.name, route),
        });
        site_entries.push(item);
    }

    if !site_entries.is_empty()
        && let Ok(json_bytes) = serde_json::to_vec(&site_entries) {
            let _ = fs::write(&index_path, json_bytes);
        }

    site_entries
}
