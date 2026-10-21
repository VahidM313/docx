//! `.docpack` storage: format parsing, embedded-trailer + on-disk pack discovery,
//! and the shared `AssetStore` used by servers, commands and the updater.

use std::collections::{HashMap, VecDeque};
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::path::PathBuf;
use std::sync::{Arc, RwLock};

use crate::catalog::get_site_origin_and_entry;
use crate::config::TRAILER_MAGIC;
use crate::util::fnv1a_hash_hex;

/// Legacy embedded base manifest — kept wired in until the dead base-asset
/// path is removed in the cleanup pass.
pub(crate) static ASSETS_PACK: &[u8] = b"\x02\x00\x00\x00{}";

#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
pub struct ManifestEntry {
    pub offset: usize,
    pub length: usize,
    pub mime: String,
    pub gzipped: bool,
    #[serde(default)]
    pub hash: String,
    #[serde(default)]
    pub encoding: Option<String>,
    #[serde(default)]
    pub raw_length: Option<usize>,
}

#[derive(serde::Deserialize, serde::Serialize, Clone, Debug, Default)]
#[allow(non_snake_case)]
pub struct DeltaMetadata {
    pub fromCommit: String,
    pub toCommit: String,
    pub sizeBytes: usize,
    #[serde(default)]
    pub hash: String,
}

#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
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
    #[serde(default)]
    pub compression: Option<String>,
    #[serde(default)]
    pub delta: Option<DeltaMetadata>,
    pub routes: HashMap<String, ManifestEntry>,
}

#[derive(Clone)]
pub enum PackBacking {
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
    pub fallback_cache: FallbackCache,
}

/// Small bounded LRU for proxied live-fallback assets.
///
/// This used to be an unbounded `HashMap<String, (String, Vec<u8>)>`: every
/// remote image/font/JS byte a documentation page touched stayed resident for
/// the lifetime of the process. A single image-heavy docs site could pin
/// hundreds of megabytes. Anything above `MAX_ENTRY_BYTES` is streamed and
/// never cached.
pub struct FallbackCache {
    inner: RwLock<FallbackCacheInner>,
}

struct FallbackCacheInner {
    entries: HashMap<String, (String, Vec<u8>)>,
    order: VecDeque<String>,
    bytes: usize,
}

const FALLBACK_CACHE_MAX_BYTES: usize = 12 * 1024 * 1024;
const FALLBACK_CACHE_MAX_ENTRIES: usize = 128;
const FALLBACK_CACHE_MAX_ENTRY_BYTES: usize = 512 * 1024;

impl FallbackCache {
    pub fn new() -> Self {
        Self {
            inner: RwLock::new(FallbackCacheInner {
                entries: HashMap::new(),
                order: VecDeque::new(),
                bytes: 0,
            }),
        }
    }

    pub fn get(&self, key: &str) -> Option<(String, Vec<u8>)> {
        let guard = self.inner.read().ok()?;
        guard
            .entries
            .get(key)
            .map(|(mime, bytes)| (mime.clone(), bytes.clone()))
    }

    pub fn insert(&self, key: String, mime: String, bytes: Vec<u8>) {
        if bytes.is_empty() || bytes.len() > FALLBACK_CACHE_MAX_ENTRY_BYTES {
            return;
        }
        let Ok(mut guard) = self.inner.write() else {
            return;
        };
        if let Some((_, old)) = guard.entries.remove(&key) {
            guard.bytes = guard.bytes.saturating_sub(old.len());
            guard.order.retain(|k| k != &key);
        }
        guard.bytes += bytes.len();
        guard.order.push_back(key.clone());
        guard.entries.insert(key, (mime, bytes));

        while guard.bytes > FALLBACK_CACHE_MAX_BYTES
            || guard.order.len() > FALLBACK_CACHE_MAX_ENTRIES
        {
            let Some(oldest) = guard.order.pop_front() else {
                break;
            };
            if let Some((_, dropped)) = guard.entries.remove(&oldest) {
                guard.bytes = guard.bytes.saturating_sub(dropped.len());
            }
        }
    }
}



static CUSTOM_PACKS_DIR: std::sync::RwLock<Option<PathBuf>> = std::sync::RwLock::new(None);

#[cfg_attr(not(mobile), allow(dead_code))]
pub(crate) fn set_packs_dir(dir: PathBuf) {
    let _ = fs::create_dir_all(&dir);
    if let Ok(mut lock) = CUSTOM_PACKS_DIR.write() {
        *lock = Some(dir);
    }
}

