//! Documentation search entry extraction for the global `Ctrl + K` index.

use std::fs;
use std::io::Read;


use crate::pack::get_packs_dir;
use crate::server::AppState;

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
pub(crate) fn get_extra_search_entries(state: tauri::State<'_, AppState>) -> Vec<serde_json::Value> {
    let mut all = Vec::new();
    let mut covered_sites = std::collections::HashSet::new();
    let packs_dir = get_packs_dir();
    if let Ok(entries) = fs::read_dir(&packs_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path
                .file_name()
                .and_then(|n| n.to_str())
                .map(|s| s.ends_with(".search.json"))
                .unwrap_or(false)
            {
                if let Ok(bytes) = fs::read(&path) {
                    if let Ok(items) = serde_json::from_slice::<Vec<serde_json::Value>>(&bytes) {
                        for item in &items {
                            if let Some(site) = item.get("site").and_then(|v| v.as_str()) {
                                covered_sites.insert(site.to_string());
                            }
                        }
                        all.extend(items);
                    }
                }
            }
        }
    }

    // Fallback: synthesize deep search entries from HTML chunks for any installed override pack without a .search.json file on disk
    let guard = state.store.overrides.read().unwrap();
    for (site_id, pack) in guard.iter() {
        if covered_sites.contains(site_id) {
            continue;
        }
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
            if let Some(entry) = pack.manifest.routes.get(route) {
                if let Some(raw) = pack.read_chunk(entry.offset, entry.length) {
                    let html = if entry.gzipped {
                        let mut dec = flate2::read::GzDecoder::new(&raw[..]);
                        let mut s = String::new();
                        let _ = dec.read_to_string(&mut s);
                        s
                    } else {
                        String::from_utf8_lossy(&raw).into_owned()
                    };
                    if let Some(ts) = html.find("<title") {
                        if let Some(gt) = html[ts..].find('>') {
                            let start = ts + gt + 1;
                            if let Some(te) = html[start..].find("</title>") {
                                let t_clean = html[start..start + te].trim();
                                if !t_clean.is_empty() {
                                    title = t_clean.to_string();
                                }
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
            }
            let item = serde_json::json!({
                "title": title,
                "category": category,
                "path": route,
                "site": site_id,
                "headings": headings,
                "keywords": keywords,
                "preview": format!("{} — {} offline documentation ({})", title, pack.manifest.name, route),
            });
            site_entries.push(item.clone());
            all.push(item);
        }
        if !site_entries.is_empty() {
            if let Ok(json_bytes) = serde_json::to_vec(&site_entries) {
                let _ = fs::write(packs_dir.join(format!("{}.search.json", site_id)), json_bytes);
            }
        }
    }

    all
}

