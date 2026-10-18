use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom, Write};
use std::net::{TcpListener, TcpStream};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
#[cfg(target_os = "windows")]
use std::process::Command;
use std::sync::{Arc, RwLock};
use std::thread;
use std::time::Duration;
mod bridge;
mod catalog;

use bridge::inject_reader_bridge;
use catalog::get_site_origin_and_entry;


static ASSETS_PACK: &[u8] = b"\x02\x00\x00\x00{}";
const TRAILER_MAGIC: &[u8; 8] = b"DOCXPACK";
const RELEASE_BASE_URL: &str = "https://github.com/VahidM313/docx/releases/download/packs-latest";
const APP_BUILD_COMMIT: &str = match option_env!("DOCX_BUILD_COMMIT") {
    Some(v) => v,
    None => "local",
};

#[derive(serde::Deserialize, serde::Serialize, Clone)]
pub struct ManifestEntry {
    pub offset: usize,
    pub length: usize,
    pub mime: String,
    pub gzipped: bool,
    #[serde(default)]
    pub hash: String,
}

#[derive(serde::Deserialize, serde::Serialize, Clone)]
#[allow(non_snake_case)]
pub struct SiteManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub commit: String,
    #[serde(default)]
    pub updatedAt: String,
    #[serde(default)]
    pub totalBytes: usize,
    #[serde(default)]
    pub chunkCount: usize,
    pub routes: HashMap<String, ManifestEntry>,
}

#[derive(Clone)]
pub enum PackBacking {
    InMemory(Arc<Vec<u8>>),
    OnDisk {
        path: PathBuf,
        file_offset: u64,
        pack_len: usize,
    },
}

pub struct SiteOverridePack {
    pub manifest: SiteManifest,
    pub data_start: usize,
    pub backing: PackBacking,
    pub source: String,
}

impl SiteOverridePack {
    pub fn read_chunk(&self, offset: usize, length: usize) -> Option<Vec<u8>> {
        let rel_start = self.data_start.checked_add(offset)?;
        match &self.backing {
            PackBacking::InMemory(buf) => {
                let end = rel_start.checked_add(length)?;
                if end <= buf.len() {
                    Some(buf[rel_start..end].to_vec())
                } else {
                    None
                }
            }
            PackBacking::OnDisk {
                path,
                file_offset,
                pack_len,
            } => {
                if rel_start.checked_add(length)? > *pack_len {
                    return None;
                }
                let mut f = File::open(path).ok()?;
                f.seek(SeekFrom::Start(*file_offset + rel_start as u64)).ok()?;
                let mut out = vec![0u8; length];
                f.read_exact(&mut out).ok()?;
                Some(out)
            }
        }
    }

    pub fn read_full_pack_bytes(&self) -> Option<Vec<u8>> {
        match &self.backing {
            PackBacking::InMemory(buf) => Some((**buf).clone()),
            PackBacking::OnDisk {
                path,
                file_offset,
                pack_len,
            } => {
                let mut f = File::open(path).ok()?;
                f.seek(SeekFrom::Start(*file_offset)).ok()?;
                let mut out = vec![0u8; *pack_len];
                f.read_exact(&mut out).ok()?;
                Some(out)
            }
        }
    }
}

pub struct AssetStore {
    pub base_manifest: HashMap<String, ManifestEntry>,
    pub base_data_start: usize,
    pub overrides: RwLock<HashMap<String, Arc<SiteOverridePack>>>,
    pub site_ports: RwLock<HashMap<String, u16>>,
    pub fallback_cache: RwLock<HashMap<String, (String, Vec<u8>)>>,
}


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

#[derive(serde::Serialize, Clone)]
pub struct PackStatusInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub commit: String,
    pub route_count: usize,
    pub chunk_count: usize,
    pub size_mb: f64,
    pub source: String,
    pub port: u16,
}

#[derive(serde::Serialize, Clone)]
pub struct DeltaUpdateResult {
    pub site_id: String,
    pub old_commit: String,
    pub new_commit: String,
    pub total_chunks: usize,
    pub reused_chunks: usize,
    pub downloaded_chunks: usize,
    pub reused_bytes: usize,
    pub downloaded_bytes: usize,
    pub saved_percent: f64,
    pub port: u16,
    pub message: String,
}

fn fnv1a_hash_hex(bytes: &[u8]) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for &b in bytes {
        hash ^= b as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{:016x}", hash)
}

fn curl_get_bytes(url: &str, range: Option<(usize, usize)>) -> Result<Vec<u8>, String> {
    let client = reqwest::blocking::Client::builder()
        .user_agent("Docx/1.0")
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let mut req = client.get(url);
    if let Some((start, end)) = range {
        req = req.header("Range", format!("bytes={}-{}", start, end));
    }

    let resp = req.send().map_err(|e| format!("HTTP fetch error for {}: {}", url, e))?;
    if !resp.status().is_success() && resp.status() != reqwest::StatusCode::PARTIAL_CONTENT {
        return Err(format!("HTTP fetch failed with status {} for {}", resp.status(), url));
    }
    let bytes = resp.bytes().map_err(|e| format!("HTTP body read error for {}: {}", url, e))?;
    Ok(bytes.to_vec())
}

static CUSTOM_PACKS_DIR: std::sync::RwLock<Option<PathBuf>> = std::sync::RwLock::new(None);

pub fn set_packs_dir(dir: PathBuf) {
    let _ = fs::create_dir_all(&dir);
    if let Ok(mut lock) = CUSTOM_PACKS_DIR.write() {
        *lock = Some(dir);
    }
}

fn get_packs_dir() -> PathBuf {
    if let Ok(lock) = CUSTOM_PACKS_DIR.read() {
        if let Some(dir) = lock.as_ref() {
            let _ = fs::create_dir_all(dir);
            return dir.clone();
        }
    }
    #[cfg(target_os = "android")]
    {
        for candidate in [
            "/data/user/0/com.docx.hub/files/docx",
            "/data/data/com.docx.hub/files/docx",
            "/storage/emulated/0/Android/data/com.docx.hub/files/docx",
        ] {
            let p = PathBuf::from(candidate);
            if fs::create_dir_all(&p).is_ok() {
                return p;
            }
        }
    }
    let base = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .or_else(|| {
            std::env::var_os("USERPROFILE")
                .map(|p| PathBuf::from(p).join("AppData").join("Local"))
        })
        .or_else(|| std::env::var_os("APPDATA").map(PathBuf::from))
        .unwrap_or_else(|| std::env::temp_dir());
    let dir = base.join("docx");
    let _ = fs::create_dir_all(&dir);
    dir
}

fn migrate_legacy_packs_to_appdata() {
    #[cfg(desktop)]
    {
        let target_dir = get_packs_dir();
        let mut legacy_dirs = vec![
            PathBuf::from("d:/Dev/crawl/packs"),
            PathBuf::from("d:/Dev/docx/packs"),
            PathBuf::from("C:/Users/vahid/OneDrive/Desktop/packs"),
        ];
        if let Some(roaming) = std::env::var_os("APPDATA") {
            legacy_dirs.push(PathBuf::from(roaming).join("docx"));
        }
        if let Ok(exe) = std::env::current_exe() {
            if let Some(parent) = exe.parent() {
                legacy_dirs.push(parent.join("packs"));
            }
        }
        if let Ok(cwd) = std::env::current_dir() {
            legacy_dirs.push(cwd.join("packs"));
        }

        for legacy in legacy_dirs {
            if !legacy.exists() || legacy == target_dir {
                continue;
            }
            let legacy_str = legacy.to_string_lossy().to_lowercase();
            let is_repo_dir = legacy_str.contains("crawl") || legacy_str.contains("d:/dev/docx") || legacy_str.contains("d:\\dev\\docx");
            if let Ok(entries) = fs::read_dir(&legacy) {
                for entry in entries.flatten() {
                    let src_path = entry.path();
                    if !src_path.is_file() {
                        continue;
                    }
                    let name = match src_path.file_name().and_then(|n| n.to_str()) {
                        Some(n) => n.to_string(),
                        None => continue,
                    };
                    if name.ends_with(".docpack")
                        || name.ends_with(".manifest.json")
                        || name.ends_with(".search.json")
                        || name == "registry.json"
                        || name == "app-manifest.local.json"
                    {
                        let dst_path = target_dir.join(&name);
                        let should_copy = match (fs::metadata(&src_path), fs::metadata(&dst_path)) {
                            (Ok(src_m), Ok(dst_m)) => {
                                if name.ends_with(".docpack") {
                                    src_m.len() > 1024 && dst_m.len() <= 1024
                                } else {
                                    false
                                }
                            }
                            (Ok(src_m), Err(_)) => !name.ends_with(".docpack") || src_m.len() > 1024,
                            _ => false,
                        };
                        if should_copy {
                            if !is_repo_dir {
                                if fs::rename(&src_path, &dst_path).is_err() {
                                    let _ = fs::copy(&src_path, &dst_path);
                                }
                            } else {
                                let _ = fs::copy(&src_path, &dst_path);
                            }
                        }
                        if !is_repo_dir {
                            let _ = fs::remove_file(&src_path);
                        }
                    }
                }
            }
            if !is_repo_dir {
                let _ = fs::remove_dir(&legacy);
            }
        }
    }
}

