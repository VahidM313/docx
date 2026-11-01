//! Pack install and incremental update over HTTP range requests.
//!
//! A release holds one library file with every pack in it, and no patch files. The
//! client reads the library's directory, then the head of its pack, works out which
//! chunks it lacks, fetches only those, and rebuilds a byte-identical copy of the
//! published pack from local and fetched chunks. That works from any older build,
//! not just the previous one.
//!
//! Every fetched chunk is verified against its id and the assembled data against
//! the pack's hash, and the installed pack is only replaced by an atomic rename, so
//! an interrupted or corrupted update leaves the working pack in place.

use std::collections::{HashMap, HashSet};
use std::fs::{self, File, OpenOptions};
use std::io::{BufReader, BufWriter, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, LazyLock, Mutex};
use std::time::{Duration, Instant};

use crate::commands::parse_registry;
use crate::config::LIBRARY_URL;
use crate::error::{read_guard, write_guard, DocxError, Result};
use crate::pack::{
    ChunkDictionary,
    get_packs_dir, parse_docpack_on_disk, parse_v3_header, AssetStore, PackMeta, SiteOverridePack,
    V3Index, V3_HEADER_BYTES,
};
use crate::server::{ensure_site_server, AppState};
use crate::util::{http_client, sha256_hex_16, to_hex};

/// Enough for the header, metadata and index of most packs in one request.
const HEAD_PROBE_BYTES: u64 = 64 * 1024;
/// Enough for the library's directory. It is read on every update check, so this stays small.
const DIRECTORY_PROBE_BYTES: u64 = 32 * 1024;
const LIBRARY_HEADER_BYTES: usize = 32;
/// 2 added dictionary zstd chunks; the layout of the library itself is the same.
const LIBRARY_VERSION: u16 = 2;
/// Fetching a small gap is cheaper than another request.
const MAX_RANGE_GAP: u64 = 32 * 1024;
/// Above this share of missing data, one streamed download beats many ranges.
const FULL_DOWNLOAD_PERCENT: u64 = 85;
const MAX_ATTEMPTS: u32 = 4;
/// Slowest rate at which a transfer is still worth waiting for. Past that, the attempt
/// is abandoned and retried, which keeps a stalled socket from hanging an update
/// forever; both transfer paths continue from what already arrived.
const MIN_TRANSFER_BYTES_PER_SEC: u64 = 16 * 1024;
const BASE_TRANSFER_BUDGET: Duration = Duration::from_secs(120);
const PROGRESS_INTERVAL: Duration = Duration::from_millis(150);
const COPY_BUFFER_BYTES: usize = 256 * 1024;

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

/// Rate-limited progress events: the UI re-renders on each one.
pub(crate) struct Progress<'a> {
    site_id: &'a str,
    sink: &'a mut dyn FnMut(DownloadProgressPayload),
    last: Option<Instant>,
}

impl<'a> Progress<'a> {
    pub(crate) fn new(site_id: &'a str, sink: &'a mut dyn FnMut(DownloadProgressPayload)) -> Self {
        Self { site_id, sink, last: None }
    }

    fn emit(&mut self, phase: &str, done: u64, total: u64, percent: u8, detail: String) {
        self.last = Some(Instant::now());
        (self.sink)(DownloadProgressPayload {
            site_id: self.site_id.to_string(),
            phase: phase.to_string(),
            downloaded_bytes: done as usize,
            total_bytes: total as usize,
            percent,
            detail,
        });
    }

    /// Reports transfer progress mapped onto the 8-95% part of the bar.
    fn transfer(&mut self, phase: &str, done: u64, total: u64) {
        if self.last.is_some_and(|t| t.elapsed() < PROGRESS_INTERVAL) {
            return;
        }
        let total = total.max(1);
        let percent = (8.0 + (done as f64 / total as f64) * 87.0).clamp(8.0, 95.0) as u8;
        let detail = format!("{} / {}", format_mb(done), format_mb(total));
        self.emit(phase, done, total, percent, detail);
    }
}

fn format_mb(bytes: u64) -> String {
    format!("{:.2} MB", bytes as f64 / (1024.0 * 1024.0))
}

fn backoff(attempt: u32) {
    std::thread::sleep(Duration::from_millis(500 * (1 << attempt.min(4))));
}

fn transfer_budget(bytes: u64) -> Duration {
    BASE_TRANSFER_BUDGET + Duration::from_secs(bytes / MIN_TRANSFER_BYTES_PER_SEC)
}

/// Whether trying again can help. Client errors such as 404 will not change.
fn is_transient(error: &DocxError) -> bool {
    match error {
        DocxError::HttpStatus { status, .. } => *status >= 500 || *status == 429,
        DocxError::Http { .. } => true,
        _ => false,
    }
}

/// Replaces `to` with `from`, retrying briefly because Windows refuses while a
/// scanner or indexer still has the file open.
fn replace_file(from: &Path, to: &Path) -> Result<()> {
    let mut last = None;
    for _ in 0..6 {
        match fs::rename(from, to) {
            Ok(()) => return Ok(()),
            Err(e) => last = Some(e),
        }
        std::thread::sleep(Duration::from_millis(150));
    }
    Err(DocxError::io_path(to, &last.expect("rename attempted")))
}

/// Downloads `url`, or just the `(start, length)` window of it, into `part`, continuing
/// an earlier attempt when the server still has the same file. `part` is complete when
/// this returns.
pub(crate) fn download_resumable(
    url: &str,
    window: Option<(u64, u64)>,
    part: &Path,
    expected_total: u64,
    phase: &str,
    progress: &mut Progress<'_>,
) -> Result<u64> {
    let etag_path = part.with_extension("etag");
    let mut failures = 0u32;
    let mut buffer = vec![0u8; 64 * 1024];

    loop {
        let mut have = fs::metadata(part).map(|m| m.len()).unwrap_or(0);
        let etag = fs::read_to_string(&etag_path).ok().filter(|_| have > 0);
        if etag.is_none() {
            have = 0;
        }
        if let Some((_, len)) = window
            && have >= len
        {
            let _ = fs::remove_file(&etag_path);
            return Ok(len);
        }

        let attempt_start = have;
        let mut request = http_client().get(url).timeout(transfer_budget(expected_total));
        match window {
            Some((start, len)) => {
                request = request.header(reqwest::header::RANGE, format!("bytes={}-{}", start + have, start + len - 1));
            }
            None if have > 0 => request = request.header(reqwest::header::RANGE, format!("bytes={have}-")),
            None => {}
        }
        if let (true, Some(tag)) = (have > 0, &etag) {
            request = request.header(reqwest::header::IF_RANGE, tag.as_str());
        }

        let attempt = (|| -> Result<u64> {
            let mut resp = request.send()?;
            let status = resp.status();
            if status == reqwest::StatusCode::RANGE_NOT_SATISFIABLE {
                // The partial file is not a prefix of what the server has now.
                let _ = fs::remove_file(part);
                let _ = fs::remove_file(&etag_path);
                return Err(DocxError::http(url, "stale partial download"));
            }
            if !status.is_success() {
                return Err(DocxError::HttpStatus { status: status.as_u16(), url: url.to_string() });
            }
            let partial = status == reqwest::StatusCode::PARTIAL_CONTENT;
            if window.is_some() && !partial {
                // A whole body here means the file changed, and it would be the entire
                // library. The window is stale too, so the caller has to look it up again.
                let _ = fs::remove_file(part);
                let _ = fs::remove_file(&etag_path);
                return Err(DocxError::invalid_pack("the library changed during the download"));
            }

            let resuming = partial && have > 0;
            if !resuming {
                have = 0;
                match resp.headers().get(reqwest::header::ETAG).and_then(|v| v.to_str().ok()) {
                    Some(tag) => fs::write(&etag_path, tag).map_err(|e| DocxError::io_path(&etag_path, &e))?,
                    None => {
                        let _ = fs::remove_file(&etag_path);
                    }
                }
            }
            let total = resp.content_length().map(|n| n + have).unwrap_or(expected_total).max(1);

            let mut file = OpenOptions::new()
                .create(true)
                .write(true)
                .append(resuming)
                .truncate(!resuming)
                .open(part)
                .map_err(|e| DocxError::io_path(part, &e))?;
            loop {
                let n = resp
                    .read(&mut buffer)
                    .map_err(|e| DocxError::http(url, format!("download interrupted: {e}")))?;
                if n == 0 {
                    break;
                }
                file.write_all(&buffer[..n]).map_err(|e| DocxError::io_path(part, &e))?;
                have += n as u64;
                progress.transfer(phase, have, total);
            }
            file.sync_all().map_err(|e| DocxError::io_path(part, &e))?;
            if have != total {
                return Err(DocxError::http(url, format!("connection closed at {have} of {total} bytes")));
            }
            Ok(total)
        })();

        match attempt {
            Ok(total) => {
                let _ = fs::remove_file(&etag_path);
                return Ok(total);
            }
            Err(e) if !is_transient(&e) => return Err(e),
            Err(e) => {
                // A slow link may need many attempts; only a dead one should give up.
                let now = fs::metadata(part).map(|m| m.len()).unwrap_or(0);
                failures = if now > attempt_start { 0 } else { failures + 1 };
                if failures >= MAX_ATTEMPTS {
                    return Err(e);
                }
                log::warn!("download retry {failures} for {url}: {e}");
                backoff(failures);
            }
        }
    }
}

