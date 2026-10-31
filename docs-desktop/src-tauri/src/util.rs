//! Small internal utilities: hashing, URL decoding, MIME guessing, HTTP helpers.

use std::sync::LazyLock;
use std::time::Duration;

use crate::error::{DocxError, Result};

pub(crate) fn to_hex(bytes: &[u8]) -> String {
    use std::fmt::Write;
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        let _ = write!(&mut out, "{:02x}", b);
    }
    out
}

pub(crate) fn sha256_hex_16(bytes: &[u8]) -> String {
    to_hex(&ring::digest::digest(&ring::digest::SHA256, bytes).as_ref()[..8])
}

fn build_client(total: Option<Duration>) -> reqwest::blocking::Client {
    reqwest::blocking::Client::builder()
        .user_agent("Docx/1.0")
        .connect_timeout(Duration::from_secs(15))
        .timeout(total)
        .pool_max_idle_per_host(4)
        .tcp_keepalive(Duration::from_secs(30))
        .build()
        .expect("HTTP client with static settings")
}

/// Shared client for transfers. Reqwest's blocking client has no read timeout, and the
/// time a transfer may take depends on its size, so each request sets its own budget.
pub(crate) fn http_client() -> &'static reqwest::blocking::Client {
    static CLIENT: LazyLock<reqwest::blocking::Client> = LazyLock::new(|| build_client(None));
    &CLIENT
}

/// Client for requests a reader is waiting on, where a quick failure beats a late answer.
fn interactive_client() -> &'static reqwest::blocking::Client {
    static CLIENT: LazyLock<reqwest::blocking::Client> =
        LazyLock::new(|| build_client(Some(Duration::from_secs(6))));
    &CLIENT
}

/// Small metadata fetches: registry and app manifest.
fn metadata_client() -> &'static reqwest::blocking::Client {
    static CLIENT: LazyLock<reqwest::blocking::Client> =
        LazyLock::new(|| build_client(Some(Duration::from_secs(30))));
    &CLIENT
}

pub(crate) fn get_metadata(url: &str) -> Result<Vec<u8>> {
    get_bytes(metadata_client(), url)
}

/// Fetch made while a page waits for it.
pub(crate) fn get_interactive(url: &str) -> Result<Vec<u8>> {
    get_bytes(interactive_client(), url)
}

fn get_bytes(client: &reqwest::blocking::Client, url: &str) -> Result<Vec<u8>> {
    let resp = client.get(url).send()?;
    let status = resp.status();
    if !status.is_success() {
        return Err(DocxError::HttpStatus {
            status: status.as_u16(),
            url: url.to_string(),
        });
    }
    let bytes = resp.bytes()?;
    Ok(bytes.to_vec())
}

pub(crate) fn url_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len()
            && let (Some(h), Some(l)) = (
                (bytes[i + 1] as char).to_digit(16),
                (bytes[i + 2] as char).to_digit(16),
            ) {
                out.push(((h << 4) | l) as u8);
                i += 3;
                continue;
            }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

pub(crate) fn guess_mime_from_path(path: &str) -> &'static str {
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

