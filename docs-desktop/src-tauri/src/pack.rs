//! `.docpack` storage: format parsing, on-disk pack discovery,
//! and the shared `AssetStore` used by servers, commands and the updater.
//!
//! Format v3 keeps its small metadata block in front and only loads the route
//! index when a site is first read, so startup cost does not grow with the size
//! of the library. v1/v2 packs stay readable until they are next updated.

use std::collections::{HashMap, VecDeque};
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::path::PathBuf;
use std::sync::{Arc, OnceLock, RwLock};
use std::time::{Duration, Instant};

use crate::catalog::get_site_origin_and_entry;
use crate::error::{DocxError, Result};
use crate::util::sha256_hex_16;

/// Route of the page search index inside a v3 pack.
pub(crate) const SEARCH_ROUTE: &str = "/__docx/search.json";
pub(crate) const V3_HEADER_BYTES: usize = 32;

#[derive(serde::Deserialize, Clone, Debug)]
pub struct ManifestEntry {
    pub offset: usize,
    pub length: usize,
    pub mime: String,
    pub gzipped: bool,
    #[serde(default)]
    pub hash: String,
    #[serde(default)]
    pub encoding: Option<String>,
}

#[derive(serde::Deserialize, Clone, Debug)]
#[allow(non_snake_case)]
struct SiteManifest {
    id: String,
    name: String,
    version: String,
    commit: String,
    #[serde(default)]
    updatedAt: String,
    #[serde(default)]
    totalBytes: u64,
    #[serde(default)]
    chunkCount: usize,
    routes: HashMap<String, ManifestEntry>,
}

/// What a pack says about itself; read for every pack at startup.
#[derive(serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PackMeta {
    pub id: String,
    pub name: String,
    pub version: String,
    pub commit: String,
    #[serde(default)]
    pub updated_at: String,
    #[serde(default)]
    pub total_bytes: u64,
    #[serde(default)]
    pub chunk_count: usize,
    #[serde(default)]
    pub route_count: usize,
    #[serde(default)]
    pub data_hash: String,
    #[serde(default)]
    pub index_hash: String,
}

#[derive(serde::Deserialize)]
struct RawV3Index {
    c: Vec<String>,
    l: Vec<u64>,
    r: Vec<u64>,
    e: String,
    m: Vec<String>,
    p: HashMap<String, Vec<u32>>,
}

/// Chunk table and route recipes of a v3 pack.
pub struct V3Index {
    pub ids: Vec<String>,
    pub offsets: Vec<u64>,
    pub lengths: Vec<u64>,
    pub raw_lengths: Vec<u64>,
    pub brotli: Vec<bool>,
    pub mimes: Vec<String>,
    /// route -> [mime index, ...chunk indices]
    pub routes: HashMap<String, Vec<u32>>,
    pub data_len: u64,
}

impl V3Index {
    /// Parses and bounds-checks an index; nothing later has to trust its numbers.
    pub fn parse(compressed: &[u8]) -> Result<Self> {
        let mut json = Vec::new();
        brotli::Decompressor::new(compressed, 4096)
            .read_to_end(&mut json)
            .map_err(|e| DocxError::invalid_pack(format!("index does not decompress: {e}")))?;
        let raw: RawV3Index = serde_json::from_slice(&json)?;

        let n = raw.c.len();
        if raw.l.len() != n || raw.r.len() != n || raw.e.len() != n {
            return Err(DocxError::invalid_pack("index tables have different lengths"));
        }
        for recipe in raw.p.values() {
            let Some((mime, chunks)) = recipe.split_first() else {
                return Err(DocxError::invalid_pack("empty route recipe"));
            };
            if *mime as usize >= raw.m.len() || chunks.iter().any(|&c| c as usize >= n) {
                return Err(DocxError::invalid_pack("route recipe out of range"));
            }
        }

        let mut offsets = Vec::with_capacity(n);
        let mut at = 0u64;
        for &len in &raw.l {
            offsets.push(at);
            at = at
                .checked_add(len)
                .ok_or_else(|| DocxError::invalid_pack("chunk table overflows"))?;
        }

        Ok(Self {
            brotli: raw.e.bytes().map(|b| b == b'1').collect(),
            ids: raw.c,
            offsets,
            lengths: raw.l,
            raw_lengths: raw.r,
            mimes: raw.m,
            routes: raw.p,
            data_len: at,
        })
    }