/// One pack inside the library file.
#[derive(Clone, Debug)]
pub(crate) struct PackSlice {
    pub url: String,
    pub start: u64,
    pub len: u64,
}

struct LibraryHead {
    /// The directory as JSON, in the shape of a registry.
    json: Vec<u8>,
    data_start: u64,
}

/// The library's directory, so a client knows what exists and where. It is the first
/// thing in the file, which makes reading it as cheap as fetching a small file.
fn read_library_head(url: &str) -> Result<LibraryHead> {
    let mut bytes = fetch_range(url, 0, DIRECTORY_PROBE_BYTES)?;
    if bytes.len() < LIBRARY_HEADER_BYTES || &bytes[..4] != b"DOCL" {
        return Err(DocxError::invalid_pack("published file is not a library"));
    }
    let version = u16::from_le_bytes([bytes[4], bytes[5]]);
    if !(1..=LIBRARY_VERSION).contains(&version) {
        return Err(DocxError::invalid_pack(format!("library version {version} needs a newer app")));
    }
    let directory_len = u32::from_le_bytes([bytes[8], bytes[9], bytes[10], bytes[11]]) as usize;
    let data_start = LIBRARY_HEADER_BYTES + directory_len;
    if bytes.len() < data_start {
        let rest = fetch_range(url, bytes.len() as u64, data_start as u64)?;
        bytes.extend_from_slice(&rest);
    }
    if bytes.len() < data_start {
        return Err(DocxError::invalid_pack("library is shorter than its header says"));
    }
    let compressed = &bytes[LIBRARY_HEADER_BYTES..data_start];
    if sha256_hex_16(compressed).as_bytes() != &bytes[16..32] {
        return Err(DocxError::invalid_pack("library directory hash mismatch"));
    }
    let mut json = Vec::new();
    brotli::Decompressor::new(compressed, 4096)
        .read_to_end(&mut json)
        .map_err(|e| DocxError::invalid_pack(format!("library directory does not decompress: {e}")))?;
    Ok(LibraryHead { json, data_start: data_start as u64 })
}

/// The published directory as registry JSON.
pub(crate) fn fetch_library_directory() -> Result<Vec<u8>> {
    Ok(read_library_head(LIBRARY_URL)?.json)
}

fn retry_transient<T>(url: &str, mut attempt: impl FnMut() -> Result<T>) -> Result<T> {
    let mut failures = 0;
    loop {
        match attempt() {
            Err(e) if is_transient(&e) && failures + 1 < MAX_ATTEMPTS => {
                failures += 1;
                log::warn!("retry {failures} for {url}: {e}");
                backoff(failures);
            }
            result => return result,
        }
    }
}

fn locate_pack(library_url: &str, site_id: &str) -> Result<PackSlice> {
    let head = retry_transient(library_url, || read_library_head(library_url))?;
    let entries = parse_registry(&head.json).map_err(DocxError::invalid_pack)?;
    let entry = entries
        .into_iter()
        .find(|e| e.id == site_id)
        .ok_or_else(|| DocxError::Other(format!("'{site_id}' is not in the library")))?;
    Ok(PackSlice {
        url: library_url.to_string(),
        start: head.data_start + entry.offset,
        len: entry.sizeBytes as u64,
    })
}

struct RemoteHead {
    /// Header, metadata and index, exactly as published.
    bytes: Vec<u8>,
    meta: PackMeta,
    index: V3Index,
    dictionary: Option<ChunkDictionary>,
}

fn fetch_remote_head(slice: &PackSlice) -> Result<RemoteHead> {
    retry_transient(&slice.url, || read_remote_head(slice))
}

/// Reads the head of a published pack.
fn read_remote_head(slice: &PackSlice) -> Result<RemoteHead> {
    let url = slice.url.as_str();
    let mut bytes = fetch_range(url, slice.start, slice.start + HEAD_PROBE_BYTES.min(slice.len))?;
    let (meta_len, index_len, data_len) =
        parse_v3_header(&bytes).ok_or_else(|| DocxError::invalid_pack("published pack is not format v3"))?;
    let meta_end = V3_HEADER_BYTES + meta_len;
    let head_len = meta_end + index_len;
    if head_len as u64 + data_len != slice.len {
        return Err(DocxError::invalid_pack("pack does not fill its place in the library"));
    }

    if bytes.len() < head_len {
        let rest = fetch_range(url, slice.start + bytes.len() as u64, slice.start + head_len as u64)?;
        bytes.extend_from_slice(&rest);
    }
    if bytes.len() < head_len {
        return Err(DocxError::invalid_pack("published pack is shorter than its header says"));
    }
    bytes.truncate(head_len);

    let meta: PackMeta = serde_json::from_slice(&bytes[V3_HEADER_BYTES..meta_end])?;
    let index_bytes = &bytes[meta_end..head_len];
    if sha256_hex_16(index_bytes) != meta.index_hash {
        return Err(DocxError::invalid_pack("index hash mismatch; the pack may be mid-publish"));
    }
    let index = V3Index::parse(index_bytes)?;
    if index.data_len != data_len {
        return Err(DocxError::invalid_pack("index does not match the data section"));
    }
    let dictionary = match index.dictionary_chunk(&meta)? {
        Some(i) => {
            let start = slice.start + head_len as u64 + index.offsets[i];
            let stored = fetch_range(url, start, start + index.lengths[i])?;
            Some(index.parse_dictionary(&stored, i)?)
        }
        None => None,
    };
    Ok(RemoteHead { bytes, meta, index, dictionary })
}

fn fetch_range(url: &str, start: u64, end: u64) -> Result<Vec<u8>> {
    let resp = open_range(url, start, end)?;
    let mut out = Vec::with_capacity((end - start) as usize);
    resp.take(end - start)
        .read_to_end(&mut out)
        .map_err(|e| DocxError::http(url, format!("range read failed: {e}")))?;
    Ok(out)
}

/// Anything but the requested range is an error: ignoring it would start a download
/// of the whole library.
fn open_range(url: &str, start: u64, end: u64) -> Result<reqwest::blocking::Response> {
    let resp = http_client()
        .get(url)
        .header(reqwest::header::RANGE, format!("bytes={}-{}", start, end - 1))
        .timeout(transfer_budget(end - start))
        .send()?;
    let status = resp.status();
    if status == reqwest::StatusCode::OK {
        return Err(DocxError::invalid_pack("server ignored a range request"));
    }
    if status != reqwest::StatusCode::PARTIAL_CONTENT {
        return Err(DocxError::HttpStatus { status: status.as_u16(), url: url.to_string() });
    }
    let served_start = resp
        .headers()
        .get(reqwest::header::CONTENT_RANGE)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("bytes "))
        .and_then(|v| v.split('-').next())
        .and_then(|v| v.parse::<u64>().ok());
    if served_start != Some(start) {
        return Err(DocxError::invalid_pack("server answered with another range"));
    }
    Ok(resp)
}

fn verify_chunk(stored: &[u8], index: &V3Index, i: usize, dictionary: Option<&ChunkDictionary>) -> Result<()> {
    let id = &index.ids[i];
    if sha256_hex_16(&index.decode_chunk(stored, i, dictionary)?) != *id {
        return Err(DocxError::invalid_pack(format!("chunk {id} failed verification")));
    }
    Ok(())
}

