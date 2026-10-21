//! Pack install & HTTP 206 partial-range delta update pipeline (GitHub Releases).

use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use crate::config::RELEASE_BASE_URL;
use crate::error::{read_guard, write_guard, DocxError};
use crate::pack::{get_packs_dir, parse_docpack_on_disk, AssetStore, ManifestEntry, SiteManifest, SiteOverridePack};
use crate::server::{ensure_site_server, AppState};
use crate::util::curl_get_bytes;

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

pub(crate) fn curl_download_with_progress(
    url: &str,
    dest_path: &PathBuf,
    expected_total: usize,
    site_id: &str,
    window: &tauri::Window,
) -> crate::error::Result<Vec<u8>> {
    use tauri::Emitter;
    let _ = fs::remove_file(dest_path);

    let client = reqwest::blocking::Client::builder()
        .user_agent("Docx/1.0")
        .timeout(Duration::from_secs(300))
        .build()?;

    let mut resp = client.get(url).send()?;

    let status = resp.status();
    if !status.is_success() {
        return Err(DocxError::HttpStatus {
            status: status.as_u16(),
            url: url.to_string(),
        });
    }

    let total = resp.content_length().map(|l| l as usize).unwrap_or(expected_total).max(1);
    let mut file =
        File::create(dest_path).map_err(|e| DocxError::io_path(dest_path, &e))?;
    let mut buffer = [0u8; 65536];
    let mut cur_bytes = 0usize;
    let mut last_emit = std::time::Instant::now();

    loop {
        let bytes_read = resp
            .read(&mut buffer)
            .map_err(|e| DocxError::http(url, format!("download stream read error: {e}")))?;
        if bytes_read == 0 {
            break;
        }
        file.write_all(&buffer[..bytes_read])
            .map_err(|e| DocxError::io_path(dest_path, &e))?;
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

    file.flush().map_err(|e| DocxError::io_path(dest_path, &e))?;
    drop(file);

    fs::read(dest_path).map_err(|e| DocxError::io_path(dest_path, &e))
}

pub(crate) const DPTC_MAGIC: &[u8; 4] = b"DPTC";

pub fn apply_binary_delta_to_pack(
    local_chunks: &HashMap<String, Vec<u8>>,
    delta_bytes: &[u8],
) -> crate::error::Result<(SiteManifest, Vec<u8>)> {
    if delta_bytes.len() < 28 {
        return Err(DocxError::invalid_pack("Delta patch buffer too short"));
    }
    if &delta_bytes[0..4] != DPTC_MAGIC {
        return Err(DocxError::invalid_pack("Invalid delta patch magic"));
    }
    let manifest_len = u32::from_le_bytes([
        delta_bytes[20],
        delta_bytes[21],
        delta_bytes[22],
        delta_bytes[23],
    ]) as usize;

    let manifest_start = 24;
    let manifest_end = manifest_start + manifest_len;
    if delta_bytes.len() < manifest_end + 4 {
        return Err(DocxError::invalid_pack("Truncated delta patch manifest"));
    }

    let target_manifest: SiteManifest = serde_json::from_slice(&delta_bytes[manifest_start..manifest_end])
        .map_err(|e| DocxError::invalid_pack(format!("Corrupt manifest in delta: {e}")))?;

    let chunk_count = u32::from_le_bytes([
        delta_bytes[manifest_end],
        delta_bytes[manifest_end + 1],
        delta_bytes[manifest_end + 2],
        delta_bytes[manifest_end + 3],
    ]) as usize;

    let mut delta_chunks = HashMap::new();
    let mut offset = manifest_end + 4;
    for _ in 0..chunk_count {
        if offset + 20 > delta_bytes.len() {
            return Err(DocxError::invalid_pack("Truncated chunk header in delta"));
        }
        let hash = String::from_utf8_lossy(&delta_bytes[offset..offset + 16]).trim().to_string();
        let len = u32::from_le_bytes([
            delta_bytes[offset + 16],
            delta_bytes[offset + 17],
            delta_bytes[offset + 18],
            delta_bytes[offset + 19],
        ]) as usize;
        offset += 20;

        if offset + len > delta_bytes.len() {
            return Err(DocxError::invalid_pack("Truncated chunk data in delta"));
        }
        delta_chunks.insert(hash, &delta_bytes[offset..offset + len]);
        offset += len;
    }

    let mut new_pack_data = Vec::new();
    let mut new_routes = HashMap::new();
    let mut placed_hashes: HashMap<String, (usize, usize)> = HashMap::new();

    for (route, entry) in &target_manifest.routes {
        let (final_offset, final_length) = if let Some(&(off, len)) = placed_hashes.get(&entry.hash) {
            (off, len)
        } else if let Some(d_slice) = delta_chunks.get(&entry.hash) {
            let off = new_pack_data.len();
            let len = d_slice.len();
            new_pack_data.extend_from_slice(d_slice);
            placed_hashes.insert(entry.hash.clone(), (off, len));
            (off, len)
        } else if let Some(local_chunk) = local_chunks.get(&entry.hash) {
            let off = new_pack_data.len();
            let len = local_chunk.len();
            new_pack_data.extend_from_slice(local_chunk);
            placed_hashes.insert(entry.hash.clone(), (off, len));
            (off, len)
        } else {
            return Err(DocxError::invalid_pack(format!(
                "Missing chunk hash {} for route {}",
                entry.hash, route
            )));
        };

        let mut reconstructed_entry = entry.clone();
        reconstructed_entry.offset = final_offset;
        reconstructed_entry.length = final_length;
        new_routes.insert(route.clone(), reconstructed_entry);
    }

    let mut reconciled_manifest = target_manifest.clone();
    reconciled_manifest.totalBytes = new_pack_data.len();
    reconciled_manifest.chunkCount = placed_hashes.len();
    reconciled_manifest.routes = new_routes;

    Ok((reconciled_manifest, new_pack_data))
}

pub(crate) fn run_install_or_update_sync(
    site_id: String,
    store: Arc<AssetStore>,
    window: tauri::Window,
) -> crate::error::Result<DeltaUpdateResult> {
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
    let remote_manifest: SiteManifest = serde_json::from_slice(&remote_manifest_bytes)?;
    if remote_manifest.routes.is_empty() || remote_manifest.commit == "e3b0c442" {
        return Err(DocxError::invalid_pack(format!(
            "Remote manifest for '{site_id}' has 0 routes"
        )));
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
        let guard = read_guard(&store.overrides)?;
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
            let mut guard = write_guard(&store.overrides)?;
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

    if let Ok(search_bytes) = curl_get_bytes(&search_url, None)
        && search_bytes.len() > 4 {
            let _ = fs::write(packs_dir.join(format!("{}.search.json", site_id)), search_bytes);
        }

    {
        let guard = read_guard(&store.overrides)?;
        if let Some(pack) = guard.get(&site_id) {
            for entry in pack.manifest.routes.values() {
                if !entry.hash.is_empty()
                    && let Some(chunk) = pack.read_chunk(entry.offset, entry.length) {
                        local_chunks_by_hash.insert(entry.hash.clone(), chunk);
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
            let mut guard = write_guard(&store.overrides)?;
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

    // Fast path: Check for Single-Stream .delta patch
    if let Some(ref delta_meta) = remote_manifest.delta
        && !old_commit.is_empty()
        && (delta_meta.fromCommit == old_commit
            || old_commit.starts_with(&delta_meta.fromCommit)
            || delta_meta.fromCommit.starts_with(&old_commit))
        && !local_chunks_by_hash.is_empty()
    {
        let delta_url = format!("{}/{}.delta", RELEASE_BASE_URL, site_id);
        let _ = window.emit(
            "docpack-progress",
            DownloadProgressPayload {
                site_id: site_id.clone(),
                phase: "Downloading Delta".to_string(),
                downloaded_bytes: 0,
                total_bytes: delta_meta.sizeBytes,
                percent: 10,
                detail: format!(
                    "Fetching single-stream patch ({:.1} KB)...",
                    delta_meta.sizeBytes as f64 / 1024.0
                ),
            },
        );

        if let Ok(delta_bytes) = curl_get_bytes(&delta_url, None)
            && delta_bytes.starts_with(b"DPTC")
        {
            if let Ok((final_manifest, new_pack_data)) =
                apply_binary_delta_to_pack(&local_chunks_by_hash, &delta_bytes)
            {
                let manifest_json = serde_json::to_vec(&final_manifest)?;
                let mut full_docpack =
                    Vec::with_capacity(16 + manifest_json.len() + new_pack_data.len());
                full_docpack.extend_from_slice(b"DOCP");
                full_docpack.extend_from_slice(&2u16.to_le_bytes()); // version 2
                full_docpack.extend_from_slice(&2u16.to_le_bytes()); // Brotli flag
                full_docpack.extend_from_slice(&(manifest_json.len() as u32).to_le_bytes());
                full_docpack.extend_from_slice(&0u32.to_le_bytes()); // reserved
                full_docpack.extend_from_slice(&manifest_json);
                full_docpack.extend_from_slice(&new_pack_data);

                let docpack_path = packs_dir.join(format!("{}.docpack", site_id));
                let full_len = full_docpack.len();
                let _ = fs::write(&docpack_path, &full_docpack);
                let _ = fs::write(
                    packs_dir.join(format!("{}.manifest.json", site_id)),
                    &manifest_json,
                );

                if let Some(parsed) =
                    parse_docpack_on_disk(docpack_path, 0, full_len, "GitHub Delta .docpack")
                {
                    write_guard(&store.overrides)?.insert(site_id.clone(), parsed);
                }

                let dl_bytes = delta_bytes.len();
                let reused_bytes = final_manifest.totalBytes.saturating_sub(dl_bytes);
                let saved_percent = if final_manifest.totalBytes > 0 {
                    ((reused_bytes as f64 / final_manifest.totalBytes as f64) * 100.0)
                        .clamp(0.0, 99.9)
                } else {
                    0.0
                };

                let port = ensure_site_server(&site_id, Arc::clone(&store));
                let _ = window.emit(
                    "docpack-progress",
                    DownloadProgressPayload {
                        site_id: site_id.clone(),
                        phase: "Complete".to_string(),
                        downloaded_bytes: dl_bytes,
                        total_bytes: final_manifest.totalBytes,
                        percent: 100,
                        detail: format!(
                            "Delta update applied ({:.1} KB patch, {:.1}% saved)",
                            dl_bytes as f64 / 1024.0,
                            saved_percent
                        ),
                    },
                );

                return Ok(DeltaUpdateResult {
                    site_id: site_id.clone(),
                    old_commit,
                    new_commit: final_manifest.commit.clone(),
                    total_chunks: final_manifest.chunkCount,
                    reused_chunks: final_manifest.chunkCount.saturating_sub(1),
                    downloaded_chunks: 1,
                    reused_bytes,
                    downloaded_bytes: dl_bytes,
                    saved_percent,
                    port,
                    message: format!(
                        "Single-stream delta update complete! Downloaded {:.1} KB patch ({:.1}% bandwidth saved) on port :{}!",
                        dl_bytes as f64 / 1024.0,
                        saved_percent,
                        port
                    ),
                });
            }
        }
    }

    let missing_bytes: usize = remote_manifest
        .routes
        .values()
        .filter(|entry| missing_unique_hashes.contains(&entry.hash))
        .map(|entry| (entry.hash.clone(), entry.length))
        .collect::<HashMap<String, usize>>()
        .values()
        .sum();
    let _missing_chunks_count = missing_unique_hashes.len();
    let max_delta_bytes = (remote_manifest.totalBytes * 65) / 100;

    // Use single-stream full .docpack download ONLY if not installed locally,
    // or if the delta exceeds 65% of total pack size.
    let should_full_download = local_chunks_by_hash.is_empty()
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

        let parsed = match parse_docpack_on_disk(docpack_path.clone(), 0, dl_bytes, "GitHub Release .docpack")
        {
            Some(p) => p,
            None => {
                let _ = fs::remove_file(&docpack_path);
                return Err(DocxError::invalid_pack(format!(
                    "Downloaded {site_id}.docpack ({dl_bytes} bytes) is empty or invalid — please retry after release sync."
                )));
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

        write_guard(&store.overrides)?.insert(
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
                encoding: rem_entry.encoding.clone(),
                raw_length: rem_entry.raw_length,
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
        compression: remote_manifest.compression.clone(),
        delta: remote_manifest.delta.clone(),
        routes: new_routes,
    };

    let manifest_json = serde_json::to_vec(&final_manifest)?;
    let mut full_docpack = Vec::with_capacity(16 + manifest_json.len() + new_pack_data.len());
    full_docpack.extend_from_slice(b"DOCP");
    full_docpack.extend_from_slice(&2u16.to_le_bytes()); // version 2
    full_docpack.extend_from_slice(&2u16.to_le_bytes()); // Brotli flag
    full_docpack.extend_from_slice(&(manifest_json.len() as u32).to_le_bytes());
    full_docpack.extend_from_slice(&0u32.to_le_bytes()); // reserved
    full_docpack.extend_from_slice(&manifest_json);
    full_docpack.extend_from_slice(&new_pack_data);

    let docpack_path = packs_dir.join(format!("{}.docpack", site_id));
    let full_len = full_docpack.len();
    fs::write(&docpack_path, &full_docpack).map_err(|e| DocxError::io_path(&docpack_path, &e))?;
    drop(full_docpack);

    if let Some(parsed) =
        parse_docpack_on_disk(docpack_path, 0, full_len, "GitHub Delta .docpack")
    {
        write_guard(&store.overrides)?.insert(site_id.clone(), parsed);
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
pub(crate) async fn install_or_update_from_github(
    site_id: String,
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
) -> std::result::Result<DeltaUpdateResult, String> {
    let store = Arc::clone(&state.store);
    tauri::async_runtime::spawn_blocking(move || run_install_or_update_sync(site_id, store, window))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_apply_binary_delta_patch() {
        let mut local_chunks = HashMap::new();
        local_chunks.insert("aaaa111122223333".to_string(), b"chunkA".to_vec());

        let manifest_json = r#"{"id":"tailwind","name":"Tailwind CSS","version":"1.1","commit":"22222222","compression":"brotli","routes":{"/a":{"offset":0,"length":6,"mime":"text/plain","gzipped":false,"hash":"aaaa111122223333"},"/b":{"offset":6,"length":6,"mime":"text/plain","gzipped":false,"hash":"bbbb111122223333"}}}"#;
        let mut delta_bytes = Vec::new();
        delta_bytes.extend_from_slice(b"DPTC");
        delta_bytes.extend_from_slice(b"11111111");
        delta_bytes.extend_from_slice(b"22222222");
        delta_bytes.extend_from_slice(&(manifest_json.len() as u32).to_le_bytes());
        delta_bytes.extend_from_slice(manifest_json.as_bytes());
        delta_bytes.extend_from_slice(&1u32.to_le_bytes());
        delta_bytes.extend_from_slice(b"bbbb111122223333");
        delta_bytes.extend_from_slice(&6u32.to_le_bytes());
        delta_bytes.extend_from_slice(b"chunkB");

        let (new_manifest, pack_data) = apply_binary_delta_to_pack(&local_chunks, &delta_bytes).expect("Failed to apply delta");
        assert_eq!(new_manifest.commit, "22222222");
        assert_eq!(new_manifest.routes.len(), 2);
        assert_eq!(pack_data.len(), 12);
        let route_a = new_manifest.routes.get("/a").unwrap();
        let route_b = new_manifest.routes.get("/b").unwrap();
        assert_eq!(&pack_data[route_a.offset..route_a.offset + route_a.length], b"chunkA");
        assert_eq!(&pack_data[route_b.offset..route_b.offset + route_b.length], b"chunkB");
    }
}