pub(crate) fn get_packs_dir() -> PathBuf {
    if let Ok(lock) = CUSTOM_PACKS_DIR.read()
        && let Some(dir) = lock.as_ref() {
            let _ = fs::create_dir_all(dir);
            return dir.clone();
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
        .unwrap_or_else(std::env::temp_dir);
    let dir = base.join("docx");
    let _ = fs::create_dir_all(&dir);
    dir
}

fn migrate_legacy_packs_to_appdata() {
    #[cfg(desktop)]
    {
        let target_dir = get_packs_dir();
        let mut legacy_dirs: Vec<PathBuf> = Vec::new();
        if let Some(roaming) = std::env::var_os("APPDATA") {
            legacy_dirs.push(PathBuf::from(roaming).join("docx"));
        }
        if let Ok(exe) = std::env::current_exe()
            && let Some(parent) = exe.parent() {
                legacy_dirs.push(parent.join("packs"));
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

pub(crate) const DOCP_MAGIC: &[u8; 4] = b"DOCP";

#[allow(dead_code)]
pub fn decompress_chunk_if_needed(
    data: &[u8],
    encoding: Option<&str>,
    gzipped: bool,
) -> Result<Vec<u8>, std::io::Error> {
    if encoding == Some("br") {
        let mut decompressor = brotli::Decompressor::new(data, 4096);
        let mut out = Vec::new();
        decompressor.read_to_end(&mut out)?;
        Ok(out)
    } else if gzipped {
        let mut decoder = flate2::read::GzDecoder::new(data);
        let mut out = Vec::new();
        decoder.read_to_end(&mut out)?;
        Ok(out)
    } else {
        Ok(data.to_vec())
    }
}

pub(crate) fn parse_docpack_on_disk(
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

    let mut magic_or_len = [0u8; 4];
    file.read_exact(&mut magic_or_len).ok()?;

    let (manifest_len, data_start) = if &magic_or_len == DOCP_MAGIC {
        // Format v2: DOCP (4) + version (2) + flags (2) + manifest_len (4) + reserved (4) = 16 bytes header
        if pack_len < 16 {
            return None;
        }
        let mut v2_hdr = [0u8; 12];
        file.read_exact(&mut v2_hdr).ok()?;
        let version = u16::from_le_bytes([v2_hdr[0], v2_hdr[1]]);
        let _flags = u16::from_le_bytes([v2_hdr[2], v2_hdr[3]]);
        let m_len = u32::from_le_bytes([v2_hdr[4], v2_hdr[5], v2_hdr[6], v2_hdr[7]]) as usize;
        let full_hdr_len = 16usize.checked_add(m_len)?;
        if version != 2 || pack_len < full_hdr_len {
            return None;
        }
        (m_len, full_hdr_len)
    } else {
        // Format v1: manifest_len (4)
        let m_len = u32::from_le_bytes(magic_or_len) as usize;
        let full_hdr_len = 4usize.checked_add(m_len)?;
        if pack_len < full_hdr_len {
            return None;
        }
        (m_len, full_hdr_len)
    };

    let mut manifest_buf = vec![0u8; manifest_len];
    file.read_exact(&mut manifest_buf).ok()?;
    let manifest: SiteManifest = serde_json::from_slice(&manifest_buf).ok()?;
    if manifest.routes.is_empty() || get_site_origin_and_entry(&manifest.id).is_none() {
        return None;
    }

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
    let trailer_len = u64::from_le_bytes(footer[0..8].try_into().expect("footer is always 16 bytes"));
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

pub(crate) fn load_disk_overrides(overrides: &mut HashMap<String, Arc<SiteOverridePack>>) {
    let packs_dir = get_packs_dir();
    if let Ok(entries) = fs::read_dir(&packs_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("docpack")
                && let Ok(meta) = fs::metadata(&path) {
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

pub(crate) fn load_asset_store() -> Arc<AssetStore> {
    // The embedded base manifest is a compile-time stub (doc packs have long
    // since moved to .docpack overrides) — parse defensively so even a corrupt
    // build artifact only degrades to "no base assets" instead of panicking.
    let mut base_manifest: HashMap<String, ManifestEntry> = HashMap::new();
    let mut base_data_start = ASSETS_PACK.len();
    if let Some(len_bytes) = ASSETS_PACK.get(0..4).and_then(|s| <[u8; 4]>::try_from(s).ok()) {
        let manifest_len = u32::from_le_bytes(len_bytes) as usize;
        if let Some(manifest_slice) = ASSETS_PACK.get(4..4 + manifest_len) {
            match serde_json::from_slice(manifest_slice) {
                Ok(m) => {
                    base_data_start = 4 + manifest_len;
                    base_manifest = m;
                }
                Err(e) => {
                    log::error!(
                        "embedded base asset manifest unparsable ({}); continuing without base assets",
                        e
                    );
                }
            }
        }
    }

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
        fallback_cache: FallbackCache::new(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_v2_docpack_header() {
        let manifest_json = r#"{"id":"tailwind","name":"Tailwind CSS","version":"1.0","commit":"abc12345","compression":"brotli","routes":{"/index.html":{"offset":0,"length":10,"mime":"text/html; charset=utf-8","gzipped":false,"encoding":"br","hash":"1234567890abcdef"}}}"#;
        let mut pack_bytes = Vec::new();
        pack_bytes.extend_from_slice(b"DOCP");
        pack_bytes.extend_from_slice(&2u16.to_le_bytes()); // version 2
        pack_bytes.extend_from_slice(&2u16.to_le_bytes()); // Brotli flag
        pack_bytes.extend_from_slice(&(manifest_json.len() as u32).to_le_bytes());
        pack_bytes.extend_from_slice(&0u32.to_le_bytes()); // reserved
        pack_bytes.extend_from_slice(manifest_json.as_bytes());
        pack_bytes.extend_from_slice(b"0123456789");

        let temp_dir = std::env::temp_dir();
        let temp_file = temp_dir.join("test_v2.docpack");
        std::fs::write(&temp_file, &pack_bytes).unwrap();

        let parsed = parse_docpack_on_disk(temp_file.clone(), 0, pack_bytes.len(), "test")
            .expect("Failed to parse v2 docpack");
        assert_eq!(parsed.manifest.id, "tailwind");
        assert_eq!(parsed.data_start, 16 + manifest_json.len());
        let route = parsed.manifest.routes.get("/index.html").unwrap();
        assert_eq!(route.encoding.as_deref(), Some("br"));
        let _ = std::fs::remove_file(temp_file);
    }
}