    /// Stable id for a route's content, usable as an HTTP validator.
    fn route_tag(&self, recipe: &[u32]) -> String {
        let mut joined = String::with_capacity(recipe.len() * 16);
        for &c in &recipe[1..] {
            joined.push_str(&self.ids[c as usize]);
        }
        sha256_hex_16(joined.as_bytes())
    }
}

/// One resolved route, ready for the HTTP layer.
pub struct RouteData {
    pub mime: String,
    pub gzipped: bool,
    pub encoding: Option<String>,
    pub bytes: Vec<u8>,
    /// Content validator; empty when the bytes have no stable identity.
    pub tag: String,
}

#[derive(Clone)]
pub enum PackBacking {
    OnDisk {
        path: PathBuf,
        file_offset: u64,
        pack_len: u64,
    },
}

enum PackLayout {
    Legacy {
        routes: HashMap<String, ManifestEntry>,
        data_start: u64,
    },
    V3 {
        index_start: u64,
        index_len: usize,
        data_start: u64,
        index: OnceLock<Option<Arc<V3Index>>>,
    },
}

pub struct SiteOverridePack {
    pub meta: PackMeta,
    pub source: String,
    backing: PackBacking,
    layout: PackLayout,
}

impl SiteOverridePack {
    /// Opens the pack for reading. A standalone pack whose length differs from what
    /// was parsed has been replaced by an update, so this view must not read it:
    /// its offsets would land on unrelated bytes.
    pub(crate) fn open(&self) -> Option<File> {
        let PackBacking::OnDisk { path, file_offset, pack_len } = &self.backing;
        let file = File::open(path).ok()?;
        if *file_offset == 0 && file.metadata().ok()?.len() != *pack_len {
            return None;
        }
        Some(file)
    }

    fn read_at(&self, file: &mut File, offset: u64, length: u64) -> Option<Vec<u8>> {
        let PackBacking::OnDisk { file_offset, pack_len, .. } = &self.backing;
        if offset.checked_add(length)? > *pack_len {
            return None;
        }
        file.seek(SeekFrom::Start(*file_offset + offset)).ok()?;
        let mut out = vec![0u8; length as usize];
        file.read_exact(&mut out).ok()?;
        Some(out)
    }

    /// The route index of a v3 pack, loaded on first use.
    pub fn v3_index(&self) -> Option<Arc<V3Index>> {
        let PackLayout::V3 { index_start, index_len, index, .. } = &self.layout else {
            return None;
        };
        index
            .get_or_init(|| {
                let mut file = self.open()?;
                let compressed = self.read_at(&mut file, *index_start, *index_len as u64)?;
                match V3Index::parse(&compressed) {
                    Ok(parsed) => Some(Arc::new(parsed)),
                    Err(e) => {
                        log::error!("unreadable index in pack '{}': {}", self.meta.id, e);
                        None
                    }
                }
            })
            .clone()
    }

    pub fn contains(&self, route: &str) -> bool {
        match &self.layout {
            PackLayout::Legacy { routes, .. } => routes.contains_key(route),
            PackLayout::V3 { .. } => self.v3_index().is_some_and(|i| i.routes.contains_key(route)),
        }
    }

    /// First route ending in `suffix`, for sub-assets requested relative to the wrong base.
    pub fn route_with_suffix(&self, suffix: &str) -> Option<String> {
        match &self.layout {
            PackLayout::Legacy { routes, .. } => routes.keys().find(|r| r.ends_with(suffix)).cloned(),
            PackLayout::V3 { .. } => self.v3_index()?.routes.keys().find(|r| r.ends_with(suffix)).cloned(),
        }
    }

    pub fn html_routes(&self) -> Vec<String> {
        let mut out: Vec<String> = match &self.layout {
            PackLayout::Legacy { routes, .. } => routes
                .iter()
                .filter(|(_, e)| e.mime.contains("text/html"))
                .map(|(r, _)| r.clone())
                .collect(),
            PackLayout::V3 { .. } => {
                let Some(index) = self.v3_index() else {
                    return Vec::new();
                };
                index
                    .routes
                    .iter()
                    .filter(|(_, recipe)| index.mimes[recipe[0] as usize].contains("text/html"))
                    .map(|(r, _)| r.clone())
                    .collect()
            }
        };
        out.sort();
        out
    }

