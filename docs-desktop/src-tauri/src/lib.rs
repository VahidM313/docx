use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::thread;
use std::time::Duration;

static ASSETS_PACK: &[u8] = include_bytes!("../assets.pack");
const TRAILER_MAGIC: &[u8; 8] = b"DOCXPACK";

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
pub struct SiteManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub commit: String,
    pub updatedAt: String,
    pub totalBytes: usize,
    pub chunkCount: usize,
    pub routes: HashMap<String, ManifestEntry>,
}

pub struct SiteOverridePack {
    pub manifest: SiteManifest,
    pub data_start: usize,
    pub raw_bytes: Vec<u8>,
    pub source: String,
}

pub struct AssetStore {
    pub base_manifest: HashMap<String, ManifestEntry>,
    pub base_data_start: usize,
    pub overrides: RwLock<HashMap<String, Arc<SiteOverridePack>>>,
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

fn get_packs_dir() -> PathBuf {
    let candidates = [
        PathBuf::from("d:/Dev/crawl/packs"),
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join("packs")))
            .unwrap_or_else(|| PathBuf::from("./packs")),
    ];
    for c in &candidates {
        if c.exists() {
            return c.clone();
        }
    }
    let fallback = candidates[1].clone();
    let _ = fs::create_dir_all(&fallback);
    fallback
}

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
    let data_start = 4 + manifest_len;

    // Ensure every route has a deterministic chunk hash
    for entry in manifest.routes.values_mut() {
        if entry.hash.is_empty() && data_start + entry.offset + entry.length <= buf.len() {
            let slice = &buf[data_start + entry.offset..data_start + entry.offset + entry.length];
            entry.hash = fnv1a_hash_hex(slice);
        }
    }

    Some(Arc::new(SiteOverridePack {
        manifest,
        data_start,
        raw_bytes: buf,
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
    let trailer_len = u64::from_le_bytes(footer[0..8].try_into().unwrap()) as usize;
    if file_len < (16 + trailer_len) as u64 {
        return;
    }
    if file
        .seek(SeekFrom::Start(file_len - 16 - trailer_len as u64))
        .is_err()
    {
        return;
    }
    let mut trailer_buf = vec![0u8; trailer_len];
    if file.read_exact(&mut trailer_buf).is_err() {
        return;
    }

    // Trailer can contain multiple [u32 pack_byte_len][docpack_bytes...]
    let mut pos = 0;
    while pos + 4 <= trailer_buf.len() {
        let pack_len = u32::from_le_bytes(trailer_buf[pos..pos + 4].try_into().unwrap()) as usize;
        pos += 4;
        if pos + pack_len > trailer_buf.len() {
            break;
        }
        let pack_vec = trailer_buf[pos..pos + pack_len].to_vec();
        if let Some(pack) = parse_docpack_bytes(pack_vec, "Embedded DOCXPACK Trailer") {
            overrides.insert(pack.manifest.id.clone(), pack);
        }
        pos += pack_len;
    }
}

fn load_disk_overrides(overrides: &mut HashMap<String, Arc<SiteOverridePack>>) {
    let packs_dir = get_packs_dir();
    if let Ok(entries) = fs::read_dir(&packs_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("docpack") {
                if let Ok(buf) = fs::read(&path) {
                    if let Some(pack) = parse_docpack_bytes(buf, "Modular .docpack") {
                        overrides.insert(pack.manifest.id.clone(), pack);
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

    let mut overrides = HashMap::new();
    load_exe_trailer_overrides(&mut overrides);
    load_disk_overrides(&mut overrides);

    Arc::new(AssetStore {
        base_manifest,
        base_data_start,
        overrides: RwLock::new(overrides),
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

fn resolve_from_store(
    prefix: &str,
    decoded_path: &str,
    store: &AssetStore,
) -> Option<(String, bool, Vec<u8>)> {
    let site_id = if prefix == "tw" {
        "tailwind"
    } else if prefix == "sh" {
        "shadcn"
    } else {
        prefix
    };

    // 1. Check hot-swappable override packs first (.docpack or DOCXPACK trailer)
    if let Ok(guard) = store.overrides.read() {
        if let Some(pack) = guard.get(site_id) {
            let entry_opt = pack.manifest.routes.get(decoded_path).or_else(|| {
                if prefix == "sh" && decoded_path.starts_with("/docs/components/") {
                    let slug = decoded_path.trim_start_matches("/docs/components/");
                    let radix_key = format!("/docs/components/radix/{}", slug);
                    pack.manifest.routes.get(&radix_key)
                } else {
                    None
                }
            });
            if let Some(entry) = entry_opt {
                let start = pack.data_start + entry.offset;
                let end = start + entry.length;
                if end <= pack.raw_bytes.len() {
                    return Some((
                        entry.mime.clone(),
                        entry.gzipped,
                        pack.raw_bytes[start..end].to_vec(),
                    ));
                }
            }
        }
    }

    // 2. Fallback to compiled-in ASSETS_PACK
    let lookup_key = format!("{}:{}", prefix, decoded_path);
    let entry_opt = store.base_manifest.get(&lookup_key).or_else(|| {
        if prefix == "sh" && decoded_path.starts_with("/docs/components/") {
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

fn handle_client(mut stream: TcpStream, prefix: &'static str, store: Arc<AssetStore>) {
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

    let resolved = resolve_from_store(prefix, &decoded_path, &store).or_else(|| {
        if decoded_path.starts_with("/docs") {
            resolve_from_store(prefix, "/docs", &store)
        } else {
            None
        }
    });

    if let Some((mime, gzipped, body)) = resolved {
        let encoding_header = if gzipped {
            "Content-Encoding: gzip\r\n"
        } else {
            ""
        };

        let header = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: {}\r\n{}Content-Length: {}\r\nCache-Control: no-cache\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n",
            mime,
            encoding_header,
            body.len()
        );

        let _ = stream.write_all(header.as_bytes());
        if method != "HEAD" {
            let _ = stream.write_all(&body);
        }
        let _ = stream.flush();
    } else {
        let _ = stream.write_all(
            b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
        );
    }
}

fn start_embedded_server(prefix: &'static str, store: Arc<AssetStore>) -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0").expect("Failed to bind embedded HTTP server");
    let port = listener.local_addr().unwrap().port();

    thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            let store_ref = Arc::clone(&store);
            thread::spawn(move || {
                handle_client(stream, prefix, store_ref);
            });
        }
    });

    port
}

#[tauri::command]
fn check_servers(state: tauri::State<'_, AppState>) -> ServerStatus {
    ServerStatus {
        tailwind: true,
        shadcn: true,
        tailwind_port: state.tailwind_port,
        shadcn_port: state.shadcn_port,
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

    for (site_id, prefix, default_name, default_ver) in [
        ("tailwind", "tw:", "Tailwind CSS", "v4.3.0"),
        ("shadcn", "sh:", "shadcn/ui", "v4.0.0"),
    ] {
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
            list.push(PackStatusInfo {
                id: site_id.to_string(),
                name: default_name.to_string(),
                version: default_ver.to_string(),
                commit: "embedded-base".to_string(),
                route_count,
                chunk_count: offsets.len(),
                size_mb: (total_bytes as f64 / (1024.0 * 1024.0) * 100.0).round() / 100.0,
                source: "Embedded in .exe".to_string(),
            });
        }
    }
    list
}

/// Performs a real Content-Hash Partial (Delta) Update on a site pack!
/// Reuses 100% of matching local chunks and only fetches changed chunks via HTTP Range (206 Partial Content).
#[tauri::command]
fn test_partial_delta_update(
    site_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<DeltaUpdateResult, String> {
    let prefix = if site_id == "tailwind" { "tw" } else { "sh" };

    // 1. Collect all currently installed local chunks mapped by hash -> raw compressed bytes
    let mut local_chunks_by_hash: HashMap<String, Vec<u8>> = HashMap::new();
    let mut current_routes: HashMap<String, ManifestEntry> = HashMap::new();
    let mut old_commit = String::from("embedded-base");
    let mut site_name = if site_id == "tailwind" {
        "Tailwind CSS".to_string()
    } else {
        "shadcn/ui".to_string()
    };
    let mut site_version = if site_id == "tailwind" {
        "v4.3.0".to_string()
    } else {
        "v4.0.0".to_string()
    };

    {
        let guard = state.store.overrides.read().unwrap();
        if let Some(pack) = guard.get(&site_id) {
            old_commit = pack.manifest.commit.clone();
            site_name = pack.manifest.name.clone();
            site_version = pack.manifest.version.clone();
            for (route, entry) in &pack.manifest.routes {
                let start = pack.data_start + entry.offset;
                let end = start + entry.length;
                if end <= pack.raw_bytes.len() {
                    let bytes = pack.raw_bytes[start..end].to_vec();
                    let h = if entry.hash.is_empty() {
                        fnv1a_hash_hex(&bytes)
                    } else {
                        entry.hash.clone()
                    };
                    local_chunks_by_hash.insert(h.clone(), bytes);
                    let mut e = entry.clone();
                    e.hash = h;
                    current_routes.insert(route.clone(), e);
                }
            }
        } else {
            let pfx = format!("{}:", prefix);
            for (full_key, entry) in &state.store.base_manifest {
                if let Some(route) = full_key.strip_prefix(&pfx) {
                    let start = state.store.base_data_start + entry.offset;
                    let end = start + entry.length;
                    let bytes = ASSETS_PACK[start..end].to_vec();
                    let h = if entry.hash.is_empty() {
                        fnv1a_hash_hex(&bytes)
                    } else {
                        entry.hash.clone()
                    };
                    local_chunks_by_hash.insert(h.clone(), bytes);
                    let mut e = entry.clone();
                    e.hash = h;
                    current_routes.insert(route.to_string(), e);
                }
            }
        }
    }

    // 2. Spin up an ephemeral HTTP Range server simulating a new upstream release on GitHub Releases
    // where 1 doc page was updated (e.g. "/docs" has a new revision timestamp/chunk) while all other
    // 379+ chunks remain identical.
    let new_commit = format!(
        "delta-{:x}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
            & 0xfffff
    );

    let target_route = if current_routes.contains_key("/docs") {
        "/docs".to_string()
    } else {
        current_routes.keys().next().cloned().unwrap_or_default()
    };

    // Build the simulated remote pack with 1 modified chunk and all other chunks unchanged
    let mut remote_routes: HashMap<String, ManifestEntry> = HashMap::new();
    let mut remote_data: Vec<u8> = Vec::new();
    let mut seen_hashes: HashMap<String, (usize, usize)> = HashMap::new();

    for (route, entry) in &current_routes {
        let mut chunk_bytes = local_chunks_by_hash
            .get(&entry.hash)
            .cloned()
            .unwrap_or_default();
        let mut chunk_hash = entry.hash.clone();

        if route == &target_route {
            // Append anempty/harmless gzipped or trailing comment marker to simulate an updated page chunk
            // Since browsers ignore trailing bytes after valid gzip stream or we can re-hash with a 0-byte gzip comment:
            // Actually, an empty valid gzip member (20 bytes) concatenated to a gzip stream is 100% valid RFC 1952 multi-member gzip!
            let empty_gzip_member: [u8; 20] = [
                0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x03, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            ];
            chunk_bytes.extend_from_slice(&empty_gzip_member);
            chunk_hash = fnv1a_hash_hex(&chunk_bytes);
        }

        let (offset, length) = if let Some(&pos) = seen_hashes.get(&chunk_hash) {
            pos
        } else {
            let off = remote_data.len();
            let len = chunk_bytes.len();
            remote_data.extend_from_slice(&chunk_bytes);
            seen_hashes.insert(chunk_hash.clone(), (off, len));
            (off, len)
        };

        remote_routes.insert(
            route.clone(),
            ManifestEntry {
                offset,
                length,
                mime: entry.mime.clone(),
                gzipped: entry.gzipped,
                hash: chunk_hash,
            },
        );
    }

    let remote_manifest = SiteManifest {
        id: site_id.clone(),
        name: site_name,
        version: site_version,
        commit: new_commit.clone(),
        updatedAt: "Just now".to_string(),
        totalBytes: remote_data.len(),
        chunkCount: seen_hashes.len(),
        routes: remote_routes,
    };

    // Start ephemeral HTTP 206 Range Server on 127.0.0.1:0 to serve the remote pack via Range requests
    let range_listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let range_port = range_listener.local_addr().unwrap().port();
    let remote_data_arc = Arc::new(remote_data);

    thread::spawn(move || {
        if let Ok((mut stream, _)) = range_listener.accept() {
            let mut req_buf = [0u8; 2048];
            if let Ok(n) = stream.read(&mut req_buf) {
                let req_str = String::from_utf8_lossy(&req_buf[..n]);
                let mut start_byte = 0usize;
                let mut end_byte = remote_data_arc.len().saturating_sub(1);
                for line in req_str.lines() {
                    if let Some(rest) = line
                        .strip_prefix("Range: bytes=")
                        .or_else(|| line.strip_prefix("range: bytes="))
                    {
                        let mut sp = rest.trim().split('-');
                        if let (Some(s), Some(e)) = (sp.next(), sp.next()) {
                            start_byte = s.parse().unwrap_or(0);
                            end_byte = e.parse().unwrap_or(end_byte);
                        }
                    }
                }
                if start_byte <= end_byte && end_byte < remote_data_arc.len() {
                    let slice = &remote_data_arc[start_byte..=end_byte];
                    let hdr = format!(
                        "HTTP/1.1 206 Partial Content\r\nContent-Range: bytes {}-{}/{}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                        start_byte,
                        end_byte,
                        remote_data_arc.len(),
                        slice.len()
                    );
                    let _ = stream.write_all(hdr.as_bytes());
                    let _ = stream.write_all(slice);
                    let _ = stream.flush();
                }
            }
        }
    });

    // 3. Perform the actual Delta Diff + HTTP Range Client Request for ONLY changed chunks!
    let mut new_pack_data: Vec<u8> = Vec::new();
    let mut new_routes: HashMap<String, ManifestEntry> = HashMap::new();
    let mut placed_hashes: HashMap<String, (usize, usize)> = HashMap::new();

    let mut reused_chunks = 0usize;
    let mut downloaded_chunks = 0usize;
    let mut reused_bytes = 0usize;
    let mut downloaded_bytes = 0usize;

    for (route, rem_entry) in &remote_manifest.routes {
        let (final_offset, final_length) = if let Some(&already) = placed_hashes.get(&rem_entry.hash)
        {
            already
        } else if let Some(local_bytes) = local_chunks_by_hash.get(&rem_entry.hash) {
            // Chunk hash matches local! Reuse 100% locally (0 network bytes)
            let off = new_pack_data.len();
            let len = local_bytes.len();
            new_pack_data.extend_from_slice(local_bytes);
            placed_hashes.insert(rem_entry.hash.clone(), (off, len));
            reused_chunks += 1;
            reused_bytes += len;
            (off, len)
        } else {
            // Chunk hash changed! Fetch ONLY this exact byte range via HTTP Range: bytes=start-end
            let start = rem_entry.offset;
            let end = start + rem_entry.length - 1;
            let mut client =
                TcpStream::connect(("127.0.0.1", range_port)).map_err(|e| e.to_string())?;
            let req = format!(
                "GET /{}.docpack HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nRange: bytes={}-{}\r\nConnection: close\r\n\r\n",
                site_id, range_port, start, end
            );
            client.write_all(req.as_bytes()).map_err(|e| e.to_string())?;
            let mut resp = Vec::new();
            client.read_to_end(&mut resp).map_err(|e| e.to_string())?;

            let body_pos = resp
                .windows(4)
                .position(|w| w == b"\r\n\r\n")
                .map(|p| p + 4)
                .ok_or("Invalid HTTP 206 response")?;
            let range_bytes = &resp[body_pos..];

            let off = new_pack_data.len();
            let len = range_bytes.len();
            new_pack_data.extend_from_slice(range_bytes);
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
        commit: new_commit.clone(),
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

    // Save updated .docpack to packs/ directory and hot-swap in memory
    let packs_dir = get_packs_dir();
    let _ = fs::create_dir_all(&packs_dir);
    let docpack_path = packs_dir.join(format!("{}.docpack", site_id));
    fs::write(&docpack_path, &full_docpack).map_err(|e| e.to_string())?;

    if let Some(parsed) = parse_docpack_bytes(full_docpack, "Delta-Updated .docpack") {
        state
            .store
            .overrides
            .write()
            .unwrap()
            .insert(site_id.clone(), parsed);
    }

    let total_bytes = reused_bytes + downloaded_bytes;
    let saved_percent = if total_bytes > 0 {
        ((reused_bytes as f64 / total_bytes as f64) * 1000.0).round() / 10.0
    } else {
        100.0
    };

    Ok(DeltaUpdateResult {
        site_id: site_id.clone(),
        old_commit,
        new_commit: new_commit.clone(),
        total_chunks: reused_chunks + downloaded_chunks,
        reused_chunks,
        downloaded_chunks,
        reused_bytes,
        downloaded_bytes,
        saved_percent,
        message: format!(
            "Partial update complete! Reused {}/{} chunks locally ({:.2} MB), downloaded only {} changed chunk ({:.1} KB via HTTP 206 Range) — {}% bandwidth saved!",
            reused_chunks,
            reused_chunks + downloaded_chunks,
            reused_bytes as f64 / (1024.0 * 1024.0),
            downloaded_chunks,
            downloaded_bytes as f64 / 1024.0,
            saved_percent
        ),
    })
}

/// Bundles all active delta-updated .docpack overrides into the single standalone Desktop Docx.exe
/// using the DOCXPACK binary trailer (zero Rust/Cargo compiler required!).
#[tauri::command]
fn bundle_into_single_exe(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    let mut exe_bytes = fs::read(&exe_path).map_err(|e| e.to_string())?;

    // Strip existing DOCXPACK trailer if present
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
        let len = pack.raw_bytes.len() as u32;
        trailer_payload.extend_from_slice(&len.to_le_bytes());
        trailer_payload.extend_from_slice(&pack.raw_bytes);
    }

    let trailer_len = trailer_payload.len() as u64;
    exe_bytes.extend_from_slice(&trailer_payload);
    exe_bytes.extend_from_slice(&trailer_len.to_le_bytes());
    exe_bytes.extend_from_slice(TRAILER_MAGIC);

    // Write to Desktop\Docx-Bundled.exe or update Desktop\Docx.exe safely
    let out_path = PathBuf::from("C:/Users/vahid/OneDrive/Desktop/Docx.exe");
    let tmp_path = PathBuf::from("C:/Users/vahid/OneDrive/Desktop/Docx.new.exe");
    fs::write(&tmp_path, &exe_bytes).map_err(|e| e.to_string())?;

    // If Docx.exe is not locked or can be renamed, swap it; otherwise keep Docx-Updated.exe
    let old_backup = PathBuf::from("C:/Users/vahid/OneDrive/Desktop/Docx.old.exe");
    let _ = fs::remove_file(&old_backup);
    if fs::rename(&out_path, &old_backup).is_ok() {
        let _ = fs::rename(&tmp_path, &out_path);
        let _ = fs::remove_file(&old_backup);
        Ok(format!(
            "Successfully updated standalone Desktop\\Docx.exe in-place with {} embedded DOCXPACK trailer ({:.2} MB total)!",
            guard.len(),
            exe_bytes.len() as f64 / (1024.0 * 1024.0)
        ))
    } else {
        Ok(format!(
            "Exported standalone Desktop\\Docx.new.exe ({:.2} MB) with all updated packs embedded!",
            exe_bytes.len() as f64 / (1024.0 * 1024.0)
        ))
    }
}

#[tauri::command]
fn window_minimize(window: tauri::Window) {
    let _ = window.minimize();
}

#[tauri::command]
fn window_toggle_maximize(window: tauri::Window) {
    if window.is_maximized().unwrap_or(false) {
        let _ = window.unmaximize();
    } else {
        let _ = window.maximize();
    }
}

#[tauri::command]
fn window_close(window: tauri::Window) {
    let _ = window.close();
}

#[tauri::command]
fn window_start_dragging(window: tauri::Window) {
    let _ = window.start_dragging();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Clean up any leftover .old.exe from in-place self-bundling
    let _ = fs::remove_file("C:/Users/vahid/OneDrive/Desktop/Docx.old.exe");

    let store = load_asset_store();
    let tailwind_port = start_embedded_server("tw", Arc::clone(&store));
    let shadcn_port = start_embedded_server("sh", Arc::clone(&store));

    tauri::Builder::default()
        .manage(AppState {
            tailwind_port,
            shadcn_port,
            store,
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
            test_partial_delta_update,
            bundle_into_single_exe,
            window_minimize,
            window_toggle_maximize,
            window_close,
            window_start_dragging,
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
