//! Embedded per-site HTTP server: request parsing, route resolution through the
//! `AssetStore`, live fallback proxying, and the reader-bridge injection hook.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Arc;
use std::thread;
use std::time::Duration;


use crate::bridge::inject_reader_bridge;
use crate::catalog::get_site_origin_and_entry;
use crate::pack::{AssetStore, RouteData};
use crate::util::{get_interactive, guess_mime_from_path, url_decode};

pub struct AppState {
    pub tailwind_port: u16,
    pub shadcn_port: u16,
    pub store: Arc<AssetStore>,
}

#[derive(serde::Serialize, Clone)]
pub struct ServerStatus {
    pub tailwind: bool,
    pub shadcn: bool,
    pub tailwind_port: u16,
    pub shadcn_port: u16,
    pub site_ports: HashMap<String, u16>,
}


pub fn decompress_html_body_if_needed(
    body: &[u8],
    encoding: Option<&str>,
    gzipped: bool,
) -> String {
    if encoding == Some("br") {
        let mut decompressor = brotli::Decompressor::new(body, 4096);
        let mut out_bytes = Vec::new();
        if decompressor.read_to_end(&mut out_bytes).is_ok() {
            return String::from_utf8_lossy(&out_bytes).into_owned();
        }
    } else if gzipped {
        let mut decoder = flate2::read::GzDecoder::new(body);
        let mut out_bytes = Vec::new();
        if decoder.read_to_end(&mut out_bytes).is_ok() {
            return String::from_utf8_lossy(&out_bytes).into_owned();
        }
    }
    String::from_utf8_lossy(body).into_owned()
}

fn fetch_live_fallback(
    site_key: &str,
    raw_target: &str,
    decoded_path: &str,
    store: &AssetStore,
) -> Option<RouteData> {
    let cache_key = format!("{}:{}", site_key, raw_target);
    if let Some((mime, bytes)) = store.fallback_cache.get(&cache_key) {
        return Some(live_route(mime, bytes));
    }
    if store.fallback_cache.recently_missed(&cache_key) {
        return None;
    }

    let (origin, entry_path) = get_site_origin_and_entry(site_key)?;
    let target_url = if site_key == "react" && (decoded_path == "/fa" || decoded_path.starts_with("/fa/")) {
        let subpath = if decoded_path == "/fa" || decoded_path == "/fa/" {
            "/learn".to_string()
        } else {
            raw_target.replacen("/fa", "", 1)
        };
        format!("https://fa.react.dev{}", subpath)
    } else if site_key == "vue" && (decoded_path == "/fa" || decoded_path.starts_with("/fa/")) {
        let subpath = if decoded_path == "/fa" || decoded_path == "/fa/" {
            "/guide/introduction.html".to_string()
        } else {
            raw_target.replacen("/fa", "", 1)
        };
        format!("https://fa.vuejs.org{}", subpath)
    } else if site_key == "kubernetes" && (decoded_path == "/fa" || decoded_path == "/fa/") {
        "https://kubernetes.io/fa/docs/home/".to_string()
    } else if site_key == "gin" && (decoded_path == "/fa" || decoded_path == "/fa/") {
        "https://gin-gonic.com/fa/docs/".to_string()
    } else if site_key == "python" && (decoded_path == "/fa" || decoded_path == "/fa/") {
        "https://docs.python.org/fa/3.13/".to_string()
    } else if site_key == "flask" && (decoded_path == "/fa" || decoded_path == "/fa/") {
        "https://flask.palletsprojects.com/fa/".to_string()
    } else if site_key == "git" && (decoded_path == "/fa" || decoded_path == "/fa/") {
        "https://git-scm.com/book/fa/v2".to_string()
    } else if decoded_path == "/" || decoded_path == "/docs" {
        format!("{}{}", origin, entry_path)
    } else {
        format!("{}{}", origin, raw_target)
    };

    let fetched = get_interactive(&target_url).ok().filter(|b| !b.is_empty()).or_else(|| {
        let alt = match site_key {
            "react" => format!("https://fa.react.dev{}", raw_target),
            "vue" => format!("https://fa.vuejs.org{}", raw_target),
            _ => return None,
        };
        get_interactive(&alt).ok()
    });
    let Some(mut bytes) = fetched else {
        store.fallback_cache.note_miss(cache_key);
        return None;
    };

    let mime = if bytes.starts_with(b"<!DOCTYPE")
        || bytes.starts_with(b"<!doctype")
        || bytes.starts_with(b"<html")
        || bytes.windows(6).take(256).any(|w| w.eq_ignore_ascii_case(b"<head>"))
    {
        "text/html; charset=utf-8".to_string()
    } else {
        guess_mime_from_path(raw_target).to_string()
    };

    if mime.starts_with("text/html") {
        let html = String::from_utf8_lossy(&bytes).into_owned();
        bytes = inject_reader_bridge(site_key, html);
    }

    store
        .fallback_cache
        .insert(cache_key, mime.clone(), bytes.clone());

    Some(live_route(mime, bytes))
}