    pub fn read_route(&self, route: &str) -> Option<RouteData> {
        match &self.layout {
            PackLayout::Legacy { routes, data_start } => {
                let entry = routes.get(route)?;
                let mut file = self.open()?;
                let bytes = self.read_at(&mut file, data_start + entry.offset as u64, entry.length as u64)?;
                Some(RouteData {
                    mime: entry.mime.clone(),
                    gzipped: entry.gzipped,
                    encoding: entry.encoding.clone(),
                    bytes,
                    tag: entry.hash.clone(),
                })
            }
            PackLayout::V3 { data_start, .. } => {
                let index = self.v3_index()?;
                let recipe = index.routes.get(route)?;
                let chunks = &recipe[1..];
                let mime = index.mimes[recipe[0] as usize].clone();
                let tag = index.route_tag(recipe);
                let mut file = self.open()?;
                let mut stored = |c: usize| self.read_at(&mut file, data_start + index.offsets[c], index.lengths[c]);

                // A single chunk goes out as stored: the browser decodes brotli itself.
                if let [only] = chunks {
                    let only = *only as usize;
                    return Some(RouteData {
                        mime,
                        gzipped: false,
                        encoding: index.brotli[only].then(|| "br".to_string()),
                        bytes: stored(only)?,
                        tag,
                    });
                }

                let raw_len: u64 = chunks.iter().map(|&c| index.raw_lengths[c as usize]).sum();
                let mut bytes = Vec::with_capacity(raw_len as usize);
                for &c in chunks {
                    let c = c as usize;
                    let data = stored(c)?;
                    if index.brotli[c] {
                        brotli::Decompressor::new(&data[..], 4096).read_to_end(&mut bytes).ok()?;
                    } else {
                        bytes.extend_from_slice(&data);
                    }
                }
                Some(RouteData { mime, gzipped: false, encoding: None, bytes, tag })
            }
        }
    }

    /// Start of the data section within the pack, for v3 packs.
    pub fn data_start(&self) -> Option<u64> {
        match &self.layout {
            PackLayout::V3 { data_start, .. } => Some(*data_start),
            PackLayout::Legacy { .. } => None,
        }
    }

    /// Streams the whole pack, so that bundling never holds packs in memory.
    #[cfg(desktop)]
    pub fn pack_len(&self) -> u64 {
        let PackBacking::OnDisk { pack_len, .. } = &self.backing;
        *pack_len
    }
}

pub struct AssetStore {
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
    /// Recent failures, so an offline page does not retry each missing asset on every view.
    misses: RwLock<HashMap<String, Instant>>,
}

struct FallbackCacheInner {
    entries: HashMap<String, (String, Vec<u8>)>,
    order: VecDeque<String>,
    bytes: usize,
}

const FALLBACK_CACHE_MAX_BYTES: usize = 12 * 1024 * 1024;
const FALLBACK_CACHE_MAX_ENTRIES: usize = 128;
const FALLBACK_CACHE_MAX_ENTRY_BYTES: usize = 512 * 1024;
const FALLBACK_MISS_TTL: Duration = Duration::from_secs(60);
const FALLBACK_MISS_MAX_ENTRIES: usize = 1024;

impl FallbackCache {
    pub fn new() -> Self {
        Self {
            inner: RwLock::new(FallbackCacheInner {
                entries: HashMap::new(),
                order: VecDeque::new(),
                bytes: 0,
            }),
            misses: RwLock::new(HashMap::new()),
        }
    }

    pub fn recently_missed(&self, key: &str) -> bool {
        self.misses
            .read()
            .ok()
            .and_then(|m| m.get(key).map(|at| at.elapsed() < FALLBACK_MISS_TTL))
            .unwrap_or(false)
    }