/// What makes a local chunk usable: the published pack must come out byte-identical, so
/// the same content in another encoding has to be fetched.
fn chunk_key(index: &V3Index, i: usize) -> (&str, u8, u64) {
    (index.ids[i].as_str(), index.encodings[i], index.lengths[i])
}

/// Fetched chunks, kept in a spool file: chunk index -> offset in the spool.
struct Spool {
    file: File,
    written: u64,
    placed: HashMap<usize, u64>,
    received_bytes: u64,
}

/// Fetches `group`, a run of chunks close enough for one request. Returns how many
/// arrived, which also holds on error so a retry can continue after them.
fn fetch_chunk_group(
    slice: &PackSlice,
    head: &RemoteHead,
    group: &[usize],
    spool: &mut Spool,
    total: u64,
    progress: &mut Progress<'_>,
) -> (usize, Result<()>) {
    let url = slice.url.as_str();
    let index = &head.index;
    let data_start = slice.start + head.bytes.len() as u64;
    let first = group[0];
    let last = group[group.len() - 1];
    let range_start = data_start + index.offsets[first];
    let range_end = data_start + index.offsets[last] + index.lengths[last];

    let resp = match open_range(url, range_start, range_end) {
        Ok(resp) => resp,
        Err(e) => return (0, Err(e)),
    };
    let mut reader = BufReader::with_capacity(COPY_BUFFER_BYTES, resp);
    let mut position = index.offsets[first];
    let mut chunk = Vec::new();

    for (done, &i) in group.iter().enumerate() {
        let gap = index.offsets[i] - position;
        if gap > 0 {
            let skipped = std::io::copy(&mut reader.by_ref().take(gap), &mut std::io::sink());
            if !matches!(skipped, Ok(n) if n == gap) {
                return (done, Err(DocxError::http(url, "connection closed inside a range")));
            }
            spool.received_bytes += gap;
        }
        chunk.resize(index.lengths[i] as usize, 0);
        if let Err(e) = reader.read_exact(&mut chunk) {
            return (done, Err(DocxError::http(url, format!("range read failed: {e}"))));
        }
        if let Err(e) = verify_chunk(&chunk, index, i, head.dictionary.as_ref()) {
            return (done, Err(e));
        }
        // A failed write may have moved the cursor, so never rely on its position.
        let written = spool
            .file
            .seek(SeekFrom::Start(spool.written))
            .and_then(|_| spool.file.write_all(&chunk));
        if let Err(e) = written {
            return (done, Err(e.into()));
        }
        spool.placed.insert(i, spool.written);
        spool.written += chunk.len() as u64;
        spool.received_bytes += chunk.len() as u64;
        position = index.offsets[i] + index.lengths[i];
        progress.transfer("Downloading changes", spool.received_bytes, total);
    }
    (group.len(), Ok(()))
}

/// Downloads `missing` (in data order) into the spool, retrying only what has not arrived.
fn fetch_missing(
    slice: &PackSlice,
    head: &RemoteHead,
    missing: &[usize],
    spool: &mut Spool,
    total: u64,
    progress: &mut Progress<'_>,
) -> Result<()> {
    let index = &head.index;
    let mut next = 0;
    let mut failures = 0u32;
    while next < missing.len() {
        let mut end = next + 1;
        while end < missing.len() {
            let previous = missing[end - 1];
            let gap = index.offsets[missing[end]] - (index.offsets[previous] + index.lengths[previous]);
            if gap > MAX_RANGE_GAP {
                break;
            }
            end += 1;
        }
        let (arrived, result) = fetch_chunk_group(slice, head, &missing[next..end], spool, total, progress);
        next += arrived;
        match result {
            Ok(()) => failures = 0,
            // Wrong bytes will not fix themselves: the pack changed or is corrupt.
            Err(e) if !is_transient(&e) => return Err(e),
            Err(e) => {
                failures = if arrived > 0 { 0 } else { failures + 1 };
                if failures >= MAX_ATTEMPTS {
                    return Err(e);
                }
                log::warn!("range retry {failures} for {}: {e}", slice.url);
                backoff(failures);
            }
        }
    }
    Ok(())
}

/// Writes the published pack to `dest` from the local pack and the spool, verifying
/// the result against the published data hash.
fn assemble_pack(
    dest: &Path,
    head: &RemoteHead,
    local: &SiteOverridePack,
    local_index: &V3Index,
    local_lookup: &HashMap<(&str, u8, u64), usize>,
    spool: &mut Spool,
) -> Result<()> {
    let index = &head.index;
    let mut out = BufWriter::with_capacity(
        COPY_BUFFER_BYTES,
        File::create(dest).map_err(|e| DocxError::io_path(dest, &e))?,
    );
    out.write_all(&head.bytes).map_err(|e| DocxError::io_path(dest, &e))?;

    let local_data_start = local.data_start().ok_or_else(|| DocxError::invalid_pack("local pack is not v3"))?;
    let local_file = local.open().ok_or_else(|| DocxError::PackMissing(local.meta.id.clone()))?;
    let mut local_reader = BufReader::with_capacity(COPY_BUFFER_BYTES, local_file);
    local_reader.seek(SeekFrom::Start(local_data_start))?;
    let mut local_position = local_data_start;

    let mut hasher = ring::digest::Context::new(&ring::digest::SHA256);
    let mut chunk = Vec::new();
    for i in 0..index.ids.len() {
        chunk.resize(index.lengths[i] as usize, 0);
        if let Some(&at) = spool.placed.get(&i) {
            spool.file.seek(SeekFrom::Start(at))?;
            spool.file.read_exact(&mut chunk)?;
        } else {
            let j = *local_lookup
                .get(&chunk_key(index, i))
                .ok_or_else(|| DocxError::invalid_pack(format!("no source for chunk {}", index.ids[i])))?;
            let at = local_data_start + local_index.offsets[j];
            if at != local_position {
                // Survivors mostly stay in order, so this keeps the read buffer useful.
                local_reader.seek_relative(at as i64 - local_position as i64)?;
            }
            local_reader.read_exact(&mut chunk)?;
            local_position = at + chunk.len() as u64;
        }
        hasher.update(&chunk);
        out.write_all(&chunk).map_err(|e| DocxError::io_path(dest, &e))?;
    }

    check_data_hash(hasher, &head.meta)?;
    let file = out.into_inner().map_err(|e| DocxError::io_path(dest, e.error()))?;
    file.sync_all().map_err(|e| DocxError::io_path(dest, &e))?;
    Ok(())
}

fn check_data_hash(hasher: ring::digest::Context, meta: &PackMeta) -> Result<()> {
    let digest = hasher.finish();
    if to_hex(&digest.as_ref()[..16]) != meta.data_hash {
        return Err(DocxError::invalid_pack("pack data does not match its hash"));
    }
    Ok(())
}