fn live_route(mime: String, bytes: Vec<u8>) -> RouteData {
    RouteData { mime, gzipped: false, encoding: None, bytes, tag: String::new() }
}

fn resolve_from_store(
    site_key: &str,
    decoded_path: &str,
    store: &AssetStore,
) -> Option<RouteData> {
    let site_id = match site_key {
        "tw" | "tailwind" => "tailwind",
        "sh" | "shadcn" => "shadcn",
        "css" => "mdn_css",
        "html" => "mdn_html",
        "js" => "mdn_js",
        "wasm" => "mdn_wasm",
        other => other,
    };

    let mut candidates = vec![
        decoded_path.to_string(),
        format!("{}.html", decoded_path),
        format!("{}/index.html", decoded_path),
        decoded_path.trim_end_matches(".html").to_string(),
    ];

    if (decoded_path == "/" || decoded_path == "/docs")
        && let Some((_, entry_path)) = get_site_origin_and_entry(site_id) {
            let trimmed = entry_path.trim_end_matches('/');
            if !trimmed.is_empty() {
                candidates.push(entry_path.to_string());
                candidates.push(trimmed.to_string());
                candidates.push(format!("{}/index.html", trimmed));
            }
            candidates.push("/".to_string());
            candidates.push("/index.html".to_string());
        }

    if site_id == "qt" && decoded_path.starts_with("/qt/") {
        let qt6 = decoded_path.replacen("/qt/", "/qt-6/", 1);
        candidates.insert(0, format!("{}.html", qt6));
        candidates.insert(0, qt6);
    }
    if site_id == "qt" && !decoded_path.starts_with("/qt-6/") {
        let trimmed_qt = decoded_path.trim_start_matches('/');
        candidates.push(format!("/qt-6/{}", trimmed_qt));
        candidates.push(format!("/qt-6/{}.html", trimmed_qt));
    }

    if site_id == "boost" && !decoded_path.starts_with("/doc/libs/latest") {
        candidates.insert(0, format!("/doc/libs/latest{}/index.html", decoded_path));
        candidates.insert(0, format!("/doc/libs/latest{}", decoded_path));
    }

    if site_id == "langchain" && (decoded_path == "/" || decoded_path == "/docs" || decoded_path == "/docs/" || decoded_path == "/docs/introduction" || decoded_path == "/docs/introduction/") {
        candidates.insert(0, "/oss/python/langchain/overview".to_string());
        candidates.insert(0, "/oss/python/langchain/overview.html".to_string());
    }

    if site_id == "keras" && (decoded_path == "/" || decoded_path == "/docs" || decoded_path == "/guides") {
        candidates.insert(0, "/guides/".to_string());
        candidates.insert(0, "/guides/index.html".to_string());
        candidates.insert(0, "/guides".to_string());
    }

    if site_id == "ollama" && (decoded_path == "/" || decoded_path == "/docs" || decoded_path == "/library") {
        candidates.insert(0, "/".to_string());
        candidates.insert(0, "/index.html".to_string());
        candidates.push("/library".to_string());
        candidates.push("/library/index.html".to_string());
        candidates.push("/library/".to_string());
    }

    if site_id == "gin" && (decoded_path == "/" || decoded_path == "/docs" || decoded_path == "/docs/") {
        candidates.insert(0, "/en/docs/".to_string());
        candidates.insert(0, "/en/docs/index.html".to_string());
        candidates.insert(0, "/en/docs".to_string());
    }
    if site_id == "gin" && (decoded_path == "/fa" || decoded_path == "/fa/") {
        candidates.insert(0, "/fa/docs/".to_string());
        candidates.insert(0, "/fa/docs/index.html".to_string());
        candidates.insert(0, "/fa/docs".to_string());
    }
    if site_id == "kubernetes" && (decoded_path == "/fa" || decoded_path == "/fa/") {
        candidates.insert(0, "/fa/docs/home/".to_string());
        candidates.insert(0, "/fa/docs/home/index.html".to_string());
        candidates.insert(0, "/fa/docs/home".to_string());
    }
    if site_id == "react" && (decoded_path == "/fa" || decoded_path == "/fa/") {
        candidates.insert(0, "/fa/learn".to_string());
        candidates.insert(0, "/fa/learn/index.html".to_string());
    }
    if site_id == "vue" && (decoded_path == "/fa" || decoded_path == "/fa/") {
        candidates.insert(0, "/fa/guide/introduction.html".to_string());
    }
    if site_id == "python" && (decoded_path == "/fa" || decoded_path == "/fa/") {
        candidates.insert(0, "/fa/3.13/".to_string());
        candidates.insert(0, "/fa/3.13/index.html".to_string());
    }
    if site_id == "flask" && (decoded_path == "/fa" || decoded_path == "/fa/") {
        candidates.insert(0, "/fa/".to_string());
        candidates.insert(0, "/fa/index.html".to_string());
    }
    if site_id == "git" && (decoded_path == "/fa" || decoded_path == "/fa/") {
        candidates.insert(0, "/book/fa/v2".to_string());
        candidates.insert(0, "/book/fa/v2/index.html".to_string());
    }

    if site_id == "pytorch" && (decoded_path == "/" || decoded_path == "/docs" || decoded_path == "/docs/stable" || decoded_path == "/docs/stable/" || decoded_path == "/docs/stable/index.html") {
        candidates.insert(0, "/docs/stable/index.html".to_string());
        candidates.insert(0, "/docs/stable/".to_string());
    }

    if site_id == "lucide"
        && (decoded_path == "/assets/docx-lucide-bundle.js"
            || decoded_path == "/docx-lucide-bundle.js")
    {
        static LUCIDE_BUNDLE: &str = include_str!("lucide_bundle.js");
        return Some(live_route(
            "application/javascript; charset=utf-8".to_string(),
            LUCIDE_BUNDLE.as_bytes().to_vec(),
        ));
    }

    // The lock only covers the lookup: reading a route touches the disk.
    let pack = store.overrides.read().ok()?.get(site_id).cloned()?;
    let mut route = candidates.iter().find(|c| pack.contains(c)).cloned();
    if route.is_none() && site_id == "shadcn" && decoded_path.starts_with("/docs/components/") {
        let slug = decoded_path.trim_start_matches("/docs/components/");
        let radix_key = format!("/docs/components/radix/{}", slug);
        route = pack.contains(&radix_key).then_some(radix_key);
    }
    // Suffix fallback for relative sub-assets (e.g. /_static/classic.css -> /cmake/help/latest/_static/classic.css)
    if route.is_none() && decoded_path.len() > 2 && decoded_path.contains('.') {
        route = pack.route_with_suffix(decoded_path);
    }
    pack.read_route(&route?)
}