    pub fn note_miss(&self, key: String) {
        if let Ok(mut misses) = self.misses.write() {
            if misses.len() >= FALLBACK_MISS_MAX_ENTRIES {
                misses.clear();
            }
            misses.insert(key, Instant::now());
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

/// Lengths from a v3 header: (meta, index, data).
pub(crate) fn parse_v3_header(header: &[u8]) -> Option<(usize, usize, u64)> {
    if header.len() < V3_HEADER_BYTES || !header.starts_with(DOCP_MAGIC) {
        return None;
    }
    if u16::from_le_bytes([header[4], header[5]]) != 3 {
        return None;
    }
    let meta_len = u32::from_le_bytes(header[8..12].try_into().ok()?) as usize;
    let index_len = u32::from_le_bytes(header[12..16].try_into().ok()?) as usize;
    let data_len = u64::from_le_bytes(header[16..24].try_into().ok()?);
    Some((meta_len, index_len, data_len))
}

fn parse_v3_on_disk(
    file: &mut File,
    path: PathBuf,
    file_offset: u64,
    pack_len: u64,
    source: &str,
) -> Option<Arc<SiteOverridePack>> {
    file.seek(SeekFrom::Start(file_offset)).ok()?;
    let mut header = [0u8; V3_HEADER_BYTES];
    file.read_exact(&mut header).ok()?;
    let (meta_len, index_len, data_len) = parse_v3_header(&header)?;

    let index_start = (V3_HEADER_BYTES as u64).checked_add(meta_len as u64)?;
    let data_start = index_start.checked_add(index_len as u64)?;
    if data_start.checked_add(data_len)? != pack_len {
        return None;
    }

    let mut meta_bytes = vec![0u8; meta_len];
    file.read_exact(&mut meta_bytes).ok()?;
    let meta: PackMeta = serde_json::from_slice(&meta_bytes).ok()?;
    get_site_origin_and_entry(&meta.id)?;

    Some(Arc::new(SiteOverridePack {
        meta,
        source: source.to_string(),
        backing: PackBacking::OnDisk { path, file_offset, pack_len },
        layout: PackLayout::V3 {
            index_start,
            index_len,
            data_start,
            index: OnceLock::new(),
        },
    }))
}

pub(crate) fn parse_docpack_on_disk(
    path: PathBuf,
    file_offset: u64,
    pack_len: u64,
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
        if version == 3 {
            return parse_v3_on_disk(&mut file, path, file_offset, pack_len, source);
        }
        let m_len = u32::from_le_bytes([v2_hdr[4], v2_hdr[5], v2_hdr[6], v2_hdr[7]]) as usize;
        let full_hdr_len = 16usize.checked_add(m_len)?;
        if version != 2 || (pack_len as usize) < full_hdr_len {
            return None;
        }
        (m_len, full_hdr_len)
    } else {
        // Format v1: manifest_len (4)
        let m_len = u32::from_le_bytes(magic_or_len) as usize;
        let full_hdr_len = 4usize.checked_add(m_len)?;
        if (pack_len as usize) < full_hdr_len {
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
        meta: PackMeta {
            id: manifest.id,
            name: manifest.name,
            version: manifest.version,
            commit: manifest.commit,
            updated_at: manifest.updatedAt,
            total_bytes: manifest.totalBytes,
            chunk_count: manifest.chunkCount,
            route_count: manifest.routes.len(),
            data_hash: String::new(),
            index_hash: String::new(),
        },
        source: source.to_string(),
        backing: PackBacking::OnDisk { path, file_offset, pack_len },
        layout: PackLayout::Legacy {
            routes: manifest.routes,
            data_start: data_start as u64,
        },
    }))
}

pub(crate) fn load_disk_overrides(overrides: &mut HashMap<String, Arc<SiteOverridePack>>) {
    let Ok(entries) = fs::read_dir(get_packs_dir()) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("docpack") {
            continue;
        }
        let Ok(file_meta) = fs::metadata(&path) else {
            continue;
        };
        let Some(pack) = parse_docpack_on_disk(path, 0, file_meta.len(), "Modular .docpack") else {
            continue;
        };
        let should_use_disk = match overrides.get(&pack.meta.id) {
            Some(existing) => {
                pack.meta.updated_at >= existing.meta.updated_at
                    || pack.meta.route_count >= existing.meta.route_count
            }
            None => true,
        };
        if should_use_disk {
            overrides.insert(pack.meta.id.clone(), pack);
        }
    }
}

pub(crate) fn load_asset_store() -> Arc<AssetStore> {
    migrate_legacy_packs_to_appdata();
    let mut overrides = HashMap::new();
    load_disk_overrides(&mut overrides);

    Arc::new(AssetStore {
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

        let parsed = parse_docpack_on_disk(temp_file.clone(), 0, pack_bytes.len() as u64, "test")
            .expect("Failed to parse v2 docpack");
        assert_eq!(parsed.meta.id, "tailwind");
        assert_eq!(parsed.meta.route_count, 1);
        let route = parsed.read_route("/index.html").unwrap();
        assert_eq!(route.encoding.as_deref(), Some("br"));
        assert_eq!(route.bytes, b"0123456789");
        let _ = std::fs::remove_file(temp_file);
    }
}