/// Checks a fully downloaded pack before it may replace anything.
fn verify_downloaded_pack(path: &Path) -> Result<PackMeta> {
    let mut file = File::open(path).map_err(|e| DocxError::io_path(path, &e))?;
    let mut header = [0u8; V3_HEADER_BYTES];
    file.read_exact(&mut header)?;
    let (meta_len, index_len, data_len) =
        parse_v3_header(&header).ok_or_else(|| DocxError::invalid_pack("download is not a format v3 pack"))?;
    let data_start = (V3_HEADER_BYTES + meta_len + index_len) as u64;
    if file.metadata()?.len() != data_start + data_len {
        return Err(DocxError::invalid_pack("download has the wrong length"));
    }
    let mut meta_bytes = vec![0u8; meta_len];
    file.read_exact(&mut meta_bytes)?;
    let meta: PackMeta = serde_json::from_slice(&meta_bytes)?;

    file.seek(SeekFrom::Start(data_start))?;
    let mut hasher = ring::digest::Context::new(&ring::digest::SHA256);
    let mut buffer = vec![0u8; COPY_BUFFER_BYTES];
    loop {
        let n = file.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    check_data_hash(hasher, &meta)?;
    Ok(meta)
}

#[derive(Debug)]
pub(crate) struct SyncReport {
    pub meta: PackMeta,
    pub changed: bool,
    pub total_chunks: usize,
    pub reused_chunks: usize,
    pub downloaded_chunks: usize,
    pub reused_bytes: u64,
    pub downloaded_bytes: u64,
}

/// Fetches only what `local` lacks. Falls through with an error when the pack cannot
/// be patched, and the caller then downloads it whole.
fn sync_by_ranges(
    slice: &PackSlice,
    dest: &Path,
    head: &RemoteHead,
    local: &SiteOverridePack,
    local_index: &V3Index,
    missing: &[usize],
    missing_bytes: u64,
    progress: &mut Progress<'_>,
) -> Result<SyncReport> {
    let tmp = dest.with_extension("docpack.tmp");
    let spool_path = dest.with_extension("docpack.spool");
    let mut spool = Spool {
        file: OpenOptions::new()
            .create(true)
            .read(true)
            .write(true)
            .truncate(true)
            .open(&spool_path)
            .map_err(|e| DocxError::io_path(&spool_path, &e))?,
        written: 0,
        placed: HashMap::new(),
        received_bytes: 0,
    };

    let result = (|| -> Result<u64> {
        fetch_missing(slice, head, missing, &mut spool, missing_bytes, progress)?;
        progress.emit(
            "Assembling pack",
            spool.received_bytes,
            missing_bytes,
            96,
            "Combining local and downloaded content...".to_string(),
        );
        let local_lookup: HashMap<(&str, u8, u64), usize> =
            (0..local_index.ids.len()).map(|i| (chunk_key(local_index, i), i)).collect();
        assemble_pack(&tmp, head, local, local_index, &local_lookup, &mut spool)?;
        replace_file(&tmp, dest)?;
        Ok(spool.received_bytes)
    })();

    drop(spool);
    let _ = fs::remove_file(&spool_path);
    let _ = fs::remove_file(&tmp);

    let received = result? + head.bytes.len() as u64;
    let total_chunks = head.index.ids.len();
    Ok(SyncReport {
        meta: head.meta.clone(),
        changed: true,
        total_chunks,
        reused_chunks: total_chunks - missing.len(),
        downloaded_chunks: missing.len(),
        reused_bytes: head.index.data_len - missing_bytes,
        downloaded_bytes: received,
    })
}

fn sync_by_download(slice: &PackSlice, dest: &Path, progress: &mut Progress<'_>) -> Result<SyncReport> {
    let part = dest.with_extension("docpack.part");
    let window = Some((slice.start, slice.len));
    let received = download_resumable(&slice.url, window, &part, slice.len, "Downloading", progress)?;
    let meta = match verify_downloaded_pack(&part) {
        Ok(meta) => meta,
        Err(e) => {
            let _ = fs::remove_file(&part);
            return Err(e);
        }
    };
    replace_file(&part, dest)?;
    Ok(SyncReport {
        total_chunks: meta.chunk_count,
        reused_chunks: 0,
        downloaded_chunks: meta.chunk_count,
        reused_bytes: 0,
        downloaded_bytes: received,
        changed: true,
        meta,
    })
}

/// Brings `dest` up to the pack published at `slice`, starting from `local`.
pub(crate) fn sync_pack(
    slice: &PackSlice,
    dest: &Path,
    local: Option<&SiteOverridePack>,
    progress: &mut Progress<'_>,
) -> Result<SyncReport> {
    progress.emit("Checking for updates", 0, 0, 4, "Connecting to GitHub Releases...".to_string());

    let head = fetch_remote_head(slice)?;

    if let Some(local) = local
        && local.meta.commit == head.meta.commit
    {
        return Ok(SyncReport {
            meta: local.meta.clone(),
            changed: false,
            total_chunks: local.meta.chunk_count,
            reused_chunks: local.meta.chunk_count,
            downloaded_chunks: 0,
            reused_bytes: local.meta.total_bytes,
            downloaded_bytes: head.bytes.len() as u64,
        });
    }

    if let Some(local) = local
        && let Some(local_index) = local.v3_index()
    {
        let known: HashSet<(&str, u8, u64)> = (0..local_index.ids.len()).map(|i| chunk_key(&local_index, i)).collect();
        let missing: Vec<usize> =
            (0..head.index.ids.len()).filter(|&i| !known.contains(&chunk_key(&head.index, i))).collect();
        let missing_bytes: u64 = missing.iter().map(|&i| head.index.lengths[i]).sum();

        if missing_bytes * 100 < head.index.data_len * FULL_DOWNLOAD_PERCENT {
            match sync_by_ranges(slice, dest, &head, local, &local_index, &missing, missing_bytes, progress) {
                Ok(report) => return Ok(report),
                // Anything from a re-published pack to a corrupt local chunk ends here,
                // and a clean download recovers from all of them.
                Err(e) => log::warn!("incremental update of {} failed: {e}", slice.url),
            }
        }
    }

    sync_by_download(slice, dest, progress)
}

/// Finds the pack in the library and syncs it. A republished library moves packs, so
/// offsets read before the swap fail verification; the directory then has the new ones.
fn sync_from_library(
    library_url: &str,
    site_id: &str,
    dest: &Path,
    local: Option<&SiteOverridePack>,
    progress: &mut Progress<'_>,
) -> Result<SyncReport> {
    let slice = locate_pack(library_url, site_id)?;
    match sync_pack(&slice, dest, local, progress) {
        Err(DocxError::InvalidPack(why)) => {
            log::warn!("re-reading the library after: {why}");
            sync_pack(&locate_pack(library_url, site_id)?, dest, local, progress)
        }
        result => result,
    }
}

/// Sites being synced right now; a second request for one must not touch its temp files.
static IN_PROGRESS: LazyLock<Mutex<HashSet<String>>> = LazyLock::new(|| Mutex::new(HashSet::new()));

struct SyncGuard(String);

impl SyncGuard {
    fn acquire(site_id: &str) -> Result<Self> {
        let mut active = IN_PROGRESS.lock().map_err(|_| DocxError::LockPoisoned)?;
        if !active.insert(site_id.to_string()) {
            return Err(DocxError::Other(format!("'{site_id}' is already being updated")));
        }
        Ok(Self(site_id.to_string()))
    }
}

impl Drop for SyncGuard {
    fn drop(&mut self) {
        if let Ok(mut active) = IN_PROGRESS.lock() {
            active.remove(&self.0);
        }
    }
}

fn remove_legacy_sidecars(packs_dir: &Path, site_id: &str) {
    for suffix in ["manifest.json", "search.json", "delta"] {
        let _ = fs::remove_file(packs_dir.join(format!("{site_id}.{suffix}")));
    }
}

pub(crate) fn run_install_or_update_sync(
    site_id: String,
    store: Arc<AssetStore>,
    window: tauri::Window,
) -> Result<DeltaUpdateResult> {
    use tauri::Emitter;

    let _guard = SyncGuard::acquire(&site_id)?;
    let packs_dir: PathBuf = get_packs_dir();
    fs::create_dir_all(&packs_dir).map_err(|e| DocxError::io_path(&packs_dir, &e))?;
    let dest = packs_dir.join(format!("{site_id}.docpack"));

    let local = read_guard(&store.overrides)?.get(&site_id).cloned();
    let old_commit = local.as_ref().map_or_else(|| "not-installed".to_string(), |p| p.meta.commit.clone());

    let mut emit = |payload: DownloadProgressPayload| {
        let _ = window.emit("docpack-progress", payload);
    };
    let mut progress = Progress::new(&site_id, &mut emit);
    let report = sync_from_library(LIBRARY_URL, &site_id, &dest, local.as_deref(), &mut progress)?;

    if report.changed {
        let pack_len = fs::metadata(&dest).map_err(|e| DocxError::io_path(&dest, &e))?.len();
        let parsed = parse_docpack_on_disk(dest.clone(), 0, pack_len, "GitHub Release .docpack")
            .ok_or_else(|| DocxError::invalid_pack(format!("{site_id}.docpack cannot be opened")))?;
        write_guard(&store.overrides)?.insert(site_id.clone(), parsed);
        remove_legacy_sidecars(&packs_dir, &site_id);
    }
    let port = ensure_site_server(&site_id, Arc::clone(&store));

    let saved_percent = if report.reused_bytes + report.downloaded_bytes > 0 {
        ((report.reused_bytes as f64 / (report.reused_bytes + report.downloaded_bytes) as f64) * 1000.0).round()
            / 10.0
    } else {
        100.0
    };
    let message = if !report.changed {
        format!("{} ({}) is already up to date.", report.meta.name, report.meta.version)
    } else if report.reused_bytes > 0 {
        format!(
            "Updated {} ({}): downloaded {}, reused {} already on this device.",
            report.meta.name,
            report.meta.version,
            format_mb(report.downloaded_bytes),
            format_mb(report.reused_bytes),
        )
    } else {
        format!("Installed {} ({}), {}.", report.meta.name, report.meta.version, format_mb(report.downloaded_bytes))
    };

    progress.emit(
        if report.changed { "Complete" } else { "Up to Date" },
        report.downloaded_bytes,
        report.downloaded_bytes,
        100,
        message.clone(),
    );

    Ok(DeltaUpdateResult {
        site_id: site_id.clone(),
        old_commit,
        new_commit: report.meta.commit,
        total_chunks: report.total_chunks,
        reused_chunks: report.reused_chunks,
        downloaded_chunks: report.downloaded_chunks,
        reused_bytes: report.reused_bytes as usize,
        downloaded_bytes: report.downloaded_bytes as usize,
        saved_percent,
        port,
        message,
    })
}

/// Installs a pack, or brings an installed one up to date by fetching only what changed.
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
    use crate::server::decompress_html_body_if_needed;
    use std::io::BufRead;
    use std::net::TcpListener;
    use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};

    const SITE: &str = "tailwind";

    /// One pack file, built the way the release pipeline lays it out.
    struct TestPack {
        bytes: Vec<u8>,
        chunks: Vec<(String, Vec<u8>)>,
    }

    fn brotli_bytes(raw: &[u8]) -> Vec<u8> {
        let mut out = Vec::new();
        {
            let mut writer = brotli::CompressorWriter::new(&mut out, 4096, 5, 22);
            writer.write_all(raw).unwrap();
        }
        out
    }

    /// Chunks are `(id-source, stored-compressed)`; each becomes its own route.
    fn build_pack(commit: &str, raw_chunks: &[Vec<u8>]) -> TestPack {
        let mut ids = Vec::new();
        let mut lengths = Vec::new();
        let mut raw_lengths = Vec::new();
        let mut encodings = String::new();
        let mut routes = serde_json::Map::new();
        let mut data = Vec::new();
        let mut chunks = Vec::new();
        for (i, raw) in raw_chunks.iter().enumerate() {
            let id = sha256_hex_16(raw);
            let compress = i % 2 == 0;
            let stored = if compress { brotli_bytes(raw) } else { raw.clone() };
            lengths.push(stored.len());
            raw_lengths.push(raw.len());
            encodings.push(if compress { '1' } else { '0' });
            routes.insert(format!("/page{i}"), serde_json::json!([0, i]));
            data.extend_from_slice(&stored);
            ids.push(id.clone());
            chunks.push((id, raw.clone()));
        }
        // Real pages span several chunks, which the server must join and decode.
        routes.insert("/joined".to_string(), serde_json::json!([1, 0, 1]));
        let index_json = serde_json::json!({
            "c": ids, "l": lengths, "r": raw_lengths, "e": encodings,
            "m": ["text/plain", "text/html; charset=utf-8"], "p": routes,
        });
        let index_bytes = brotli_bytes(index_json.to_string().as_bytes());
        let data_hash = to_hex(&ring::digest::digest(&ring::digest::SHA256, &data).as_ref()[..16]);
        let meta = serde_json::json!({
            "id": SITE, "name": "Tailwind", "version": "v1", "commit": commit,
            "updatedAt": "2026-10-31T00:00:00Z", "totalBytes": data.len(),
            "chunkCount": raw_chunks.len(), "routeCount": raw_chunks.len(),
            "dataHash": data_hash, "indexHash": sha256_hex_16(&index_bytes),
        })
        .to_string();

        let mut bytes = vec![0u8; V3_HEADER_BYTES];
        bytes[..4].copy_from_slice(b"DOCP");
        bytes[4..6].copy_from_slice(&3u16.to_le_bytes());
        bytes[6..8].copy_from_slice(&2u16.to_le_bytes());
        bytes[8..12].copy_from_slice(&(meta.len() as u32).to_le_bytes());
        bytes[12..16].copy_from_slice(&(index_bytes.len() as u32).to_le_bytes());
        bytes[16..24].copy_from_slice(&(data.len() as u64).to_le_bytes());
        bytes.extend_from_slice(meta.as_bytes());
        bytes.extend_from_slice(&index_bytes);
        bytes.extend_from_slice(&data);
        TestPack { bytes, chunks }
    }

    fn body(seed: u64, len: usize) -> Vec<u8> {
        let mut x = seed.wrapping_mul(0x9e3779b97f4a7c15) | 1;
        (0..len)
            .map(|_| {
                x ^= x << 13;
                x ^= x >> 7;
                x ^= x << 17;
                (x & 0xff) as u8
            })
            .collect()
    }

    #[derive(Clone, Copy, PartialEq)]
    enum Mode {
        Normal,
        /// Answers every range request with the whole file, like a server without range support.
        IgnoreRanges,
        /// Closes the connection after `bytes` of the body of the `request`-th request.
        DropAfter { request: usize, bytes: usize },
        /// Flips the byte at this offset of the pack.
        Corrupt(u64),
    }

    /// Bytes around the pack, so no code path can get away with assuming it starts at 0.
    const PADDING: usize = 4096;

    struct TestServer {
        slice: PackSlice,
        served: Arc<AtomicU64>,
        requests: Arc<AtomicUsize>,
    }

    /// Serves `pack` inside a larger file, the way the library holds it.
    fn serve(pack: Vec<u8>, mode: Mode) -> TestServer {
        let len = pack.len() as u64;
        let mut file = vec![0x5a; PADDING];
        file.extend_from_slice(&pack);
        file.extend_from_slice(&[0x5a; PADDING]);
        let mode = match mode {
            Mode::Corrupt(at) => Mode::Corrupt(at + PADDING as u64),
            other => other,
        };
        let mut server = serve_file(file, mode, None);
        server.slice.start = PADDING as u64;
        server.slice.len = len;
        server
    }

    /// A small file server with range, ETag and fault-injection support. `swap` replaces
    /// the file from a given request on, like a republished library.
    fn serve_file(file: Vec<u8>, mode: Mode, swap: Option<(usize, Vec<u8>)>) -> TestServer {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let served = Arc::new(AtomicU64::new(0));
        let requests = Arc::new(AtomicUsize::new(0));
        let (served_ref, requests_ref) = (Arc::clone(&served), Arc::clone(&requests));

        std::thread::spawn(move || {
            for stream in listener.incoming().flatten() {
                let mut reader = std::io::BufReader::new(stream);
                let (mut range, mut if_range) = (None, None);
                loop {
                    let mut line = String::new();
                    if reader.read_line(&mut line).unwrap_or(0) == 0 || line == "\r\n" {
                        break;
                    }
                    let lower = line.to_ascii_lowercase();
                    if let Some(v) = lower.strip_prefix("range: bytes=") {
                        let mut parts = v.trim().split('-');
                        let start: u64 = parts.next().unwrap().parse().unwrap();
                        let end = parts.next().and_then(|s| s.parse::<u64>().ok());
                        range = Some((start, end));
                    }
                    if let Some(v) = lower.strip_prefix("if-range: ") {
                        if_range = Some(v.trim().to_string());
                    }
                }
                let request = requests_ref.fetch_add(1, Ordering::SeqCst);

                let (file, etag) = match &swap {
                    Some((from, next)) if request >= *from => (next, "\"test-etag-2\""),
                    _ => (&file, "\"test-etag\""),
                };
                let len = file.len() as u64;
                let honoured = range.filter(|_| {
                    mode != Mode::IgnoreRanges && if_range.as_deref().is_none_or(|t| t == etag)
                });
                let (status, start, end) = match honoured {
                    Some((s, e)) => ("206 Partial Content", s, e.map_or(len, |e| (e + 1).min(len))),
                    None => ("200 OK", 0, len),
                };
                let mut payload = file[start as usize..end as usize].to_vec();
                if let Mode::Corrupt(from) = mode
                    && end > from
                {
                    let at = from.saturating_sub(start) as usize;
                    payload[at] ^= 0xff;
                }
                let header = format!(
                    "HTTP/1.1 {status}\r\nContent-Length: {}\r\nContent-Range: bytes {start}-{}/{len}\r\nETag: {etag}\r\nConnection: close\r\n\r\n",
                    payload.len(),
                    end.saturating_sub(1),
                );
                let mut stream = reader.into_inner();
                let _ = stream.write_all(header.as_bytes());
                let cut = match mode {
                    Mode::DropAfter { request: at, bytes } if at == request => bytes.min(payload.len()),
                    _ => payload.len(),
                };
                let _ = stream.write_all(&payload[..cut]);
                served_ref.fetch_add(cut as u64, Ordering::SeqCst);
            }
        });

        let slice = PackSlice { url: format!("http://127.0.0.1:{port}/library.bin"), start: 0, len: 0 };
        TestServer { slice, served, requests }
    }

    fn temp_dir(name: &str) -> PathBuf {
        static NEXT: AtomicUsize = AtomicUsize::new(0);
        let dir = std::env::temp_dir().join(format!(
            "docx-sync-{}-{}-{name}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::SeqCst)
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn install(dir: &Path, pack: &TestPack) -> (PathBuf, Arc<SiteOverridePack>) {
        let dest = dir.join(format!("{SITE}.docpack"));
        fs::write(&dest, &pack.bytes).unwrap();
        let parsed = parse_docpack_on_disk(dest.clone(), 0, pack.bytes.len() as u64, "test").unwrap();
        (dest, parsed)
    }

    fn run(slice: &PackSlice, dest: &Path, local: Option<&SiteOverridePack>) -> Result<SyncReport> {
        let mut sink = |_: DownloadProgressPayload| {};
        let mut progress = Progress::new(SITE, &mut sink);
        sync_pack(slice, dest, local, &mut progress)
    }

    /// A library holding `filler` bytes and then `pack`, laid out by the release pipeline's rules.
    fn library_of(pack: &[u8], filler: usize) -> Vec<u8> {
        let directory = serde_json::json!({
            "version": 1,
            "packs": { SITE: {
                "id": SITE, "name": "Tailwind", "version": "v1", "commit": "x",
                "sizeBytes": pack.len(), "offset": filler,
            }},
        });
        let compressed = brotli_bytes(directory.to_string().as_bytes());
        let mut bytes = vec![0u8; LIBRARY_HEADER_BYTES];
        bytes[..4].copy_from_slice(b"DOCL");
        bytes[4..6].copy_from_slice(&LIBRARY_VERSION.to_le_bytes());
        bytes[8..12].copy_from_slice(&(compressed.len() as u32).to_le_bytes());
        bytes[16..32].copy_from_slice(sha256_hex_16(&compressed).as_bytes());
        bytes.extend_from_slice(&compressed);
        bytes.resize(bytes.len() + filler, 0x5a);
        bytes.extend_from_slice(pack);
        bytes
    }

    fn run_from_library(url: &str, dest: &Path, local: Option<&SiteOverridePack>) -> Result<SyncReport> {
        let mut sink = |_: DownloadProgressPayload| {};
        let mut progress = Progress::new(SITE, &mut sink);
        sync_from_library(url, SITE, dest, local, &mut progress)
    }

    fn generations() -> (TestPack, TestPack) {
        let chunks: Vec<Vec<u8>> = (0..40).map(|i| body(i, 6000)).collect();
        let mut edited = chunks.clone();
        edited[3] = body(1003, 6000);
        edited[4] = body(1004, 6000);
        (build_pack("aaaa", &chunks), build_pack("bbbb", &edited))
    }

    #[test]
    fn update_fetches_only_changed_chunks_and_matches_the_published_pack() {
        let (old, new) = generations();
        let dir = temp_dir("incremental");
        let (dest, local) = install(&dir, &old);
        let server = serve(new.bytes.clone(), Mode::Normal);

        let report = run(&server.slice, &dest, Some(&local)).unwrap();

        assert!(report.changed);
        assert_eq!(report.downloaded_chunks, 2);
        assert_eq!(report.reused_chunks, 38);
        assert_eq!(fs::read(&dest).unwrap(), new.bytes, "must be byte-identical to the release");
        // The fixed-size head probe plus the two adjacent changed chunks.
        let served = server.served.load(Ordering::SeqCst);
        assert!(served < HEAD_PROBE_BYTES + 14_000, "served {served} bytes");
    }

    #[test]
    fn updated_pack_serves_every_route() {
        let (old, new) = generations();
        let dir = temp_dir("routes");
        let (dest, local) = install(&dir, &old);
        let server = serve(new.bytes.clone(), Mode::Normal);
        run(&server.slice, &dest, Some(&local)).unwrap();

        let parsed = parse_docpack_on_disk(dest, 0, new.bytes.len() as u64, "test").unwrap();
        assert_eq!(parsed.meta.commit, "bbbb");
        for (i, (_, raw)) in new.chunks.iter().enumerate() {
            let route = parsed.read_route(&format!("/page{i}")).unwrap();
            if route.encoding.as_deref() == Some("br") {
                let mut decoded = Vec::new();
                brotli::Decompressor::new(&route.bytes[..], 4096).read_to_end(&mut decoded).unwrap();
                assert_eq!(&decoded, raw);
            } else {
                assert_eq!(&route.bytes, raw);
            }
        }
    }

    #[test]
    fn same_commit_downloads_nothing_but_the_head() {
        let (old, _) = generations();
        let dir = temp_dir("same");
        let (dest, local) = install(&dir, &old);
        let server = serve(old.bytes.clone(), Mode::Normal);

        let report = run(&server.slice, &dest, Some(&local)).unwrap();

        assert!(!report.changed);
        assert_eq!(server.requests.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn fresh_install_downloads_and_verifies_the_pack() {
        let (_, new) = generations();
        let dir = temp_dir("fresh");
        let dest = dir.join(format!("{SITE}.docpack"));
        let server = serve(new.bytes.clone(), Mode::Normal);

        let report = run(&server.slice, &dest, None).unwrap();

        assert_eq!(report.meta.commit, "bbbb");
        assert_eq!(fs::read(&dest).unwrap(), new.bytes);
        assert!(!dir.join(format!("{SITE}.docpack.part")).exists());
    }

    #[test]
    fn server_ignoring_ranges_is_refused_instead_of_downloading_the_library() {
        let (old, new) = generations();
        let dir = temp_dir("norange");
        let (dest, local) = install(&dir, &old);
        let server = serve(new.bytes.clone(), Mode::IgnoreRanges);

        let error = run(&server.slice, &dest, Some(&local)).unwrap_err();

        assert!(matches!(error, DocxError::InvalidPack(_)), "{error}");
        assert_eq!(fs::read(&dest).unwrap(), old.bytes);
        assert_eq!(server.requests.load(Ordering::SeqCst), 1, "must stop at the first answer");
    }

    #[test]
    fn library_directory_finds_a_pack_past_the_head_probe() {
        let (_, new) = generations();
        let dir = temp_dir("library");
        let dest = dir.join(format!("{SITE}.docpack"));
        let filler = (2 * DIRECTORY_PROBE_BYTES) as usize;
        let server = serve_file(library_of(&new.bytes, filler), Mode::Normal, None);

        let report = run_from_library(&server.slice.url, &dest, None).unwrap();

        assert_eq!(report.meta.commit, "bbbb");
        assert_eq!(fs::read(&dest).unwrap(), new.bytes);
        // The directory probe, the pack's head probe, and the pack: not a byte beyond it.
        let served = server.served.load(Ordering::SeqCst);
        assert_eq!(served, DIRECTORY_PROBE_BYTES + HEAD_PROBE_BYTES + new.bytes.len() as u64);
    }

    #[test]
    fn update_survives_a_library_republished_mid_sync() {
        let (old, new) = generations();
        let dir = temp_dir("swap");
        let (dest, local) = install(&dir, &old);
        let before = library_of(&new.bytes, 0);
        // Everything moves: the sync starts from the old offsets and lands on other bytes.
        let after = library_of(&new.bytes, 7000);
        let server = serve_file(before, Mode::Normal, Some((1, after)));

        let report = run_from_library(&server.slice.url, &dest, Some(&local)).unwrap();

        assert_eq!(report.meta.commit, "bbbb");
        assert_eq!(fs::read(&dest).unwrap(), new.bytes);
    }

    #[test]
    fn resuming_after_a_republish_drops_the_partial_file() {
        let (_, new) = generations();
        let dir = temp_dir("stale-part");
        let dest = dir.join(format!("{SITE}.docpack"));
        let part = dest.with_extension("docpack.part");
        fs::write(&part, &new.bytes[..100]).unwrap();
        fs::write(part.with_extension("etag"), "\"from-an-older-library\"").unwrap();
        let server = serve(new.bytes.clone(), Mode::Normal);
        let mut sink = |_: DownloadProgressPayload| {};
        let mut progress = Progress::new(SITE, &mut sink);

        let slice = &server.slice;
        let result = download_resumable(&slice.url, Some((slice.start, slice.len)), &part, slice.len, "t", &mut progress);

        assert!(matches!(result, Err(DocxError::InvalidPack(_))));
        assert!(!part.exists());
    }

    #[test]
    fn partial_file_of_a_whole_pack_is_not_requested_again() {
        let (_, new) = generations();
        let dir = temp_dir("complete-part");
        let dest = dir.join(format!("{SITE}.docpack"));
        let part = dest.with_extension("docpack.part");
        fs::write(&part, &new.bytes).unwrap();
        fs::write(part.with_extension("etag"), "\"test-etag\"").unwrap();
        let server = serve(new.bytes.clone(), Mode::Normal);

        let report = run(&server.slice, &dest, None).unwrap();

        assert_eq!(report.meta.commit, "bbbb");
        assert_eq!(fs::read(&dest).unwrap(), new.bytes);
        assert_eq!(server.requests.load(Ordering::SeqCst), 1, "only the head is read");
    }

    #[test]
    fn dropped_head_request_is_retried() {
        let (old, new) = generations();
        let dir = temp_dir("head-drop");
        let (dest, local) = install(&dir, &old);
        let server = serve(new.bytes.clone(), Mode::DropAfter { request: 0, bytes: 100 });

        let report = run(&server.slice, &dest, Some(&local)).unwrap();

        assert_eq!(report.downloaded_chunks, 2);
        assert_eq!(fs::read(&dest).unwrap(), new.bytes);
    }

    #[test]
    fn dropped_range_continues_after_the_chunks_that_arrived() {
        let (old, new) = generations();
        let dir = temp_dir("drops");
        let (dest, local) = install(&dir, &old);
        // Request 0 is the head probe; this cuts the range between the two changed chunks.
        let server = serve(new.bytes.clone(), Mode::DropAfter { request: 1, bytes: 7000 });

        let report = run(&server.slice, &dest, Some(&local)).unwrap();

        assert_eq!(fs::read(&dest).unwrap(), new.bytes);
        assert_eq!(report.downloaded_chunks, 2);
        assert_eq!(server.requests.load(Ordering::SeqCst), 3);
        let served = server.served.load(Ordering::SeqCst);
        assert!(served < HEAD_PROBE_BYTES + 14_000, "chunk 3 was fetched twice: {served} bytes");
    }

    #[test]
    fn interrupted_full_download_resumes_from_the_partial_file() {
        let (_, new) = generations();
        let dir = temp_dir("resume");
        let dest = dir.join(format!("{SITE}.docpack"));
        let server = serve(new.bytes.clone(), Mode::DropAfter { request: 1, bytes: 150_000 });

        run(&server.slice, &dest, None).unwrap();

        assert_eq!(fs::read(&dest).unwrap(), new.bytes);
        let served = server.served.load(Ordering::SeqCst);
        let expected = HEAD_PROBE_BYTES + new.bytes.len() as u64;
        assert_eq!(served, expected, "the retry must not repeat the first 150 KB");
    }

    #[test]
    fn missing_pack_fails_without_retrying() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let requests = Arc::new(AtomicUsize::new(0));
        let counter = Arc::clone(&requests);
        std::thread::spawn(move || {
            for mut stream in listener.incoming().flatten() {
                counter.fetch_add(1, Ordering::SeqCst);
                let mut buffer = [0u8; 2048];
                let _ = stream.read(&mut buffer);
                let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
            }
        });
        let dir = temp_dir("missing");
        let dest = dir.join(format!("{SITE}.docpack"));

        let slice = PackSlice { url: format!("http://127.0.0.1:{port}/x.bin"), start: 0, len: 1000 };
        let error = run(&slice, &dest, None).unwrap_err();

        assert!(matches!(error, DocxError::HttpStatus { status: 404, .. }));
        assert_eq!(requests.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn corrupt_chunks_never_replace_a_working_pack() {
        let (old, new) = generations();
        let dir = temp_dir("corrupt");
        let (dest, local) = install(&dir, &old);
        // Past the head and the first chunks, inside what the client fetches.
        let head_len = new.bytes.len() as u64 - local.meta.total_bytes;
        let server = serve(new.bytes.clone(), Mode::Corrupt(head_len + 20_000));

        let result = run(&server.slice, &dest, Some(&local));

        assert!(result.is_err(), "both the patch and the full download are corrupt");
        assert_eq!(fs::read(&dest).unwrap(), old.bytes, "the installed pack must survive");
        assert!(!dir.join(format!("{SITE}.docpack.tmp")).exists());
        assert!(!dir.join(format!("{SITE}.docpack.spool")).exists());
    }

    #[test]
    fn corrupt_local_pack_heals_through_a_full_download() {
        let (old, new) = generations();
        let dir = temp_dir("heal");
        let (dest, local) = install(&dir, &old);
        let mut damaged = old.bytes.clone();
        let at = damaged.len() - 100;
        damaged[at] ^= 0xff;
        fs::write(&dest, &damaged).unwrap();
        let server = serve(new.bytes.clone(), Mode::Normal);

        run(&server.slice, &dest, Some(&local)).unwrap();

        assert_eq!(fs::read(&dest).unwrap(), new.bytes);
    }

    #[test]
    fn replaced_file_is_not_read_through_a_stale_view() {
        let (old, new) = generations();
        let dir = temp_dir("stale");
        let (dest, local) = install(&dir, &old);
        fs::write(&dest, &new.bytes).unwrap();
        assert!(local.read_route("/page1").is_none());
    }

    fn http_get(port: u16, path: &str, extra_headers: &str) -> (String, Vec<u8>) {
        let mut stream = std::net::TcpStream::connect(("127.0.0.1", port)).unwrap();
        write!(stream, "GET {path} HTTP/1.1\r\nHost: localhost\r\n{extra_headers}\r\n").unwrap();
        let mut response = Vec::new();
        stream.read_to_end(&mut response).unwrap();
        let split = response.windows(4).position(|w| w == b"\r\n\r\n").unwrap();
        let head = String::from_utf8_lossy(&response[..split]).into_owned();
        (head, response[split + 4..].to_vec())
    }

    #[test]
    fn server_handles_chunked_pages_and_revalidates_assets() {
        let page_start = b"<html><head></head><body><h1>Joined page</h1>".repeat(20);
        let page_end = b"<p>Second chunk</p></body></html>".to_vec();
        let plain = body(7, 3000);
        let pack = build_pack("cccc", &[page_start, page_end, body(8, 3000), plain.clone()]);
        let dir = temp_dir("server");
        let (_, parsed) = install(&dir, &pack);

        let store = Arc::new(AssetStore {
            overrides: std::sync::RwLock::new(HashMap::from([(SITE.to_string(), parsed)])),
            site_ports: std::sync::RwLock::new(HashMap::new()),
            fallback_cache: crate::pack::FallbackCache::new(),
        });
        let port = ensure_site_server(SITE, Arc::clone(&store));

        // A page spanning two chunks is decoded, joined and given the reader bridge.
        let (head, page) = http_get(port, "/joined", "");
        let page = String::from_utf8_lossy(&page);
        assert!(head.starts_with("HTTP/1.1 200"), "{head}");
        assert!(!head.to_lowercase().contains("content-encoding"), "{head}");
        assert!(page.contains("<h1>Joined page</h1>") && page.contains("<p>Second chunk</p>"));
        assert!(page.len() > 10_000, "the reader bridge must be injected");

        // A single compressed chunk goes out as stored for the browser to decode.
        let (head, _) = http_get(port, "/page0", "");
        assert!(head.contains("Content-Encoding: br"), "{head}");

        // Assets keep their names across updates, so the browser must revalidate them.
        let (head, asset) = http_get(port, "/page3", "");
        assert_eq!(asset, plain);
        assert!(head.contains("Cache-Control: no-cache"), "{head}");
        let etag = head.lines().find_map(|l| l.strip_prefix("ETag: ")).expect("ETag").to_string();

        let (head, revalidated) = http_get(port, "/page3", &format!("If-None-Match: {etag}\r\n"));
        assert!(head.starts_with("HTTP/1.1 304"), "{head}");
        assert!(revalidated.is_empty());

        let (head, _) = http_get(port, "/page3", "If-None-Match: \"stale\"\r\n");
        assert!(head.starts_with("HTTP/1.1 200"), "{head}");
    }

    #[test]
    fn a_site_cannot_be_synced_twice_at_once() {
        let first = SyncGuard::acquire("guard-test").unwrap();
        assert!(SyncGuard::acquire("guard-test").is_err());
        drop(first);
        assert!(SyncGuard::acquire("guard-test").is_ok());
    }

    /// Runs the real client against real pack generations:
    /// `DOCX_E2E_PACKS=<dir with old/ and new/> cargo test --lib real_packs -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn real_packs_update_end_to_end() {
        let root = PathBuf::from(std::env::var("DOCX_E2E_PACKS").expect("DOCX_E2E_PACKS"));
        let mut names: Vec<String> = fs::read_dir(root.join("new"))
            .unwrap()
            .flatten()
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .filter(|n| n.ends_with(".docpack"))
            .collect();
        names.sort();

        let (mut total_new, mut total_served, mut total_pages) = (0u64, 0u64, 0usize);
        println!("{:<14}{:>10}{:>11}{:>8}{:>9}{:>7}", "site", "pack MB", "fetched MB", "pct", "chunks", "ms");
        for name in names {
            let old = fs::read(root.join("old").join(&name)).unwrap();
            let new = fs::read(root.join("new").join(&name)).unwrap();
            let dir = temp_dir("real");
            let dest = dir.join(&name);
            fs::write(&dest, &old).unwrap();

            let header = parse_v3_header(&old).unwrap();
            let meta: PackMeta =
                serde_json::from_slice(&old[V3_HEADER_BYTES..V3_HEADER_BYTES + header.0]).unwrap();
            let local = parse_real(&dest, old.len() as u64, meta.id.clone());
            let server = serve(new.clone(), Mode::Normal);
            let started = Instant::now();
            let report = run(&server.slice, &dest, Some(&local)).unwrap();
            let elapsed = started.elapsed().as_millis();

            assert_eq!(fs::read(&dest).unwrap(), new, "{name} must match the release byte for byte");
            let served = server.served.load(Ordering::SeqCst);

            // Every page of the updated pack must be readable, across all its chunks.
            let updated = parse_real(&dest, new.len() as u64, meta.id.clone());
            let pages = updated.html_routes();
            assert!(!pages.is_empty(), "{name} has no pages");
            for route in &pages {
                let page = updated.read_route(route).unwrap_or_else(|| panic!("{name}: {route} is unreadable"));
                let html = decompress_html_body_if_needed(&page.bytes, page.encoding.as_deref(), page.gzipped);
                assert!(html.contains('<'), "{name}: {route} did not decode");
            }
            total_pages += pages.len();
            if let Some(search) = updated.read_route(crate::pack::SEARCH_ROUTE) {
                let json = decompress_html_body_if_needed(&search.bytes, search.encoding.as_deref(), search.gzipped);
                serde_json::from_str::<Vec<serde_json::Value>>(&json).expect("search index must parse");
            }
            println!(
                "{:<14}{:>10.2}{:>11.2}{:>7.1}%{:>9}{:>7}",
                meta.id,
                new.len() as f64 / 1048576.0,
                served as f64 / 1048576.0,
                served as f64 / new.len() as f64 * 100.0,
                report.downloaded_chunks,
                elapsed,
            );
            total_new += new.len() as u64;
            total_served += served;
            let _ = fs::remove_dir_all(dir);
        }
        println!(
            "TOTAL fetched {:.2} MB of {:.2} MB ({:.1}%), {} pages read back",
            total_served as f64 / 1048576.0,
            total_new as f64 / 1048576.0,
            total_served as f64 / total_new as f64 * 100.0,
            total_pages,
        );
    }

    /// Reads every pack in a folder the way startup does, then one page from each:
    /// `DOCX_E2E_LIBRARY=<dir> cargo test --release --lib library_loads -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn library_loads_and_reads() {
        let dir = PathBuf::from(std::env::var("DOCX_E2E_LIBRARY").expect("DOCX_E2E_LIBRARY"));
        let files: Vec<PathBuf> = fs::read_dir(dir)
            .unwrap()
            .flatten()
            .map(|e| e.path())
            .filter(|p| p.extension().is_some_and(|e| e == "docpack"))
            .collect();

        let started = Instant::now();
        let packs: Vec<_> = files
            .iter()
            .filter_map(|p| parse_docpack_on_disk(p.clone(), 0, fs::metadata(p).unwrap().len(), "test"))
            .collect();
        let load_ms = started.elapsed().as_secs_f64() * 1000.0;

        let mut pages = 0;
        for pack in &packs {
            let routes = pack.html_routes();
            let Some(route) = routes.first() else { continue };
            let page = pack.read_route(route).unwrap_or_else(|| panic!("{}: {route}", pack.meta.id));
            let html = decompress_html_body_if_needed(&page.bytes, page.encoding.as_deref(), page.gzipped);
            assert!(html.contains('<'), "{}: {route} did not decode", pack.meta.id);
            pages += 1;
        }
        println!(
            "{} files, {} packs parsed in {load_ms:.1} ms, {pages} sample pages read",
            files.len(),
            packs.len()
        );
    }

    /// Range requests and resume against a published file on the real host and its CDN:
    /// `DOCX_E2E_URL=<release asset url> cargo test --lib published_file -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn published_file_serves_ranges_and_resumes() {
        let url = std::env::var("DOCX_E2E_URL").expect("DOCX_E2E_URL");
        let dir = temp_dir("published");
        let whole_path = dir.join("whole.bin");
        let mut sink = |_: DownloadProgressPayload| {};
        let mut progress = Progress::new(SITE, &mut sink);
        let total = download_resumable(&url, None, &whole_path, 0, "Downloading", &mut progress).unwrap();
        let whole = fs::read(&whole_path).unwrap();
        assert_eq!(whole.len() as u64, total);

        for (start, end) in [(0u64, 64u64), (total / 2, total / 2 + 4096), (total - 100, total)] {
            let bytes = fetch_range(&url, start, end).unwrap();
            assert_eq!(bytes, whole[start as usize..end as usize], "range {start}-{end}");
        }

        let probe = http_client().get(&url).header(reqwest::header::RANGE, "bytes=0-0").send().unwrap();
        let etag = probe.headers().get(reqwest::header::ETAG).expect("ETag").to_str().unwrap().to_string();
        drop(probe);
        let half = total / 2;
        let conditional = http_client()
            .get(&url)
            .header(reqwest::header::RANGE, format!("bytes={half}-"))
            .header(reqwest::header::IF_RANGE, etag.as_str())
            .send()
            .unwrap();
        println!("etag {etag}: If-Range answered {}", conditional.status());
        assert_eq!(conditional.status(), reqwest::StatusCode::PARTIAL_CONTENT);
        drop(conditional);

        let part = dir.join("resumed.docpack.part");
        fs::write(&part, &whole[..half as usize]).unwrap();
        fs::write(part.with_extension("etag"), &etag).unwrap();
        download_resumable(&url, None, &part, total, "Downloading", &mut progress).unwrap();
        assert_eq!(fs::read(&part).unwrap(), whole, "resumed file must equal the original");
        println!("{total} bytes: ranges match, resume from {half} matches");
    }

    fn parse_real(path: &Path, len: u64, id: String) -> Arc<SiteOverridePack> {
        parse_docpack_on_disk(path.to_path_buf(), 0, len, "test")
            .unwrap_or_else(|| panic!("{id} did not parse; is it in the catalog?"))
    }
}