fn should_skip_live_fallback(site_key: &str, path: &str) -> bool {
    let clean = path.split('?').next().unwrap_or(path).to_ascii_lowercase();
    if clean.ends_with(".map") || clean.ends_with(".eot") || clean.contains("favicon") {
        return true;
    }
    if site_key == "motion" && clean.starts_with("/assets/") && clean.ends_with(".js") {
        return true;
    }
    false
}

fn handle_client(mut stream: TcpStream, site_key: String, store: Arc<AssetStore>) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(5)));

    let mut buf = [0u8; 4096];
    let n = match stream.read(&mut buf) {
        Ok(n) if n > 0 => n,
        _ => return,
    };

    let req = String::from_utf8_lossy(&buf[..n]);
    let first_line = match req.lines().next() {
        Some(l) => l,
        None => return,
    };

    let mut parts = first_line.split_whitespace();
    let method = parts.next().unwrap_or("GET");
    let raw_target = parts.next().unwrap_or("/");

    let path_only = raw_target.split('?').next().unwrap_or("/");
    let mut decoded_path = url_decode(path_only);
    if decoded_path.len() > 1 && decoded_path.ends_with('/') {
        decoded_path.pop();
    }

    let resolved = resolve_from_store(&site_key, &decoded_path, &store)
        .or_else(|| {
            if decoded_path == "/" || decoded_path == "/docs" {
                resolve_from_store(&site_key, "/docs", &store)
            } else if (site_key == "nestjs" || site_key == "angular") && !decoded_path.contains('.') {
                resolve_from_store(&site_key, "/docs", &store)
                    .or_else(|| resolve_from_store(&site_key, "/", &store))
            } else {
                None
            }
        })
        .or_else(|| {
            if should_skip_live_fallback(&site_key, &decoded_path) {
                None
            } else {
                fetch_live_fallback(&site_key, raw_target, &decoded_path, &store)
            }
        });

    let Some(route) = resolved else {
        let is_page = !decoded_path.rsplit('/').next().unwrap_or("").contains('.');
        if is_page && method != "HEAD" {
            let body = offline_page(&decoded_path);
            let header = format!(
                "HTTP/1.1 404 Not Found\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",
                body.len()
            );
            let _ = stream.write_all(header.as_bytes());
            let _ = stream.write_all(body.as_bytes());
        } else {
            let _ = stream.write_all(
                b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",
            );
        }
        let _ = stream.flush();
        return;
    };

    let RouteData { mime, gzipped, encoding, mut bytes, tag } = route;
    let is_html = mime.starts_with("text/html");

    // Asset names survive redeploys, so content may change under one name: the browser
    // must revalidate instead of treating them as immutable. Pages are rebuilt per
    // request because the injected bridge belongs to the app, not the pack.
    let etag = (!is_html && !tag.is_empty()).then(|| format!("\"{tag}\""));
    if let Some(etag) = &etag
        && if_none_match(&req).is_some_and(|sent| sent == etag)
    {
        let header = format!(
            "HTTP/1.1 304 Not Modified\r\nETag: {etag}\r\nCache-Control: no-cache\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n"
        );
        let _ = stream.write_all(header.as_bytes());
        let _ = stream.flush();
        return;
    }

    let mut out_gzipped = gzipped;
    let mut out_encoding = encoding;
    if is_html {
        let decompressed = decompress_html_body_if_needed(&bytes, out_encoding.as_deref(), out_gzipped);
        bytes = inject_reader_bridge(&site_key, decompressed);
        out_gzipped = false;
        out_encoding = None;
    }

    let encoding_header = if let Some(ref enc) = out_encoding {
        match enc.as_str() {
            "br" => "Content-Encoding: br\r\n",
            "gzip" => "Content-Encoding: gzip\r\n",
            _ => "",
        }
    } else if out_gzipped {
        "Content-Encoding: gzip\r\n"
    } else {
        ""
    };
    let etag_header = etag.map(|e| format!("ETag: {e}\r\n")).unwrap_or_default();

    let header = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: {}\r\n{}{}Content-Length: {}\r\nCache-Control: no-cache\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n",
        mime,
        encoding_header,
        etag_header,
        bytes.len(),
    );

    let _ = stream.write_all(header.as_bytes());
    if method != "HEAD" {
        let _ = stream.write_all(&bytes);
    }
    let _ = stream.flush();
}

