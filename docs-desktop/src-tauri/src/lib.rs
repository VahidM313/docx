use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom, Write};
use std::net::{TcpListener, TcpStream};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::Command;
use std::sync::{Arc, RwLock};
use std::thread;
use std::time::Duration;

static ASSETS_PACK: &[u8] = include_bytes!("../assets.pack");
const TRAILER_MAGIC: &[u8; 8] = b"DOCXPACK";
const RELEASE_BASE_URL: &str = "https://github.com/VahidM313/docx/releases/download/packs-latest";

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
    pub site_ports: RwLock<HashMap<String, u16>>,
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
    let mut cmd = Command::new("curl.exe");
    cmd.arg("-sL").arg("--fail");
    if let Some((start, end)) = range {
        cmd.arg("-r").arg(format!("{}-{}", start, end));
    }
    cmd.arg(url);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let output = cmd.output().map_err(|e| format!("curl error: {}", e))?;
    if !output.status.success() {
        return Err(format!("HTTP fetch failed for {}", url));
    }
    Ok(output.stdout)
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
        site_ports: RwLock::new(HashMap::new()),
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

fn get_site_origin_and_entry(site_id: &str) -> Option<(&'static str, &'static str)> {
    match site_id {
        "tailwind" | "tw" => Some(("https://tailwindcss.com", "/docs/installation/using-vite")),
        "shadcn" | "sh" => Some(("https://ui.shadcn.com", "/docs")),
        "react" => Some(("https://react.dev", "/learn")),
        "nextjs" => Some(("https://nextjs.org", "/docs")),
        "vite" => Some(("https://vite.dev", "/guide/")),
        "astro" => Some(("https://docs.astro.build", "/en/getting-started/")),
        "typescript" => Some(("https://www.typescriptlang.org", "/docs/handbook/intro.html")),
        "mdn_js" => Some(("https://developer.mozilla.org", "/en-US/docs/Web/JavaScript")),
        "htmx" => Some(("https://htmx.org", "/docs/")),
        "bun" => Some(("https://bun.sh", "/docs")),
        "elysia" => Some(("https://elysiajs.com", "/table-of-content.html")),
        "drizzle" => Some(("https://orm.drizzle.team", "/docs/overview")),
        "oxc" => Some(("https://oxc.rs", "/docs/guide/introduction.html")),
        "rust" => Some(("https://doc.rust-lang.org", "/book/")),
        "go" => Some(("https://go.dev", "/doc/")),
        "cppreference" => Some(("https://en.cppreference.com", "/")),
        "learncpp" => Some(("https://www.learncpp.com", "/")),
        "llvm" => Some(("https://llvm.org", "/docs/")),
        "lua" => Some(("https://www.lua.org", "/manual/5.4/")),
        "docker" => Some(("https://docs.docker.com", "/get-started/")),
        "git" => Some(("https://git-scm.com", "/docs/git")),
        "curl" => Some(("https://curl.se", "/docs/")),
        "cmake" => Some(("https://cmake.org", "/cmake/help/latest/index.html")),
        "ninja" => Some(("https://ninja-build.org", "/manual.html")),
        "powershell" => Some(("https://learn.microsoft.com", "/en-us/powershell/scripting/overview")),
        "cmd" => Some(("https://learn.microsoft.com", "/en-us/windows-server/administration/windows-commands/windows-commands")),
        "tanstack_start" => Some(("https://tanstack.com", "/start/latest/docs/framework/react/overview")),
        "tanstack_router" => Some(("https://tanstack.com", "/router/latest/docs/framework/react/overview")),
        "tanstack_query" => Some(("https://tanstack.com", "/query/latest/docs/framework/react/overview")),
        "tanstack_table" => Some(("https://tanstack.com", "/table/latest/docs/introduction")),
        "tanstack_form" => Some(("https://tanstack.com", "/form/latest/docs/overview")),
        "tanstack_virtual" => Some(("https://tanstack.com", "/virtual/latest/docs/introduction")),
        "tanstack_store" => Some(("https://tanstack.com", "/store/latest/docs/overview")),
        "tanstack_db" => Some(("https://tanstack.com", "/db/latest/docs/overview")),
        "tanstack_ai" => Some(("https://tanstack.com", "/ai/latest/docs/overview")),
        "tanstack_pacer" => Some(("https://tanstack.com", "/pacer/latest/docs/overview")),
        "tanstack_ranger" => Some(("https://tanstack.com", "/ranger/latest/docs/overview")),
        "tanstack_config" => Some(("https://tanstack.com", "/config/latest/docs/overview")),
        "tanstack_devtools" => Some(("https://tanstack.com", "/devtools/latest/docs/overview")),
        "tanstack_hotkeys" => Some(("https://tanstack.com", "/hotkeys/latest/docs/overview")),
        "tanstack_react_charts" => Some(("https://react-charts.tanstack.com", "/docs/overview")),
        "tanstack_create_tsrouter_app" => Some(("https://tanstack.com", "/router/latest/docs/framework/react/quick-start")),
        _ => None,
    }
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

fn inject_reader_bridge(site_key: &str, mut html: String) -> Vec<u8> {
    if html.contains("id=\"docx-reader-bridge\"") {
        return html.into_bytes();
    }
    let site_id = match site_key {
        "tw" => "tailwind",
        "sh" => "shadcn",
        other => other,
    };
    let origin = get_site_origin_and_entry(site_id)
        .map(|(o, _)| o)
        .unwrap_or("")
        .to_string();

    if !origin.is_empty() {
        html = html.replace(&format!("href=\"{}/", origin), "href=\"/");
        html = html.replace(&format!("src=\"{}/", origin), "src=\"/");
    }

    let inject = format!(
        r#"<style id="docx-styled-scroll">
::-webkit-scrollbar {{ width: 8px !important; height: 8px !important; }}
::-webkit-scrollbar-track {{ background: #070709 !important; }}
::-webkit-scrollbar-thumb {{ background-color: #24242b !important; border-radius: 999px !important; border: 2px solid #070709 !important; min-height: 36px !important; }}
::-webkit-scrollbar-thumb:hover {{ background-color: #3a3a45 !important; }}
* {{ scrollbar-width: thin; scrollbar-color: #24242b #070709; }}

html.docx-force-dark {{
  filter: invert(0.93) hue-rotate(180deg) !important;
  background-color: #ffffff !important;
  min-height: 100%;
}}
html.docx-force-dark body {{
  background-color: #ffffff !important;
}}
html.docx-force-dark img,
html.docx-force-dark video,
html.docx-force-dark canvas,
html.docx-force-dark picture,
html.docx-force-dark [style*="background-image"] {{
  filter: invert(1) hue-rotate(180deg) !important;
}}
</style>
<script id="docx-reader-bridge">
(function(){{
  var SITE_ID = "{}";
  var SITE_ORIGIN = "{}";
  var KNOWN_LIGHT_SITES = {{
    cppreference: true,
    learncpp: true,
    lua: true,
    cmake: true,
    git: true,
    curl: true,
    go: true,
    htmx: true,
    ninja: true,
    llvm: true
  }};

  function isPageBackgroundLight() {{
    try {{
      var elems = [document.body, document.documentElement];
      for (var i = 0; i < elems.length; i++) {{
        var el = elems[i];
        if (!el) continue;
        var bg = window.getComputedStyle(el).backgroundColor || "";
        var m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
        if (m) {{
          var alpha = m[4] !== undefined ? parseFloat(m[4]) : 1;
          if (alpha < 0.1) continue;
          var r = parseInt(m[1], 10), g = parseInt(m[2], 10), b = parseInt(m[3], 10);
          var lum = 0.299 * r + 0.587 * g + 0.114 * b;
          return lum > 145;
        }}
      }}
    }} catch (e) {{}}
    return false;
  }}

  function applyReaderSettings(zoomPct, darkEnabled) {{
    try {{
      var z = Math.max(60, Math.min(220, Number(zoomPct) || 100));
      document.documentElement.style.zoom = (z / 100).toString();
      localStorage.setItem('docx_zoom', String(z));
      localStorage.setItem('docx_dark', darkEnabled ? '1' : '0');

      if (darkEnabled) {{
        localStorage.setItem('theme', 'dark');
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
        document.documentElement.style.colorScheme = 'dark';
        if (KNOWN_LIGHT_SITES[SITE_ID] || isPageBackgroundLight()) {{
          document.documentElement.classList.add('docx-force-dark');
        }} else {{
          document.documentElement.classList.remove('docx-force-dark');
        }}
      }} else {{
        document.documentElement.classList.remove('docx-force-dark');
        if (!KNOWN_LIGHT_SITES[SITE_ID]) {{
          localStorage.setItem('theme', 'light');
          document.documentElement.classList.remove('dark');
          document.documentElement.setAttribute('data-theme', 'light');
          document.documentElement.style.colorScheme = 'light';
        }}
      }}
    }} catch (e) {{}}
  }}

  try {{
    var savedZoom = parseInt(localStorage.getItem('docx_zoom') || '100', 10);
    var savedDark = localStorage.getItem('docx_dark') !== '0';
    applyReaderSettings(savedZoom, savedDark);
    window.addEventListener('DOMContentLoaded', function() {{
      applyReaderSettings(
        parseInt(localStorage.getItem('docx_zoom') || '100', 10),
        localStorage.getItem('docx_dark') !== '0'
      );
      window.parent.postMessage({{ type: 'DOCX_IFRAME_READY', siteId: SITE_ID }}, '*');
    }});
    window.addEventListener('load', function() {{
      applyReaderSettings(
        parseInt(localStorage.getItem('docx_zoom') || '100', 10),
        localStorage.getItem('docx_dark') !== '0'
      );
      window.parent.postMessage({{ type: 'DOCX_IFRAME_READY', siteId: SITE_ID }}, '*');
    }});
  }} catch (e) {{}}

  window.addEventListener('message', function(e) {{
    if (!e.data || e.data.type !== 'DOCX_READER_SETTINGS') return;
    applyReaderSettings(e.data.zoom, e.data.darkMode);
  }});

  window.addEventListener('keydown', function(e){{
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){{
      e.preventDefault(); e.stopPropagation();
      window.parent.postMessage({{ type: 'OPEN_UNIVERSAL_SEARCH' }}, '*');
    }} else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {{
      e.preventDefault(); e.stopPropagation();
      window.parent.postMessage({{ type: 'DOCX_ZOOM_DELTA', delta: 10 }}, '*');
    }} else if ((e.ctrlKey || e.metaKey) && e.key === '-') {{
      e.preventDefault(); e.stopPropagation();
      window.parent.postMessage({{ type: 'DOCX_ZOOM_DELTA', delta: -10 }}, '*');
    }} else if ((e.ctrlKey || e.metaKey) && e.key === '0') {{
      e.preventDefault(); e.stopPropagation();
      window.parent.postMessage({{ type: 'DOCX_ZOOM_RESET' }}, '*');
    }}
  }}, true);
  var lastL = 0, lastT = 0;
  window.addEventListener('mousemove', function(e){{
    var now = Date.now();
    if (e.clientX <= 18 && now - lastL > 120) {{ lastL = now; window.parent.postMessage({{ type: 'HOVER_LEFT_EDGE' }}, '*'); }}
    if (e.clientY <= 10 && now - lastT > 120) {{ lastT = now; window.parent.postMessage({{ type: 'HOVER_TOP_EDGE' }}, '*'); }}
  }}, {{ passive: true }});
  window.addEventListener('mousedown', function(){{
    window.parent.postMessage({{ type: 'IFRAME_INTERACT' }}, '*');
  }}, {{ passive: true }});
  document.addEventListener('click', function(e){{
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if(!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var href = a.getAttribute('href');
    if(!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:') || a.getAttribute('target') === '_blank') return;
    try {{
      var resolved = new URL(href, window.location.href);
      if (resolved.origin === window.location.origin || (SITE_ORIGIN && resolved.origin === SITE_ORIGIN)) {{
        e.preventDefault(); e.stopPropagation();
        window.location.href = resolved.pathname + resolved.search + resolved.hash;
      }}
    }} catch(err) {{}}
  }}, true);
}})();
</script>"#,
        site_id, origin
    );

    if let Some(pos) = html.rfind("</body>") {
        html.insert_str(pos, &inject);
    } else {
        html.push_str(&inject);
    }
    html.into_bytes()
}

fn fetch_live_fallback(site_key: &str, raw_target: &str, decoded_path: &str) -> Option<(String, bool, Vec<u8>)> {
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
        other => (other, other),
    };

    let candidates = [
        decoded_path.to_string(),
        format!("{}.html", decoded_path),
        format!("{}/index.html", decoded_path),
        decoded_path.trim_end_matches(".html").to_string(),
    ];

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
            } else {
                None
            }
        })
        .or_else(|| fetch_live_fallback(&site_key, raw_target, &decoded_path));

    if let Some((mime, mut gzipped, mut body)) = resolved {
        if mime.starts_with("text/html") {
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
    let bytes = curl_get_bytes(&url, None)?;
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
        let (installed, local_commit) = if let Some(pack) = guard.get(&item.id) {
            (true, pack.manifest.commit.clone())
        } else if item.id == "tailwind" {
            (true, "f8a2c91".to_string())
        } else if item.id == "shadcn" {
            (true, "d4e71b3".to_string())
        } else {
            (false, String::new())
        };
        let update_available =
            installed && !local_commit.is_empty() && !item.commit.is_empty() && local_commit != item.commit;
        let effective_bytes = if item.sizeBytes > 0 {
            item.sizeBytes
        } else if item.totalBytes > 0 {
            item.totalBytes
        } else if item.sizeMB > 0.0 {
            (item.sizeMB * 1024.0 * 1024.0) as usize
        } else {
            0
        };
        out.push(RemoteRegistryItem {
            id: item.id,
            name: item.name,
            version: item.version,
            commit: item.commit,
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
                raw_bytes: existing.raw_bytes.clone(),
                source: "Outdated Local Pack".to_string(),
            }),
        );
        Ok(format!("Simulated outdated commit (old-7f21a09) on '{}'", site_id))
    } else {
        Err(format!("Pack '{}' is not in overrides yet", site_id))
    }
}


#[tauri::command]
fn get_extra_search_entries() -> Vec<serde_json::Value> {
    let mut all = Vec::new();
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
                        all.extend(items);
                    }
                }
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

    let mut cmd = Command::new("curl.exe");
    cmd.arg("-sL").arg("--fail").arg("-o").arg(dest_path).arg(url);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn curl: {}", e))?;

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                if !status.success() {
                    let _ = fs::remove_file(dest_path);
                    return Err(format!("HTTP download failed for {}", url));
                }
                break;
            }
            Ok(None) => {
                let cur_bytes = fs::metadata(dest_path).map(|m| m.len() as usize).unwrap_or(0);
                let total = expected_total.max(cur_bytes).max(1);
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
                thread::sleep(Duration::from_millis(65));
            }
            Err(e) => return Err(format!("Download wait error: {}", e)),
        }
    }

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

    let packs_dir = get_packs_dir();
    let _ = fs::create_dir_all(&packs_dir);
    let _ = fs::write(
        packs_dir.join(format!("{}.manifest.json", site_id)),
        &remote_manifest_bytes,
    );

    if let Ok(search_bytes) = curl_get_bytes(&search_url, None) {
        let _ = fs::write(packs_dir.join(format!("{}.search.json", site_id)), search_bytes);
    }

    let mut local_chunks_by_hash: HashMap<String, Vec<u8>> = HashMap::new();
    let mut old_commit = String::from("not-installed");

    {
        let guard = store.overrides.read().unwrap();
        if let Some(pack) = guard.get(&site_id) {
            old_commit = pack.manifest.commit.clone();
            for entry in pack.manifest.routes.values() {
                let start = pack.data_start + entry.offset;
                let end = start + entry.length;
                if end <= pack.raw_bytes.len() && !entry.hash.is_empty() {
                    local_chunks_by_hash
                        .insert(entry.hash.clone(), pack.raw_bytes[start..end].to_vec());
                }
            }
        }
    }

    if local_chunks_by_hash.is_empty() {
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

        if let Some(parsed) = parse_docpack_bytes(full_pack_bytes, "GitHub Release .docpack") {
            store
                .overrides
                .write()
                .unwrap()
                .insert(site_id.clone(), parsed);
        }
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
            new_commit: remote_manifest.commit.clone(),
            total_chunks: remote_manifest.chunkCount,
            reused_chunks: 0,
            downloaded_chunks: remote_manifest.chunkCount,
            reused_bytes: 0,
            downloaded_bytes: dl_bytes,
            saved_percent: 0.0,
            port,
            message: format!(
                "Installed {} ({}) from GitHub Releases ({:.2} MB, {} routes) on port :{}!",
                remote_manifest.name,
                remote_manifest.version,
                dl_bytes as f64 / (1024.0 * 1024.0),
                remote_manifest.routes.len(),
                port
            ),
        });
    }

    // Already installed: perform HTTP 206 Partial Content Range Delta Update for ONLY changed chunks!
    let remote_data_start = 4 + remote_manifest_bytes.len();
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
    fs::write(&docpack_path, &full_docpack).map_err(|e| e.to_string())?;

    if let Some(parsed) = parse_docpack_bytes(full_docpack, "GitHub Delta .docpack") {
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
fn bundle_into_single_exe(state: tauri::State<'_, AppState>) -> Result<String, String> {
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
        let len = pack.raw_bytes.len() as u32;
        trailer_payload.extend_from_slice(&len.to_le_bytes());
        trailer_payload.extend_from_slice(&pack.raw_bytes);
    }

    let trailer_len = trailer_payload.len() as u64;
    exe_bytes.extend_from_slice(&trailer_payload);
    exe_bytes.extend_from_slice(&trailer_len.to_le_bytes());
    exe_bytes.extend_from_slice(TRAILER_MAGIC);

    let out_path = PathBuf::from("C:/Users/vahid/OneDrive/Desktop/Docx.exe");
    let tmp_path = PathBuf::from("C:/Users/vahid/OneDrive/Desktop/Docx.new.exe");
    fs::write(&tmp_path, &exe_bytes).map_err(|e| e.to_string())?;

    let old_backup = PathBuf::from("C:/Users/vahid/OneDrive/Desktop/Docx.old.exe");
    let _ = fs::remove_file(&old_backup);
    if fs::rename(&out_path, &old_backup).is_ok() {
        let _ = fs::rename(&tmp_path, &out_path);
        let _ = fs::remove_file(&old_backup);
        Ok(format!(
            "Updated standalone Desktop\\Docx.exe in-place with {} embedded packs ({:.2} MB total)!",
            guard.len(),
            exe_bytes.len() as f64 / (1024.0 * 1024.0)
        ))
    } else {
        Ok(format!(
            "Exported standalone Desktop\\Docx.new.exe ({:.2} MB) with {} embedded packs!",
            exe_bytes.len() as f64 / (1024.0 * 1024.0),
            guard.len()
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
fn window_toggle_fullscreen(window: tauri::Window) {
    let is_fs = window.is_fullscreen().unwrap_or(false);
    let _ = window.set_fullscreen(!is_fs);
}

#[tauri::command]
fn window_close(window: tauri::Window) {
    let _ = window.close();
}

#[tauri::command]
fn window_start_dragging(window: tauri::Window) {
    let _ = window.start_dragging();
}

#[tauri::command]
fn window_show_ready(window: tauri::Window) {
    if !window.is_maximized().unwrap_or(false) {
        let _ = window.maximize();
    }
    let _ = window.show();
    let _ = window.set_focus();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri::Manager;
    let _ = fs::remove_file("C:/Users/vahid/OneDrive/Desktop/Docx.old.exe");

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

    tauri::Builder::default()
        .manage(AppState {
            tailwind_port,
            shadcn_port,
            store,
        })
        .setup(|app| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_background_color(Some(tauri::window::Color(0, 0, 0, 255)));
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