fn parse_docpack_on_disk(
    path: PathBuf,
    file_offset: u64,
    pack_len: usize,
    source: &str,
) -> Option<Arc<SiteOverridePack>> {
    if pack_len < 8 {
        return None;
    }
    let mut file = File::open(&path).ok()?;
    file.seek(SeekFrom::Start(file_offset)).ok()?;
    let mut len_bytes = [0u8; 4];
    file.read_exact(&mut len_bytes).ok()?;
    let manifest_len = u32::from_le_bytes(len_bytes) as usize;
    if pack_len < 4 + manifest_len {
        return None;
    }
    let mut manifest_buf = vec![0u8; manifest_len];
    file.read_exact(&mut manifest_buf).ok()?;
    let manifest: SiteManifest = serde_json::from_slice(&manifest_buf).ok()?;
    if manifest.routes.is_empty() || get_site_origin_and_entry(&manifest.id).is_none() {
        return None;
    }
    let data_start = 4 + manifest_len;

    Some(Arc::new(SiteOverridePack {
        manifest,
        data_start,
        backing: PackBacking::OnDisk {
            path,
            file_offset,
            pack_len,
        },
        source: source.to_string(),
    }))
}

#[allow(dead_code)]
fn parse_docpack_bytes(buf: Vec<u8>, source: &str) -> Option<Arc<SiteOverridePack>> {
    if buf.len() < 8 {
        return None;
    }
    let len_bytes: [u8; 4] = buf[0..4].try_into().ok()?;
    let manifest_len = u32::from_le_bytes(len_bytes) as usize;
    if buf.len() < 4 + manifest_len {
        return None;
    }
    let mut manifest: SiteManifest = serde_json::from_slice(&buf[4..4 + manifest_len]).ok()?;
    if manifest.routes.is_empty() || get_site_origin_and_entry(&manifest.id).is_none() {
        return None;
    }
    let data_start = 4 + manifest_len;

    for entry in manifest.routes.values_mut() {
        if entry.hash.is_empty() && data_start + entry.offset + entry.length <= buf.len() {
            let slice = &buf[data_start + entry.offset..data_start + entry.offset + entry.length];
            entry.hash = fnv1a_hash_hex(slice);
        }
    }

    Some(Arc::new(SiteOverridePack {
        manifest,
        data_start,
        backing: PackBacking::InMemory(Arc::new(buf)),
        source: source.to_string(),
    }))
}

fn load_exe_trailer_overrides(overrides: &mut HashMap<String, Arc<SiteOverridePack>>) {
    let exe_path = match std::env::current_exe() {
        Ok(p) => p,
        Err(_) => return,
    };
    let mut file = match File::open(&exe_path) {
        Ok(f) => f,
        Err(_) => return,
    };
    let file_len = match file.metadata() {
        Ok(m) => m.len(),
        Err(_) => return,
    };
    if file_len < 20 {
        return;
    }
    if file.seek(SeekFrom::End(-16)).is_err() {
        return;
    }
    let mut footer = [0u8; 16];
    if file.read_exact(&mut footer).is_err() {
        return;
    }
    if &footer[8..16] != TRAILER_MAGIC {
        return;
    }
    let trailer_len = u64::from_le_bytes(footer[0..8].try_into().unwrap());
    if file_len < 16 + trailer_len {
        return;
    }
    let trailer_start = file_len - 16 - trailer_len;
    let trailer_end = file_len - 16;

    let mut cur_offset = trailer_start;
    while cur_offset + 4 <= trailer_end {
        if file.seek(SeekFrom::Start(cur_offset)).is_err() {
            break;
        }
        let mut len_buf = [0u8; 4];
        if file.read_exact(&mut len_buf).is_err() {
            break;
        }
        let pack_len = u32::from_le_bytes(len_buf) as u64;
        cur_offset += 4;
        if cur_offset + pack_len > trailer_end {
            break;
        }
        if let Some(pack) = parse_docpack_on_disk(
            exe_path.clone(),
            cur_offset,
            pack_len as usize,
            "Embedded DOCXPACK Trailer",
        ) {
            overrides.insert(pack.manifest.id.clone(), pack);
        }
        cur_offset += pack_len;
    }
}

fn load_disk_overrides(overrides: &mut HashMap<String, Arc<SiteOverridePack>>) {
    let packs_dir = get_packs_dir();
    if let Ok(entries) = fs::read_dir(&packs_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("docpack") {
                if let Ok(meta) = fs::metadata(&path) {
                    let pack_len = meta.len() as usize;
                    if let Some(pack) =
                        parse_docpack_on_disk(path.clone(), 0, pack_len, "Modular .docpack")
                    {
                        let should_use_disk = match overrides.get(&pack.manifest.id) {
                            Some(existing) => {
                                pack.manifest.updatedAt >= existing.manifest.updatedAt
                                    || pack.manifest.routes.len() >= existing.manifest.routes.len()
                            }
                            None => true,
                        };
                        if should_use_disk {
                            overrides.insert(pack.manifest.id.clone(), pack);
                        }
                    }
                }
            }
        }
    }
}

fn load_asset_store() -> Arc<AssetStore> {
    let len_bytes: [u8; 4] = ASSETS_PACK[0..4].try_into().expect("Invalid pack header");
    let manifest_len = u32::from_le_bytes(len_bytes) as usize;
    let manifest_slice = &ASSETS_PACK[4..4 + manifest_len];
    let mut base_manifest: HashMap<String, ManifestEntry> =
        serde_json::from_slice(manifest_slice).expect("Failed to parse asset manifest");
    let base_data_start = 4 + manifest_len;

    for entry in base_manifest.values_mut() {
        if entry.hash.is_empty() {
            let slice = &ASSETS_PACK
                [base_data_start + entry.offset..base_data_start + entry.offset + entry.length];
            entry.hash = fnv1a_hash_hex(slice);
        }
    }

    migrate_legacy_packs_to_appdata();
    let mut overrides = HashMap::new();
    load_exe_trailer_overrides(&mut overrides);
    load_disk_overrides(&mut overrides);

    Arc::new(AssetStore {
        base_manifest,
        base_data_start,
        overrides: RwLock::new(overrides),
        site_ports: RwLock::new(HashMap::new()),
        fallback_cache: RwLock::new(HashMap::new()),
    })
}

fn url_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(h), Some(l)) = (
                (bytes[i + 1] as char).to_digit(16),
                (bytes[i + 2] as char).to_digit(16),
            ) {
                out.push(((h << 4) | l) as u8);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn guess_mime_from_path(path: &str) -> &'static str {
    let p = path.split('?').next().unwrap_or(path).to_lowercase();
    if p.ends_with(".css") || path.contains("only=styles") {
        "text/css; charset=utf-8"
    } else if p.ends_with(".js") || p.ends_with(".mjs") {
        "application/javascript; charset=utf-8"
    } else if p.ends_with(".svg") {
        "image/svg+xml"
    } else if p.ends_with(".woff2") {
        "font/woff2"
    } else if p.ends_with(".woff") {
        "font/woff"
    } else if p.ends_with(".ttf") {
        "font/ttf"
    } else if p.ends_with(".png") {
        "image/png"
    } else if p.ends_with(".jpg") || p.ends_with(".jpeg") {
        "image/jpeg"
    } else if p.ends_with(".webp") {
        "image/webp"
    } else if p.ends_with(".ico") {
        "image/x-icon"
    } else if p.ends_with(".json") {
        "application/json; charset=utf-8"
    } else {
        "text/html; charset=utf-8"
    }
}