fn if_none_match(request: &str) -> Option<&str> {
    request.lines().find_map(|line| {
        let (name, value) = line.split_once(':')?;
        name.eq_ignore_ascii_case("if-none-match").then(|| value.trim())
    })
}

/// Shown for a page that is neither in the pack nor reachable online.
fn offline_page(path: &str) -> String {
    let safe_path: String = path
        .chars()
        .map(|c| match c {
            '<' => "&lt;".to_string(),
            '>' => "&gt;".to_string(),
            '&' => "&amp;".to_string(),
            '"' => "&quot;".to_string(),
            c => c.to_string(),
        })
        .collect();
    format!(
        "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Not available offline</title><style>body{{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#1e1f22;color:#dbdee1;font:15px/1.5 system-ui,sans-serif;padding:24px;box-sizing:border-box}}main{{max-width:30rem}}h1{{font-size:20px;margin:0 0 8px}}p{{margin:0 0 8px;color:#b5bac1}}code{{overflow-wrap:anywhere;color:#f2f3f5}}</style></head><body><main><h1>This page isn't saved offline</h1><p><code>{safe_path}</code> is not part of this documentation pack, and it could not be loaded from the web.</p><p>Connect to the internet, or go back to keep reading.</p></main></body></html>"
    )
}


pub(crate) fn ensure_site_server(site_id: &str, store: Arc<AssetStore>) -> u16 {
    // Phase 2 will replace this with a single multiplexing server; for now the
    // per-site listener stays, but binding never panics — a bind failure is
    // logged and surfaced to callers/UI as "port 0" (server unavailable).
    if let Ok(guard) = store.site_ports.read()
        && let Some(&port) = guard.get(site_id) {
            return port;
        }
    let listener = match TcpListener::bind("127.0.0.1:0") {
        Ok(l) => l,
        Err(e) => {
            log::error!("embedded HTTP server bind failed for '{}': {}", site_id, e);
            return 0;
        }
    };
    let port = match listener.local_addr() {
        Ok(a) => a.port(),
        Err(e) => {
            log::error!(
                "embedded HTTP server local_addr failed for '{}': {}",
                site_id,
                e
            );
            return 0;
        }
    };
    let key_owned = site_id.to_string();

    if let Ok(mut guard) = store.site_ports.write() {
        guard.insert(key_owned.clone(), port);
    }

    thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            let store_ref = Arc::clone(&store);
            let k = key_owned.clone();
            thread::spawn(move || {
                handle_client(stream, k, store_ref);
            });
        }
    });

    port
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn offline_page_escapes_the_requested_path() {
        let page = offline_page("/x\"><script>alert(1)</script>&");
        assert!(!page.contains("<script>"));
        assert!(page.contains("&lt;script&gt;") && page.contains("&quot;") && page.contains("&amp;"));
    }

    #[test]
    fn test_brotli_html_and_asset_serving() {
        let raw_html = "<html><head></head><body><h1>Hello</h1></body></html>";
        let mut br_html = Vec::new();
        {
            let mut writer = brotli::CompressorWriter::new(&mut br_html, 4096, 11, 24);
            std::io::Write::write_all(&mut writer, raw_html.as_bytes()).unwrap();
        }

        let decompressed = decompress_html_body_if_needed(&br_html, Some("br"), false);
        assert!(decompressed.contains("<h1>Hello</h1>"));
    }
}

