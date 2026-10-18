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
use crate::pack::{ASSETS_PACK, AssetStore};
use crate::util::{curl_get_bytes, guess_mime_from_path, url_decode};

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


fn fetch_live_fallback(
    site_key: &str,
    raw_target: &str,
    decoded_path: &str,
    store: &AssetStore,
) -> Option<(String, bool, Vec<u8>)> {
    let cache_key = format!("{}:{}", site_key, raw_target);
    if let Ok(guard) = store.fallback_cache.read()
        && let Some((mime, bytes)) = guard.get(&cache_key) {
            return Some((mime.clone(), false, bytes.clone()));
        }

    let (origin, entry_path) = get_site_origin_and_entry(site_key)?;
    let target_url = if decoded_path == "/" || decoded_path == "/docs" {
        format!("{}{}", origin, entry_path)
    } else {
        format!("{}{}", origin, raw_target)
    };

    let mut bytes = curl_get_bytes(&target_url, None).ok()?;
    if bytes.is_empty() {
        return None;
    }

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

    if let Ok(mut guard) = store.fallback_cache.write() {
        guard.insert(cache_key, (mime.clone(), bytes.clone()));
    }

    Some((mime, false, bytes))
}

fn resolve_from_store(
    site_key: &str,
    decoded_path: &str,
    store: &AssetStore,
) -> Option<(String, bool, Vec<u8>)> {
    let (site_id, base_prefix) = match site_key {
        "tw" | "tailwind" => ("tailwind", "tw"),
        "sh" | "shadcn" => ("shadcn", "sh"),
        "css" => ("mdn_css", "css"),
        "html" => ("mdn_html", "html"),
        "js" => ("mdn_js", "js"),
        "wasm" => ("mdn_wasm", "wasm"),
        other => (other, other),
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

    if site_id == "pytorch" && (decoded_path == "/" || decoded_path == "/docs" || decoded_path == "/docs/stable" || decoded_path == "/docs/stable/" || decoded_path == "/docs/stable/index.html") {
        candidates.insert(0, "/docs/stable/index.html".to_string());
        candidates.insert(0, "/docs/stable/".to_string());
    }

    if site_id == "lucide"
        && (decoded_path == "/assets/docx-lucide-bundle.js"
            || decoded_path == "/docx-lucide-bundle.js")
    {
        static LUCIDE_BUNDLE: &str = include_str!("lucide_bundle.js");
        return Some((
            "application/javascript; charset=utf-8".to_string(),
            false,
            LUCIDE_BUNDLE.as_bytes().to_vec(),
        ));
    }

    if let Ok(guard) = store.overrides.read()
        && let Some(pack) = guard.get(site_id) {
            let mut entry_opt = None;
            for c in &candidates {
                if let Some(found) = pack.manifest.routes.get(c) {
                    entry_opt = Some(found);
                    break;
                }
            }
            if entry_opt.is_none() && site_id == "shadcn" && decoded_path.starts_with("/docs/components/") {
                let slug = decoded_path.trim_start_matches("/docs/components/");
                let radix_key = format!("/docs/components/radix/{}", slug);
                entry_opt = pack.manifest.routes.get(&radix_key);
            }
            // Suffix fallback for relative sub-assets (e.g. /_static/classic.css -> /cmake/help/latest/_static/classic.css)
            if entry_opt.is_none() && decoded_path.len() > 2 && decoded_path.contains('.') {
                for (route_k, route_v) in &pack.manifest.routes {
                    if route_k.ends_with(decoded_path) {
                        entry_opt = Some(route_v);
                        break;
                    }
                }
            }
            if let Some(entry) = entry_opt
                && let Some(chunk_bytes) = pack.read_chunk(entry.offset, entry.length) {
                    return Some((entry.mime.clone(), entry.gzipped, chunk_bytes));
                }
        }

    let lookup_key = format!("{}:{}", base_prefix, decoded_path);
    let entry_opt = store.base_manifest.get(&lookup_key).or_else(|| {
        if base_prefix == "sh" && decoded_path.starts_with("/docs/components/") {
            let slug = decoded_path.trim_start_matches("/docs/components/");
            let radix_key = format!("sh:/docs/components/radix/{}", slug);
            store.base_manifest.get(&radix_key)
        } else {
            None
        }
    });

    if let Some(entry) = entry_opt {
        let start = store.base_data_start + entry.offset;
        let end = start + entry.length;
        return Some((
            entry.mime.clone(),
            entry.gzipped,
            ASSETS_PACK[start..end].to_vec(),
        ));
    }

    None
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

    if let Some((mime, mut gzipped, mut body)) = resolved {
        let is_html = mime.starts_with("text/html");
        if is_html {
            if gzipped {
                let mut decoder = flate2::read::GzDecoder::new(&body[..]);
                let mut decompressed = String::new();
                if decoder.read_to_string(&mut decompressed).is_ok() {
                    body = inject_reader_bridge(&site_key, decompressed);
                    gzipped = false;
                }
            } else {
                let html = String::from_utf8_lossy(&body).into_owned();
                body = inject_reader_bridge(&site_key, html);
            }
        }

        let encoding_header = if gzipped {
            "Content-Encoding: gzip\r\n"
        } else {
            ""
        };

        let cache_header = if is_html {
            "Cache-Control: no-cache"
        } else {
            "Cache-Control: public, max-age=86400, immutable"
        };

        let header = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: {}\r\n{}Content-Length: {}\r\n{}\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n",
            mime,
            encoding_header,
            body.len(),
            cache_header
        );

        let _ = stream.write_all(header.as_bytes());
        if method != "HEAD" {
            let _ = stream.write_all(&body);
        }
        let _ = stream.flush();
    } else {
        let _ = stream.write_all(
            b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",
        );
    }
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