fn fetch_live_fallback(
    site_key: &str,
    raw_target: &str,
    decoded_path: &str,
    store: &AssetStore,
) -> Option<(String, bool, Vec<u8>)> {
    let cache_key = format!("{}:{}", site_key, raw_target);
    if let Ok(guard) = store.fallback_cache.read() {
        if let Some((mime, bytes)) = guard.get(&cache_key) {
            return Some((mime.clone(), false, bytes.clone()));
        }
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

    if decoded_path == "/" || decoded_path == "/docs" {
        if let Some((_, entry_path)) = get_site_origin_and_entry(site_id) {
            let trimmed = entry_path.trim_end_matches('/');
            if !trimmed.is_empty() {
                candidates.push(entry_path.to_string());
                candidates.push(trimmed.to_string());
                candidates.push(format!("{}/index.html", trimmed));
            }
            candidates.push("/".to_string());
            candidates.push("/index.html".to_string());
        }
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

    if let Ok(guard) = store.overrides.read() {
        if let Some(pack) = guard.get(site_id) {
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
            if let Some(entry) = entry_opt {
                if let Some(chunk_bytes) = pack.read_chunk(entry.offset, entry.length) {
                    return Some((entry.mime.clone(), entry.gzipped, chunk_bytes));
                }
            }
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


fn ensure_site_server(site_id: &str, store: Arc<AssetStore>) -> u16 {
    if let Ok(guard) = store.site_ports.read() {
        if let Some(&port) = guard.get(site_id) {
            return port;
        }
    }
    let listener = TcpListener::bind("127.0.0.1:0").expect("Failed to bind embedded HTTP server");
    let port = listener.local_addr().unwrap().port();
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

#[tauri::command]
fn check_servers(state: tauri::State<'_, AppState>) -> ServerStatus {
    let ports = state.store.site_ports.read().unwrap().clone();
    ServerStatus {
        tailwind: true,
        shadcn: true,
        tailwind_port: state.tailwind_port,
        shadcn_port: state.shadcn_port,
        site_ports: ports,
    }
}

#[tauri::command]
fn start_tailwind_server(state: tauri::State<'_, AppState>) -> Result<String, String> {
    Ok(format!(
        "Embedded Tailwind server active on port {}",
        state.tailwind_port
    ))
}

#[tauri::command]
fn start_shadcn_server(state: tauri::State<'_, AppState>) -> Result<String, String> {
    Ok(format!(
        "Embedded shadcn server active on port {}",
        state.shadcn_port
    ))
}

#[tauri::command]
fn get_installed_packs(state: tauri::State<'_, AppState>) -> Vec<PackStatusInfo> {
    let mut list = Vec::new();
    let guard = state.store.overrides.read().unwrap();
    let ports = state.store.site_ports.read().unwrap();

    for (site_id, prefix, default_name, default_ver) in [
        ("tailwind", "tw:", "Tailwind CSS", "v4.3.0"),
        ("shadcn", "sh:", "shadcn/ui", "v4.0.0"),
    ] {
        let port = ports.get(site_id).copied().unwrap_or(0);
        if let Some(pack) = guard.get(site_id) {
            list.push(PackStatusInfo {
                id: site_id.to_string(),
                name: pack.manifest.name.clone(),
                version: pack.manifest.version.clone(),
                commit: pack.manifest.commit.clone(),
                route_count: pack.manifest.routes.len(),
                chunk_count: pack.manifest.chunkCount,
                size_mb: (pack.manifest.totalBytes as f64 / (1024.0 * 1024.0) * 100.0).round()
                    / 100.0,
                source: pack.source.clone(),
                port,
            });
        } else {
            let mut offsets = std::collections::HashSet::new();
            let mut total_bytes = 0usize;
            let mut route_count = 0usize;
            for (k, v) in &state.store.base_manifest {
                if k.starts_with(prefix) {
                    route_count += 1;
                    if offsets.insert(v.offset) {
                        total_bytes += v.length;
                    }
                }
            }
            if route_count > 0 {
                list.push(PackStatusInfo {
                    id: site_id.to_string(),
                    name: default_name.to_string(),
                    version: default_ver.to_string(),
                    commit: "embedded-base".to_string(),
                    route_count,
                    chunk_count: offsets.len(),
                    size_mb: (total_bytes as f64 / (1024.0 * 1024.0) * 100.0).round() / 100.0,
                    source: "Embedded in .exe".to_string(),
                    port,
                });
            }
        }
    }

    for (site_id, pack) in guard.iter() {
        if site_id == "tailwind" || site_id == "shadcn" {
            continue;
        }
        let port = ports.get(site_id).copied().unwrap_or(0);
        list.push(PackStatusInfo {
            id: site_id.clone(),
            name: pack.manifest.name.clone(),
            version: pack.manifest.version.clone(),
            commit: pack.manifest.commit.clone(),
            route_count: pack.manifest.routes.len(),
            chunk_count: pack.manifest.chunkCount,
            size_mb: (pack.manifest.totalBytes as f64 / (1024.0 * 1024.0) * 100.0).round() / 100.0,
            source: pack.source.clone(),
            port,
        });
    }

    list.sort_by(|a, b| a.id.cmp(&b.id));
    list
}

#[derive(serde::Deserialize, serde::Serialize, Clone)]
#[allow(non_snake_case)]
pub struct RemoteRegistryEntryRaw {
    pub id: String,
    pub name: String,
    pub version: String,
    pub commit: String,
    #[serde(default)]
    pub updatedAt: String,
    #[serde(default)]
    pub sizeBytes: usize,
    #[serde(default)]
    pub totalBytes: usize,
    #[serde(default)]
    pub sizeMB: f64,
    #[serde(default)]
    pub routeCount: usize,
    #[serde(default)]
    pub chunkCount: usize,
}

#[derive(serde::Deserialize)]
#[allow(non_snake_case)]
pub struct RemoteRegistryFileVec {
    pub packs: Vec<RemoteRegistryEntryRaw>,
}

#[derive(serde::Deserialize)]
#[allow(non_snake_case)]
pub struct RemoteRegistryFileMap {
    pub packs: HashMap<String, RemoteRegistryEntryRaw>,
}

#[derive(serde::Serialize, Clone)]
#[allow(non_snake_case)]
pub struct RemoteRegistryItem {
    pub id: String,
    pub name: String,
    pub version: String,
    pub commit: String,
    pub updatedAt: String,
    pub sizeBytes: usize,
    pub routeCount: usize,
    pub chunkCount: usize,
    pub installed: bool,
    pub local_commit: String,
    pub update_available: bool,
}

#[tauri::command]
fn fetch_remote_registry(state: tauri::State<'_, AppState>) -> Result<Vec<RemoteRegistryItem>, String> {
    let url = format!("{}/registry.json", RELEASE_BASE_URL);
    let bytes = match curl_get_bytes(&url, None) {
        Ok(b) => b,
        Err(e) => {
            let local_reg = get_packs_dir().join("registry.json");
            fs::read(&local_reg).map_err(|_| e)?
        }
    };
    let parsed_raw: Vec<RemoteRegistryEntryRaw> =
        if let Ok(wrapper_map) = serde_json::from_slice::<RemoteRegistryFileMap>(&bytes) {
            wrapper_map.packs.into_values().collect()
        } else if let Ok(wrapper_vec) = serde_json::from_slice::<RemoteRegistryFileVec>(&bytes) {
            wrapper_vec.packs
        } else {
            serde_json::from_slice::<Vec<RemoteRegistryEntryRaw>>(&bytes)
                .map_err(|e| e.to_string())?
        };

    let guard = state.store.overrides.read().unwrap();
    let mut out = Vec::with_capacity(parsed_raw.len());
    for item in parsed_raw {
        if get_site_origin_and_entry(&item.id).is_none() {
            continue;
        }
        let (installed, local_commit, local_routes, local_updated_at) =
            if let Some(pack) = guard.get(&item.id) {
                (
                    true,
                    pack.manifest.commit.clone(),
                    pack.manifest.routes.len(),
                    pack.manifest.updatedAt.clone(),
                )
            } else {
                (false, String::new(), 0, String::new())
            };
        let effective_bytes = if item.sizeBytes > 0 {
            item.sizeBytes
        } else if item.totalBytes > 0 {
            item.totalBytes
        } else if item.sizeMB > 0.0 {
            (item.sizeMB * 1024.0 * 1024.0) as usize
        } else {
            0
        };
        let remote_is_valid = !item.commit.is_empty()
            && item.commit != "e3b0c442"
            && effective_bytes >= 1024
            && item.routeCount > 0;
        let remote_is_newer = if !local_updated_at.is_empty() && !item.updatedAt.is_empty() {
            item.updatedAt > local_updated_at
        } else {
            item.routeCount >= local_routes
        };
        let update_available = installed
            && !local_commit.is_empty()
            && remote_is_valid
            && local_commit != item.commit
            && remote_is_newer;
        out.push(RemoteRegistryItem {
            id: item.id,
            name: item.name,
            version: item.version,
            commit: if installed && !update_available && !local_commit.is_empty() {
                local_commit.clone()
            } else if remote_is_valid {
                item.commit
            } else if !local_commit.is_empty() {
                local_commit.clone()
            } else {
                item.commit
            },
            updatedAt: item.updatedAt,
            sizeBytes: effective_bytes,
            routeCount: item.routeCount,
            chunkCount: item.chunkCount,
            installed,
            local_commit,
            update_available,
        });
    }
    Ok(out)
}

#[tauri::command]
fn ensure_site_server_cmd(site_id: String, state: tauri::State<'_, AppState>) -> u16 {
    ensure_site_server(&site_id, Arc::clone(&state.store))
}

#[tauri::command]
fn simulate_outdated_pack(site_id: String, state: tauri::State<'_, AppState>) -> Result<String, String> {
    let mut guard = state.store.overrides.write().unwrap();
    if let Some(existing) = guard.get(&site_id).cloned() {
        let mut modified_manifest = existing.manifest.clone();
        modified_manifest.commit = "old-7f21a09".to_string();
        // Change 2 route hashes in local memory so HTTP 206 delta update downloads only those 2 chunks!
        let mut count = 0;
        for entry in modified_manifest.routes.values_mut() {
            if entry.mime.contains("text/html") && count < 2 {
                entry.hash = format!("outdated_hash_{}", count);
                count += 1;
            }
        }
        guard.insert(
            site_id.clone(),
            Arc::new(SiteOverridePack {
                manifest: modified_manifest,
                data_start: existing.data_start,
                backing: existing.backing.clone(),
                source: "Outdated Local Pack".to_string(),
            }),
        );
        Ok(format!("Simulated outdated commit (old-7f21a09) on '{}'", site_id))
    } else {
        Err(format!("Pack '{}' is not in overrides yet", site_id))
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
fn get_extra_search_entries(state: tauri::State<'_, AppState>) -> Vec<serde_json::Value> {
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

#[derive(serde::Serialize, Clone)]
#[allow(non_snake_case)]
pub struct DownloadProgressPayload {
    pub site_id: String,
    pub phase: String,
    pub downloaded_bytes: usize,
    pub total_bytes: usize,
    pub percent: u8,
    pub detail: String,
}

fn curl_download_with_progress(
    url: &str,
    dest_path: &PathBuf,
    expected_total: usize,
    site_id: &str,
    window: &tauri::Window,
) -> Result<Vec<u8>, String> {
    use tauri::Emitter;
    let _ = fs::remove_file(dest_path);

    let client = reqwest::blocking::Client::builder()
        .user_agent("Docx/1.0")
        .timeout(Duration::from_secs(300))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let mut resp = client
        .get(url)
        .send()
        .map_err(|e| format!("HTTP download request error for {}: {}", url, e))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP download failed with status {} for {}", resp.status(), url));
    }

    let total = resp.content_length().map(|l| l as usize).unwrap_or(expected_total).max(1);
    let mut file = File::create(dest_path).map_err(|e| format!("Failed to create file: {}", e))?;
    let mut buffer = [0u8; 65536];
    let mut cur_bytes = 0usize;
    let mut last_emit = std::time::Instant::now();

    loop {
        let bytes_read = resp.read(&mut buffer).map_err(|e| format!("Download stream read error: {}", e))?;
        if bytes_read == 0 {
            break;
        }
        file.write_all(&buffer[..bytes_read]).map_err(|e| format!("Download file write error: {}", e))?;
        cur_bytes += bytes_read;

        if last_emit.elapsed() >= Duration::from_millis(65) || cur_bytes == total {
            last_emit = std::time::Instant::now();
            let pct = ((cur_bytes as f64 / total as f64) * 92.0)
                .round()
                .clamp(8.0, 95.0) as u8;
            let _ = window.emit(
                "docpack-progress",
                DownloadProgressPayload {
                    site_id: site_id.to_string(),
                    phase: "Downloading .docpack".to_string(),
                    downloaded_bytes: cur_bytes,
                    total_bytes: total,
                    percent: pct,
                    detail: format!(
                        "{:.2} MB / {:.2} MB ({}%)",
                        cur_bytes as f64 / (1024.0 * 1024.0),
                        total as f64 / (1024.0 * 1024.0),
                        pct
                    ),
                },
            );
        }
    }

    file.flush().map_err(|e| format!("File flush error: {}", e))?;
    drop(file);

    fs::read(dest_path).map_err(|e| format!("Failed to read downloaded pack: {}", e))
}

fn run_install_or_update_sync(
    site_id: String,
    store: Arc<AssetStore>,
    window: tauri::Window,
) -> Result<DeltaUpdateResult, String> {
    use tauri::Emitter;

    let manifest_url = format!("{}/{}.manifest.json", RELEASE_BASE_URL, site_id);
    let pack_url = format!("{}/{}.docpack", RELEASE_BASE_URL, site_id);
    let search_url = format!("{}/{}.search.json", RELEASE_BASE_URL, site_id);

    let _ = window.emit(
        "docpack-progress",
        DownloadProgressPayload {
            site_id: site_id.clone(),
            phase: "Fetching manifest...".to_string(),
            downloaded_bytes: 0,
            total_bytes: 0,
            percent: 4,
            detail: "Connecting to GitHub Releases CDN...".to_string(),
        },
    );

    let remote_manifest_bytes = curl_get_bytes(&manifest_url, None)?;
    let remote_manifest: SiteManifest =
        serde_json::from_slice(&remote_manifest_bytes).map_err(|e| e.to_string())?;
    if remote_manifest.routes.is_empty() || remote_manifest.commit == "e3b0c442" {
        return Err(format!("Remote manifest for '{}' has 0 routes", site_id));
    }

    let packs_dir = get_packs_dir();
    let _ = fs::create_dir_all(&packs_dir);

    let mut local_chunks_by_hash: HashMap<String, Vec<u8>> = HashMap::new();
    let mut old_commit = String::from("not-installed");
    let mut local_updated_at = String::new();
    let mut local_route_count = 0usize;
    let mut local_total_bytes = 0usize;
    let mut local_chunk_count = 0usize;

    {
        let guard = store.overrides.read().unwrap();
        if let Some(pack) = guard.get(&site_id) {
            old_commit = pack.manifest.commit.clone();
            local_updated_at = pack.manifest.updatedAt.clone();
            local_route_count = pack.manifest.routes.len();
            local_total_bytes = pack.manifest.totalBytes;
            local_chunk_count = pack.manifest.chunkCount;
        }
    }

    // Fast path: if local pack already matches remote commit (or is newer than remote manifest), download 0 bytes!
    if local_route_count > 0
        && (old_commit == remote_manifest.commit
            || (!local_updated_at.is_empty()
                && local_updated_at >= remote_manifest.updatedAt
                && local_route_count >= remote_manifest.routes.len()))
    {
        if old_commit != remote_manifest.commit {
            let mut guard = store.overrides.write().unwrap();
            if let Some(existing) = guard.get(&site_id).cloned() {
                let mut reconciled = existing.manifest.clone();
                reconciled.commit = remote_manifest.commit.clone();
                if remote_manifest.updatedAt > reconciled.updatedAt {
                    reconciled.updatedAt = remote_manifest.updatedAt.clone();
                }
                if let Ok(json_bytes) = serde_json::to_vec_pretty(&reconciled) {
                    let _ = fs::write(packs_dir.join(format!("{}.manifest.json", site_id)), json_bytes);
                }
                guard.insert(
                    site_id.clone(),
                    Arc::new(SiteOverridePack {
                        manifest: reconciled,
                        data_start: existing.data_start,
                        backing: existing.backing.clone(),
                        source: existing.source.clone(),
                    }),
                );
            }
        }
        let port = ensure_site_server(&site_id, Arc::clone(&store));
        let _ = window.emit(
            "docpack-progress",
            DownloadProgressPayload {
                site_id: site_id.clone(),
                phase: "Up to Date".to_string(),
                downloaded_bytes: 0,
                total_bytes: local_total_bytes,
                percent: 100,
                detail: "Already up to date (0.00 MB downloaded)".to_string(),
            },
        );
        return Ok(DeltaUpdateResult {
            site_id: site_id.clone(),
            old_commit,
            new_commit: remote_manifest.commit.clone(),
            total_chunks: local_chunk_count,
            reused_chunks: local_chunk_count,
            downloaded_chunks: 0,
            reused_bytes: local_total_bytes,
            downloaded_bytes: 0,
            saved_percent: 100.0,
            port,
            message: format!(
                "{} ({}) is already up to date (0.00 MB downloaded, 100% local chunks verified) on port :{}!",
                remote_manifest.name, remote_manifest.version, port
            ),
        });
    }

    if let Ok(search_bytes) = curl_get_bytes(&search_url, None) {
        if search_bytes.len() > 4 {
            let _ = fs::write(packs_dir.join(format!("{}.search.json", site_id)), search_bytes);
        }
    }

    {
        let guard = store.overrides.read().unwrap();
        if let Some(pack) = guard.get(&site_id) {
            for entry in pack.manifest.routes.values() {
                if !entry.hash.is_empty() {
                    if let Some(chunk) = pack.read_chunk(entry.offset, entry.length) {
                        local_chunks_by_hash.insert(entry.hash.clone(), chunk);
                    }
                }
            }
        }
    }

    let mut missing_unique_hashes = std::collections::HashSet::new();
    for rem_entry in remote_manifest.routes.values() {
        if !local_chunks_by_hash.contains_key(&rem_entry.hash) {
            missing_unique_hashes.insert(rem_entry.hash.clone());
        }
    }

    if !local_chunks_by_hash.is_empty() && missing_unique_hashes.is_empty() {
        {
            let mut guard = store.overrides.write().unwrap();
            if let Some(existing) = guard.get(&site_id).cloned() {
                let mut reconciled = existing.manifest.clone();
                reconciled.commit = remote_manifest.commit.clone();
                if remote_manifest.updatedAt > reconciled.updatedAt {
                    reconciled.updatedAt = remote_manifest.updatedAt.clone();
                }
                guard.insert(
                    site_id.clone(),
                    Arc::new(SiteOverridePack {
                        manifest: reconciled,
                        data_start: existing.data_start,
                        backing: existing.backing.clone(),
                        source: existing.source.clone(),
                    }),
                );
            }
        }
        let _ = fs::write(
            packs_dir.join(format!("{}.manifest.json", site_id)),
            &remote_manifest_bytes,
        );
        let port = ensure_site_server(&site_id, Arc::clone(&store));
        let _ = window.emit(
            "docpack-progress",
            DownloadProgressPayload {
                site_id: site_id.clone(),
                phase: "Up to Date".to_string(),
                downloaded_bytes: 0,
                total_bytes: remote_manifest.totalBytes,
                percent: 100,
                detail: "100% chunks verified locally (0.00 MB downloaded)".to_string(),
            },
        );
        return Ok(DeltaUpdateResult {
            site_id: site_id.clone(),
            old_commit,
            new_commit: remote_manifest.commit.clone(),
            total_chunks: remote_manifest.chunkCount,
            reused_chunks: remote_manifest.chunkCount,
            downloaded_chunks: 0,
            reused_bytes: remote_manifest.totalBytes,
            downloaded_bytes: 0,
            saved_percent: 100.0,
            port,
            message: format!(
                "{} ({}) is already up to date (0.00 MB downloaded, 100% chunks reused) on port :{}!",
                remote_manifest.name, remote_manifest.version, port
            ),
        });
    }

    let missing_bytes: usize = remote_manifest
        .routes
        .values()
        .filter(|entry| missing_unique_hashes.contains(&entry.hash))
        .map(|entry| (entry.hash.clone(), entry.length))
        .collect::<HashMap<String, usize>>()
        .values()
        .sum();
    let missing_chunks_count = missing_unique_hashes.len();
    let max_delta_bytes = (remote_manifest.totalBytes * 65) / 100;

    // Use single-stream full .docpack download ONLY if not installed locally,
    // or if the delta exceeds 65% of total pack size or > 250 chunks.
    let should_full_download = local_chunks_by_hash.is_empty()
        || missing_chunks_count > 250
        || (remote_manifest.totalBytes > 0 && missing_bytes > max_delta_bytes);

    if should_full_download {
        let expected_total = 4 + remote_manifest_bytes.len() + remote_manifest.totalBytes;
        let docpack_path = packs_dir.join(format!("{}.docpack", site_id));
        let full_pack_bytes = curl_download_with_progress(
            &pack_url,
            &docpack_path,
            expected_total,
            &site_id,
            &window,
        )?;
        let dl_bytes = full_pack_bytes.len();
        drop(full_pack_bytes);

        let _ = window.emit(
            "docpack-progress",
            DownloadProgressPayload {
                site_id: site_id.clone(),
                phase: "Mounting pack...".to_string(),
                downloaded_bytes: dl_bytes,
                total_bytes: dl_bytes,
                percent: 98,
                detail: "Indexing routes & starting local server...".to_string(),
            },
        );

        let parsed = match parse_docpack_on_disk(docpack_path.clone(), 0, dl_bytes, "GitHub Release .docpack") {
            Some(p) => p,
            None => {
                let _ = fs::remove_file(&docpack_path);
                return Err(format!(
                    "Downloaded {}.docpack ({} bytes) is empty or invalid — please retry after release sync.",
                    site_id, dl_bytes
                ));
            }
        };

        let mut final_manifest = parsed.manifest.clone();
        if !remote_manifest.commit.is_empty() && remote_manifest.commit != "e3b0c442" {
            final_manifest.commit = remote_manifest.commit.clone();
        }
        if remote_manifest.updatedAt > final_manifest.updatedAt {
            final_manifest.updatedAt = remote_manifest.updatedAt.clone();
        }
        if let Ok(json_bytes) = serde_json::to_vec_pretty(&final_manifest) {
            let _ = fs::write(packs_dir.join(format!("{}.manifest.json", site_id)), json_bytes);
        }

        let final_commit = final_manifest.commit.clone();
        let final_routes = final_manifest.routes.len();
        let final_chunks = final_manifest.chunkCount;

        store.overrides.write().unwrap().insert(
            site_id.clone(),
            Arc::new(SiteOverridePack {
                manifest: final_manifest,
                data_start: parsed.data_start,
                backing: parsed.backing.clone(),
                source: parsed.source.clone(),
            }),
        );
        let port = ensure_site_server(&site_id, Arc::clone(&store));

        let _ = window.emit(
            "docpack-progress",
            DownloadProgressPayload {
                site_id: site_id.clone(),
                phase: "Complete".to_string(),
                downloaded_bytes: dl_bytes,
                total_bytes: dl_bytes,
                percent: 100,
                detail: format!("Installed ({:.2} MB)", dl_bytes as f64 / (1024.0 * 1024.0)),
            },
        );

        return Ok(DeltaUpdateResult {
            site_id: site_id.clone(),
            old_commit,
            new_commit: final_commit,
            total_chunks: final_chunks,
            reused_chunks: 0,
            downloaded_chunks: final_chunks,
            reused_bytes: 0,
            downloaded_bytes: dl_bytes,
            saved_percent: 0.0,
            port,
            message: format!(
                "Synced {} ({}) from GitHub Releases ({:.2} MB, {} routes) on port :{}!",
                remote_manifest.name,
                remote_manifest.version,
                dl_bytes as f64 / (1024.0 * 1024.0),
                final_routes,
                port
            ),
        });
    }

    // Already installed and delta is within budget: perform HTTP 206 Partial Content Range Delta Update!
    let hdr_bytes = curl_get_bytes(&pack_url, Some((0, 3)))?;
    let embedded_manifest_len = if hdr_bytes.len() >= 4 {
        u32::from_le_bytes([hdr_bytes[0], hdr_bytes[1], hdr_bytes[2], hdr_bytes[3]]) as usize
    } else {
        remote_manifest_bytes.len()
    };
    let remote_data_start = 4 + embedded_manifest_len;
    let mut new_pack_data: Vec<u8> = Vec::new();
    let mut new_routes: HashMap<String, ManifestEntry> = HashMap::new();
    let mut placed_hashes: HashMap<String, (usize, usize)> = HashMap::new();

    let mut reused_chunks = 0usize;
    let mut downloaded_chunks = 0usize;
    let mut reused_bytes = 0usize;
    let mut downloaded_bytes = 0usize;
    let total_routes = remote_manifest.routes.len().max(1);

    for (idx, (route, rem_entry)) in remote_manifest.routes.iter().enumerate() {
        let (final_offset, final_length) = if let Some(&already) = placed_hashes.get(&rem_entry.hash)
        {
            already
        } else if let Some(local_bytes) = local_chunks_by_hash.get(&rem_entry.hash) {
            let off = new_pack_data.len();
            let len = local_bytes.len();
            new_pack_data.extend_from_slice(local_bytes);
            placed_hashes.insert(rem_entry.hash.clone(), (off, len));
            reused_chunks += 1;
            reused_bytes += len;
            (off, len)
        } else {
            let pct = 10 + ((idx * 85) / total_routes) as u8;
            let _ = window.emit(
                "docpack-progress",
                DownloadProgressPayload {
                    site_id: site_id.clone(),
                    phase: "HTTP 206 Delta Sync".to_string(),
                    downloaded_bytes,
                    total_bytes: remote_manifest.totalBytes.max(1),
                    percent: pct,
                    detail: format!(
                        "Reused {} chunks • Fetching changed chunk #{} via HTTP 206...",
                        reused_chunks,
                        downloaded_chunks + 1
                    ),
                },
            );
            let abs_start = remote_data_start + rem_entry.offset;
            let abs_end = abs_start + rem_entry.length - 1;
            let range_bytes = curl_get_bytes(&pack_url, Some((abs_start, abs_end)))?;
            let off = new_pack_data.len();
            let len = range_bytes.len();
            new_pack_data.extend_from_slice(&range_bytes);
            placed_hashes.insert(rem_entry.hash.clone(), (off, len));
            downloaded_chunks += 1;
            downloaded_bytes += len;
            (off, len)
        };

        new_routes.insert(
            route.clone(),
            ManifestEntry {
                offset: final_offset,
                length: final_length,
                mime: rem_entry.mime.clone(),
                gzipped: rem_entry.gzipped,
                hash: rem_entry.hash.clone(),
            },
        );
    }

    let final_manifest = SiteManifest {
        id: site_id.clone(),
        name: remote_manifest.name.clone(),
        version: remote_manifest.version.clone(),
        commit: remote_manifest.commit.clone(),
        updatedAt: remote_manifest.updatedAt.clone(),
        totalBytes: new_pack_data.len(),
        chunkCount: placed_hashes.len(),
        routes: new_routes,
    };

    let manifest_json = serde_json::to_vec(&final_manifest).map_err(|e| e.to_string())?;
    let mut full_docpack = Vec::with_capacity(4 + manifest_json.len() + new_pack_data.len());
    full_docpack.extend_from_slice(&(manifest_json.len() as u32).to_le_bytes());
    full_docpack.extend_from_slice(&manifest_json);
    full_docpack.extend_from_slice(&new_pack_data);

    let docpack_path = packs_dir.join(format!("{}.docpack", site_id));
    let full_len = full_docpack.len();
    fs::write(&docpack_path, &full_docpack).map_err(|e| e.to_string())?;
    drop(full_docpack);

    if let Some(parsed) =
        parse_docpack_on_disk(docpack_path, 0, full_len, "GitHub Delta .docpack")
    {
        store
            .overrides
            .write()
            .unwrap()
            .insert(site_id.clone(), parsed);
    }
    let port = ensure_site_server(&site_id, Arc::clone(&store));

    let total_bytes = reused_bytes + downloaded_bytes;
    let saved_percent = if total_bytes > 0 {
        ((reused_bytes as f64 / total_bytes as f64) * 1000.0).round() / 10.0
    } else {
        100.0
    };

    let _ = window.emit(
        "docpack-progress",
        DownloadProgressPayload {
            site_id: site_id.clone(),
            phase: "Complete".to_string(),
            downloaded_bytes,
            total_bytes,
            percent: 100,
            detail: format!("{}% bandwidth saved", saved_percent),
        },
    );

    Ok(DeltaUpdateResult {
        site_id: site_id.clone(),
        old_commit,
        new_commit: remote_manifest.commit,
        total_chunks: reused_chunks + downloaded_chunks,
        reused_chunks,
        downloaded_chunks,
        reused_bytes,
        downloaded_bytes,
        saved_percent,
        port,
        message: format!(
            "GitHub Partial Update complete! Reused {}/{} chunks locally ({:.2} MB), downloaded {} changed chunks ({:.1} KB via HTTP 206 Range) — {}% bandwidth saved!",
            reused_chunks,
            reused_chunks + downloaded_chunks,
            reused_bytes as f64 / (1024.0 * 1024.0),
            downloaded_chunks,
            downloaded_bytes as f64 / 1024.0,
            saved_percent
        ),
    })
}

/// Downloads a brand-new .docpack OR performs an HTTP 206 Partial Range Delta Update from GitHub Releases!
#[tauri::command]
async fn install_or_update_from_github(
    site_id: String,
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
) -> Result<DeltaUpdateResult, String> {
    let store = Arc::clone(&state.store);
    tauri::async_runtime::spawn_blocking(move || run_install_or_update_sync(site_id, store, window))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn test_partial_delta_update(
    site_id: String,
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
) -> Result<DeltaUpdateResult, String> {
    install_or_update_from_github(site_id, window, state).await
}


#[tauri::command]
fn delete_docpack(site_id: String, state: tauri::State<'_, AppState>) -> Result<String, String> {
    let packs_dir = get_packs_dir();
    let docpack_path = packs_dir.join(format!("{}.docpack", site_id));
    let manifest_path = packs_dir.join(format!("{}.manifest.json", site_id));
    let search_path = packs_dir.join(format!("{}.search.json", site_id));

    let _ = fs::remove_file(&docpack_path);
    let _ = fs::remove_file(&manifest_path);
    let _ = fs::remove_file(&search_path);

    {
        let mut guard = state.store.overrides.write().unwrap();
        guard.remove(&site_id);
    }

    Ok(format!("Deleted documentation pack for '{}'", site_id))
}

#[tauri::command]
fn bundle_into_single_exe(state: tauri::State<'_, AppState>) -> Result<String, String> {
    #[cfg(not(desktop))]
    {
        let _ = state;
        return Err("Standalone single-binary bundling is only supported on desktop platforms.".to_string());
    }
    #[cfg(desktop)]
    {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    let mut exe_bytes = fs::read(&exe_path).map_err(|e| e.to_string())?;

    if exe_bytes.len() >= 20 && &exe_bytes[exe_bytes.len() - 8..] == TRAILER_MAGIC {
        let old_trailer_len = u64::from_le_bytes(
            exe_bytes[exe_bytes.len() - 16..exe_bytes.len() - 8]
                .try_into()
                .unwrap(),
        ) as usize;
        if exe_bytes.len() >= 16 + old_trailer_len {
            exe_bytes.truncate(exe_bytes.len() - 16 - old_trailer_len);
        }
    }

    let mut trailer_payload: Vec<u8> = Vec::new();
    let guard = state.store.overrides.read().unwrap();
    for pack in guard.values() {
        if let Some(bytes) = pack.read_full_pack_bytes() {
            let len = bytes.len() as u32;
            trailer_payload.extend_from_slice(&len.to_le_bytes());
            trailer_payload.extend_from_slice(&bytes);
        }
    }

    let trailer_len = trailer_payload.len() as u64;
    exe_bytes.extend_from_slice(&trailer_payload);
    exe_bytes.extend_from_slice(&trailer_len.to_le_bytes());
    exe_bytes.extend_from_slice(TRAILER_MAGIC);

    let temp_dir = std::env::temp_dir();
    let tmp_path = temp_dir.join("Docx_bundle_staged.exe");
    fs::write(&tmp_path, &exe_bytes).map_err(|e| e.to_string())?;

    let out_path = PathBuf::from("C:/Users/vahid/OneDrive/Desktop/Docx.exe");
    let _ = fs::remove_file("C:/Users/vahid/OneDrive/Desktop/Docx.old.exe");
    let _ = fs::remove_file("C:/Users/vahid/OneDrive/Desktop/Docx.new.exe");

    if fs::copy(&tmp_path, &out_path).is_ok() {
        let _ = fs::remove_file(&tmp_path);
        return Ok(format!(
            "Updated standalone Desktop\\Docx.exe in-place with {} embedded packs ({:.2} MB total)!",
            guard.len(),
            exe_bytes.len() as f64 / (1024.0 * 1024.0)
        ));
    }

    let temp_old = temp_dir.join(format!("Docx_prev_{}.tmp", std::process::id()));
    let _ = fs::remove_file(&temp_old);
    if fs::rename(&out_path, &temp_old).is_ok() {
        if fs::copy(&tmp_path, &out_path).is_ok() {
            let _ = fs::remove_file(&tmp_path);
            let _ = fs::remove_file(&temp_old);
            return Ok(format!(
                "Updated standalone Desktop\\Docx.exe in-place with {} embedded packs ({:.2} MB total)!",
                guard.len(),
                exe_bytes.len() as f64 / (1024.0 * 1024.0)
            ));
        } else {
            let _ = fs::rename(&temp_old, &out_path);
        }
    }

    Err("Could not overwrite Desktop\\Docx.exe while locked.".to_string())
    }
}

#[derive(serde::Deserialize, serde::Serialize, Clone)]
#[allow(non_snake_case)]
pub struct AppManifestRemote {
    pub commit: String,
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub updatedAt: String,
    #[serde(default)]
    pub coreSizeBytes: usize,
    #[serde(default)]
    pub fullSizeBytes: usize,
}

#[derive(serde::Serialize, Clone)]
#[allow(non_snake_case)]
pub struct AppUpdateStatus {
    pub localCommit: String,
    pub remoteCommit: String,
    pub version: String,
    pub updateAvailable: bool,
    pub coreSizeMb: f64,
}

fn commits_match(a: &str, b: &str) -> bool {
    let a = a.trim();
    let b = b.trim();
    !a.is_empty() && !b.is_empty() && (a.starts_with(b) || b.starts_with(a))
}

fn read_saved_local_app_commit() -> Option<String> {
    let path = get_packs_dir().join("app-manifest.local.json");
    if let Ok(bytes) = fs::read(path) {
        if let Ok(manifest) = serde_json::from_slice::<AppManifestRemote>(&bytes) {
            if !manifest.commit.trim().is_empty() {
                return Some(manifest.commit);
            }
        }
    }
    None
}

#[tauri::command]
fn check_app_update() -> Result<AppUpdateStatus, String> {
    let url = format!("{}/app-manifest.json", RELEASE_BASE_URL);
    let bytes = curl_get_bytes(&url, None)?;
    let rem: AppManifestRemote = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
    let compiled_commit = APP_BUILD_COMMIT.to_string();
    let saved_commit = read_saved_local_app_commit().unwrap_or_default();

    let is_up_to_date = rem.commit.is_empty()
        || compiled_commit == "local"
        || commits_match(&compiled_commit, &rem.commit)
        || commits_match(&saved_commit, &rem.commit);

    let effective_local = if is_up_to_date && !rem.commit.is_empty() {
        rem.commit.clone()
    } else if !saved_commit.is_empty() {
        saved_commit
    } else {
        compiled_commit
    };

    Ok(AppUpdateStatus {
        localCommit: effective_local,
        remoteCommit: rem.commit,
        version: rem.version,
        updateAvailable: !is_up_to_date,
        coreSizeMb: ((rem.coreSizeBytes.max(4_000_000) as f64 / (1024.0 * 1024.0)) * 100.0).round()
            / 100.0,
    })
}

/// Downloads ONLY Docx-core.exe (~4 MB) from GitHub Releases into %TEMP%, splices the existing
/// DOCXPACK documentation trailer from the current executable onto it (so zero documentation bytes
/// are re-downloaded!), replaces Docx.exe in-place without creating Docx.old.exe on Desktop,
/// and automatically restarts Docx.exe!
#[tauri::command]
async fn self_update_app(
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    #[cfg(not(all(desktop, target_os = "windows")))]
    {
        let _ = (window, state);
        return Err("App core self-update is only supported on Windows desktop.".to_string());
    }
    #[cfg(all(desktop, target_os = "windows"))]
    {
    let store = Arc::clone(&state.store);
    tauri::async_runtime::spawn_blocking(move || {
        use std::os::windows::process::CommandExt;
        use tauri::Emitter;

        let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
        let _ = fs::remove_file(exe_path.with_extension("old.exe"));
        let _ = fs::remove_file(exe_path.with_extension("new.exe"));
        let _ = fs::remove_file("C:/Users/vahid/OneDrive/Desktop/Docx.old.exe");
        let _ = fs::remove_file("C:/Users/vahid/OneDrive/Desktop/Docx.new.exe");

        let temp_dir = std::env::temp_dir();
        let tmp_core_path = temp_dir.join("Docx_core_dl.tmp");
        let staged_exe_path = temp_dir.join("Docx_staged_update.exe");

        // Fetch and persist remote app-manifest.json so check_app_update knows we are up to date after restart
        let manifest_url = format!("{}/app-manifest.json", RELEASE_BASE_URL);
        if let Ok(manifest_bytes) = curl_get_bytes(&manifest_url, None) {
            let packs_dir = get_packs_dir();
            let _ = fs::create_dir_all(&packs_dir);
            let _ = fs::write(packs_dir.join("app-manifest.local.json"), &manifest_bytes);
        }

        let core_url = format!("{}/Docx-core.exe", RELEASE_BASE_URL);
        let mut new_exe_bytes = curl_download_with_progress(
            &core_url,
            &tmp_core_path,
            4 * 1024 * 1024,
            "docx_app_core",
            &window,
        )?;
        let _ = fs::remove_file(&tmp_core_path);
        let core_dl_mb = new_exe_bytes.len() as f64 / (1024.0 * 1024.0);

        let _ = window.emit(
            "docpack-progress",
            DownloadProgressPayload {
                site_id: "docx_app_core".to_string(),
                phase: "Preserving Embedded Docs...".to_string(),
                downloaded_bytes: new_exe_bytes.len(),
                total_bytes: new_exe_bytes.len(),
                percent: 96,
                detail: "Splicing local DOCXPACK trailer onto new app core...".to_string(),
            },
        );

        let mut trailer_payload: Vec<u8> = Vec::new();
        let guard = store.overrides.read().unwrap();
        for pack in guard.values() {
            if let Some(bytes) = pack.read_full_pack_bytes() {
                let len = bytes.len() as u32;
                trailer_payload.extend_from_slice(&len.to_le_bytes());
                trailer_payload.extend_from_slice(&bytes);
            }
        }
        drop(guard);

        if !trailer_payload.is_empty() {
            let trailer_len = trailer_payload.len() as u64;
            new_exe_bytes.extend_from_slice(&trailer_payload);
            new_exe_bytes.extend_from_slice(&trailer_len.to_le_bytes());
            new_exe_bytes.extend_from_slice(TRAILER_MAGIC);
        }

        fs::write(&staged_exe_path, &new_exe_bytes)
            .map_err(|e| format!("Failed to stage updated Docx.exe in TEMP: {}", e))?;

        // Write a hidden background updater script in %TEMP% that waits for process exit,
        // overwrites Docx.exe in-place (zero .old.exe files!), and immediately relaunches Docx.exe
        let updater_cmd_path = temp_dir.join("docx_apply_update.cmd");
        let staged_str = staged_exe_path.to_string_lossy().replace('/', "\\");
        let target_str = exe_path.to_string_lossy().replace('/', "\\");
        let script_content = format!(
            "@echo off\r\n\
             ping 127.0.0.1 -n 2 -w 250 >nul 2>&1\r\n\
             for /L %%i in (1,1,30) do (\r\n\
               move /Y \"{staged}\" \"{target}\" >nul 2>&1\r\n\
               if not exist \"{staged}\" goto done\r\n\
               copy /Y \"{staged}\" \"{target}\" >nul 2>&1 && del /F /Q \"{staged}\" >nul 2>&1\r\n\
               if not exist \"{staged}\" goto done\r\n\
               ping 127.0.0.1 -n 2 -w 200 >nul 2>&1\r\n\
             )\r\n\
             :done\r\n\
             del /F /Q \"C:\\Users\\vahid\\OneDrive\\Desktop\\Docx.old.exe\" >nul 2>&1\r\n\
             del /F /Q \"C:\\Users\\vahid\\OneDrive\\Desktop\\Docx.new.exe\" >nul 2>&1\r\n\
             start \"\" \"{target}\"\r\n\
             del /F /Q \"%~f0\" >nul 2>&1\r\n",
            staged = staged_str,
            target = target_str
        );
        let _ = fs::write(&updater_cmd_path, script_content);

        let _ = window.emit(
            "docpack-progress",
            DownloadProgressPayload {
                site_id: "docx_app_core".to_string(),
                phase: "Restarting...".to_string(),
                downloaded_bytes: new_exe_bytes.len(),
                total_bytes: new_exe_bytes.len(),
                percent: 100,
                detail: format!(
                    "Updated ({:.2} MB core + {:.2} MB docs). Restarting Docx automatically...",
                    core_dl_mb,
                    trailer_payload.len() as f64 / (1024.0 * 1024.0)
                ),
            },
        );

        let _ = std::process::Command::new("cmd.exe")
            .args(["/C", &updater_cmd_path.to_string_lossy()])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .spawn();

        thread::spawn(|| {
            thread::sleep(Duration::from_millis(250));
            std::process::exit(0);
        });

        Ok(format!(
            "Updated App Core ({:.2} MB) in-place! Restarting Docx automatically...",
            core_dl_mb
        ))
    })
    .await
    .map_err(|e| e.to_string())?
    }
}

#[tauri::command]
fn get_system_theme(window: tauri::Window) -> String {
    match window.theme() {
        Ok(tauri::Theme::Light) => "light".to_string(),
        Ok(tauri::Theme::Dark) => "dark".to_string(),
        _ => "dark".to_string(),
    }
}

#[tauri::command]
fn window_minimize(window: tauri::Window) {
    #[cfg(desktop)]
    let _ = window.minimize();
    #[cfg(not(desktop))]
    let _ = window;
}

#[tauri::command]
fn window_toggle_maximize(window: tauri::Window) {
    #[cfg(desktop)]
    {
        if window.is_maximized().unwrap_or(false) {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
    }
    #[cfg(not(desktop))]
    let _ = window;
}

#[tauri::command]
fn window_toggle_fullscreen(window: tauri::Window) -> bool {
    #[cfg(desktop)]
    {
        let is_fs = window.is_fullscreen().unwrap_or(false);
        let next_fs = !is_fs;
        if next_fs {
            if window.is_maximized().unwrap_or(false) {
                let _ = window.unmaximize();
            }
            let _ = window.set_fullscreen(true);
        } else {
            let _ = window.set_fullscreen(false);
            let _ = window.maximize();
        }
        next_fs
    }
    #[cfg(not(desktop))]
    {
        let _ = window;
        false
    }
}

#[tauri::command]
fn window_close(window: tauri::Window) {
    let _ = window.close();
    #[cfg(desktop)]
    std::process::exit(0);
}

#[tauri::command]
fn window_start_dragging(window: tauri::Window) {
    #[cfg(desktop)]
    let _ = window.start_dragging();
    #[cfg(not(desktop))]
    let _ = window;
}

#[tauri::command]
fn window_show_ready(window: tauri::Window) {
    #[cfg(desktop)]
    {
        if !window.is_maximized().unwrap_or(false) {
            let _ = window.maximize();
        }
    }
    let _ = window.show();
    let _ = window.set_focus();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri::Manager;

    // Terminate any previous lingering Docx.exe instance before WebView2 locks EBWebView
    #[cfg(target_os = "windows")]
    {
        let my_pid = std::process::id();
        let mut kill_cmd = Command::new("taskkill");
        kill_cmd
            .args(["/F", "/FI", &format!("PID ne {}", my_pid), "/IM", "Docx.exe"])
            .creation_flags(0x08000000);
        let _ = kill_cmd.output();
    }

    #[cfg(target_os = "windows")]
    {
        let _ = fs::remove_file("C:/Users/vahid/OneDrive/Desktop/Docx.old.exe");
        let _ = fs::remove_file("C:/Users/vahid/OneDrive/Desktop/Docx.new.exe");
        if let Ok(exe) = std::env::current_exe() {
            let _ = fs::remove_file(exe.with_extension("old.exe"));
            let _ = fs::remove_file(exe.with_extension("new.exe"));
        }
    }

    let store = load_asset_store();
    let tailwind_port = ensure_site_server("tailwind", Arc::clone(&store));
    let shadcn_port = ensure_site_server("shadcn", Arc::clone(&store));

    // Also start servers for any additional installed .docpack overrides
    let extra_ids: Vec<String> = store
        .overrides
        .read()
        .unwrap()
        .keys()
        .filter(|k| *k != "tailwind" && *k != "shadcn")
        .cloned()
        .collect();
    for id in extra_ids {
        ensure_site_server(&id, Arc::clone(&store));
    }

    let store_clone = Arc::clone(&store);
    tauri::Builder::default()
        .manage(AppState {
            tailwind_port,
            shadcn_port,
            store,
        })
        .on_window_event(|_win, event| {
            if let tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed = event
            {
                std::process::exit(0);
            }
        })
        .setup(move |app| {
            #[cfg(mobile)]
            {
                use tauri::Manager;
                if let Ok(app_dir) = app.path().app_data_dir() {
                    set_packs_dir(app_dir.join("docx"));
                }
            }
            // Re-scan verified packs_dir to ensure any previously downloaded packs are fully loaded
            {
                let mut guard = store_clone.overrides.write().unwrap();
                load_disk_overrides(&mut guard);
            }
            let extra_ids: Vec<String> = store_clone
                .overrides
                .read()
                .unwrap()
                .keys()
                .filter(|k| *k != "tailwind" && *k != "shadcn")
                .cloned()
                .collect();
            for id in extra_ids {
                ensure_site_server(&id, Arc::clone(&store_clone));
            }
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_background_color(Some(tauri::window::Color(0, 0, 0, 255)));
                #[cfg(desktop)]
                {
                    if let Some(icon) = app.default_window_icon().cloned() {
                        let _ = win.set_icon(icon);
                    } else if let Ok(icon) =
                        tauri::image::Image::from_bytes(include_bytes!("../icons/icon.png"))
                    {
                        let _ = win.set_icon(icon);
                    }
                    let _ = win.maximize();

                    // Fallback in case frontend invoke is delayed
                    let win_clone = win.clone();
                    thread::spawn(move || {
                        thread::sleep(Duration::from_millis(380));
                        let _ = win_clone.show();
                    });
                }
                #[cfg(mobile)]
                {
                    let _ = win.show();
                }
            }
            Ok(())
        })
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            check_servers,
            start_tailwind_server,
            start_shadcn_server,
            get_installed_packs,
            fetch_remote_registry,
            ensure_site_server_cmd,
            simulate_outdated_pack,
            get_extra_search_entries,
            install_or_update_from_github,
            test_partial_delta_update,
            bundle_into_single_exe,
            delete_docpack,
            check_app_update,
            self_update_app,
            get_system_theme,
            window_minimize,
            window_toggle_maximize,
            window_toggle_fullscreen,
            window_close,
            window_start_dragging,
            window_show_ready,
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}

