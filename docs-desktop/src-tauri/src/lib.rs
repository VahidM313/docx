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

static CUSTOM_PACKS_DIR: std::sync::OnceLock<PathBuf> = std::sync::OnceLock::new();

pub fn set_packs_dir(dir: PathBuf) {
    let _ = CUSTOM_PACKS_DIR.set(dir);
}

fn get_packs_dir() -> PathBuf {
    if let Some(dir) = CUSTOM_PACKS_DIR.get() {
        let _ = fs::create_dir_all(dir);
        return dir.clone();
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

fn get_site_origin_and_entry(site_id: &str) -> Option<(&'static str, &'static str)> {
    match site_id {
        "tailwind" | "tw" => Some(("https://tailwindcss.com", "/docs/installation/using-vite")),
        "shadcn" | "sh" => Some(("https://ui.shadcn.com", "/docs")),
        "react" => Some(("https://react.dev", "/learn")),
        "nextjs" => Some(("https://nextjs.org", "/docs")),
        "vite" => Some(("https://vite.dev", "/guide/")),
        "astro" => Some(("https://docs.astro.build", "/en/getting-started/")),
        "typescript" => Some(("https://www.typescriptlang.org", "/docs/handbook/intro.html")),
        "mdn_js" | "js" => Some(("https://developer.mozilla.org", "/en-US/docs/Web/JavaScript")),
        "mdn_css" | "css" => Some(("https://developer.mozilla.org", "/en-US/docs/Web/CSS")),
        "mdn_html" | "html" => Some(("https://developer.mozilla.org", "/en-US/docs/Web/HTML")),
        "mdn_wasm" | "wasm" => Some(("https://developer.mozilla.org", "/en-US/docs/WebAssembly")),
        "htmx" => Some(("https://htmx.org", "/docs/")),
        "bun" => Some(("https://bun.sh", "/docs")),
        "elysia" => Some(("https://elysiajs.com", "/table-of-content")),
        "drizzle" => Some(("https://orm.drizzle.team", "/docs/overview")),
        "oxc" => Some(("https://oxc.rs", "/docs/guide/introduction.html")),
        "rust" => Some(("https://doc.rust-lang.org", "/book/")),
        "go" => Some(("https://go.dev", "/doc/")),
        "cppreference" => Some(("https://en.cppreference.com", "/")),
        "learncpp" => Some(("https://www.learncpp.com", "/")),
        "llvm" => Some(("https://llvm.org", "/docs/")),
        "emscripten" => Some(("https://emscripten.org", "/docs/")),
        "lua" => Some(("https://www.lua.org", "/manual/5.4/")),
        "docker" => Some(("https://docs.docker.com", "/get-started/")),
        "git" => Some(("https://git-scm.com", "/docs/git")),
        "curl" => Some(("https://curl.se", "/docs/")),
        "cmake" => Some(("https://cmake.org", "/cmake/help/latest/index.html")),
        "ninja" => Some(("https://ninja-build.org", "/manual.html")),
        "powershell" => Some(("https://learn.microsoft.com", "/en-us/powershell/scripting/overview")),
        "cmd" => Some(("https://learn.microsoft.com", "/en-us/windows-server/administration/windows-commands/windows-commands")),
        "tanstack_start" => Some(("https://tanstack.com", "/start/latest/docs/framework/react/overview")),
        "tanstack_router" => Some(("https://tanstack.com", "/router/latest/docs/overview")),
        "tanstack_query" => Some(("https://tanstack.com", "/query/latest/docs/framework/react/overview")),
        "tanstack_table" => Some(("https://tanstack.com", "/table/latest/docs/overview")),
        "tanstack_form" => Some(("https://tanstack.com", "/form/latest/docs/overview")),
        "tanstack_virtual" => Some(("https://tanstack.com", "/virtual/latest/docs/introduction")),
        "tanstack_store" => Some(("https://tanstack.com", "/store/latest/docs/overview")),
        "tanstack_db" => Some(("https://tanstack.com", "/db/latest/docs/overview")),
        "tanstack_ai" => Some(("https://tanstack.com", "/ai/latest/docs/getting-started/overview")),
        "tanstack_pacer" => Some(("https://tanstack.com", "/pacer/latest/docs/overview")),
        "tanstack_ranger" => Some(("https://tanstack.com", "/ranger/latest/docs/overview")),
        "tanstack_config" => Some(("https://tanstack.com", "/config/latest/docs/overview")),
        "tanstack_devtools" => Some(("https://tanstack.com", "/devtools/latest/docs/overview")),
        "tanstack_hotkeys" => Some(("https://tanstack.com", "/hotkeys/latest/docs/overview")),
        "tanstack_react_charts" => Some(("https://react-charts.tanstack.com", "/docs/overview")),
        "tanstack_create_tsrouter_app" => Some(("https://tanstack.com", "/router/latest/docs/quick-start")),
        "python" => Some(("https://docs.python.org", "/3/")),
        "threejs" => Some(("https://threejs.org", "/docs/")),
        "motion" => Some(("https://motion.dev", "/docs")),
        "vue" => Some(("https://vuejs.org", "/guide/introduction.html")),
        "nuxt" => Some(("https://nuxt.com", "/docs/4.x/getting-started/introduction")),
        "angular" => Some(("https://v17.angular.io", "/docs")),
        "hono" => Some(("https://hono.dev", "/docs/")),
        "express" => Some(("https://expressjs.com", "/")),
        "nestjs" => Some(("https://docs.nestjs.com", "/")),
        "qt" => Some(("https://doc.qt.io", "/")),
        "boost" => Some(("https://www.boost.org", "/doc/libs/latest/libs/libraries.htm")),
        "django" => Some(("https://docs.djangoproject.com", "/en/6.1/")),
        "fastapi" => Some(("https://fastapi.tiangolo.com", "/")),
        "postgresql" => Some(("https://www.postgresql.org", "/docs/")),
        "sqlite" => Some(("https://www.sqlite.org", "/docs.html")),
        "react_hook_form" => Some(("https://react-hook-form.com", "/get-started")),
        "radix_ui" => Some(("https://www.radix-ui.com", "/primitives/docs/overview/introduction")),
        "zustand" => Some(("https://zustand.docs.pmnd.rs", "/getting-started/introduction")),
        "lucide" => Some(("https://lucide.dev", "/icons")),
        "swr" => Some(("https://swr.vercel.app", "/docs/getting-started")),
        "pinia" => Some(("https://pinia.vuejs.org", "/introduction.html")),
        "vueuse" => Some(("https://vueuse.org", "/guide/")),
        "vue_router" => Some(("https://router.vuejs.org", "/introduction.html")),
        "svelte" => Some(("https://svelte.dev", "/docs/svelte/overview")),
        "solidjs" => Some(("https://docs.solidjs.com", "/quick-start")),
        "nodejs" => Some(("https://nodejs.org", "/docs/latest-v22.x/api/")),
        "zod" => Some(("https://zod.dev", "/")),
        "gin" => Some(("https://gin-gonic.com", "/en/docs/")),
        "gorm" => Some(("https://gorm.io", "/docs/")),
        "redis" => Some(("https://redis.io", "/docs/latest/")),
        "prisma" => Some(("https://www.prisma.io", "/docs/getting-started")),
        "mongodb" => Some(("https://www.mongodb.com", "/docs/manual/")),
        "sqlalchemy" => Some(("https://docs.sqlalchemy.org", "/en/20/")),
        "pytorch" => Some(("https://pytorch.org", "/docs/stable/index.html")),
        "langchain" => Some(("https://python.langchain.com", "/oss/python/langchain/overview")),
        "huggingface" => Some(("https://huggingface.co", "/docs/transformers/index")),
        "ollama" => Some(("https://docs.ollama.com", "/")),
        "numpy" => Some(("https://numpy.org", "/doc/stable/")),
        "pandas" => Some(("https://pandas.pydata.org", "/docs/")),
        "scikit_learn" => Some(("https://scikit-learn.org", "/stable/")),
        "kubernetes" => Some(("https://kubernetes.io", "/docs/home/")),
        "nginx" => Some(("https://nginx.org", "/en/docs/")),
        "caddy" => Some(("https://caddyserver.com", "/docs/")),
        "opentofu" => Some(("https://opentofu.org", "/docs/intro/")),
        "ansible" => Some(("https://docs.ansible.com", "/ansible/latest/index.html")),
        "tokio" => Some(("https://tokio.rs", "/tokio/tutorial")),
        "axum" => Some(("https://docs.rs", "/axum/latest/axum/")),
        "json_cpp" => Some(("https://json.nlohmann.me", "/")),
        "fmt_cpp" => Some(("https://fmt.dev", "/latest/")),
        "raylib" => Some(("https://www.raylib.com", "/cheatsheet/cheatsheet.html")),
        "design_patterns" => Some(("https://refactoring.guru", "/design-patterns")),
        "material_design" => Some(("https://material-web.dev", "/components/button/")),
        "refactoring" => Some(("https://refactoring.guru", "/refactoring")),
        "better_auth" => Some(("https://www.better-auth.com", "/docs/introduction")),
        "duckdb" => Some(("https://duckdb.org", "/docs/")),
        "mysql" => Some(("https://dev.mysql.com", "/doc/refman/8.4/en/")),
        "mariadb" => Some(("https://mariadb.com", "/kb/en/documentation/")),
        "chroma" => Some(("https://docs.trychroma.com", "/")),
        "qdrant" => Some(("https://qdrant.tech", "/documentation/")),
        "tensorflow" => Some(("https://www.tensorflow.org", "/api_docs/python/tf")),
        "keras" => Some(("https://keras.io", "/guides/")),
        "flask" => Some(("https://flask.palletsprojects.com", "/")),
        "pydantic" => Some(("https://docs.pydantic.dev", "/")),
        "requests_py" => Some(("https://requests.readthedocs.io", "/")),
        "celery" => Some(("https://docs.celeryq.dev", "/")),
        "serde" => Some(("https://serde.rs", "/")),
        "actix_web" => Some(("https://actix.rs", "/docs/")),
        "bevy" => Some(("https://bevyengine.org", "/learn/quick-start/introduction/")),
        "clap" => Some(("https://docs.rs", "/clap/latest/clap/")),
        "fiber" => Some(("https://docs.gofiber.io", "/")),
        "echo" => Some(("https://echo.labstack.com", "/docs")),
        "cobra" => Some(("https://cobra.dev", "/")),
        "opencv" => Some(("https://docs.opencv.org", "/4.x/")),
        "imgui" => Some(("https://pthom.github.io", "/imgui_manual_online/manual/imgui_manual.html")),
        "catch2" => Some(("https://github.com", "/catchorg/Catch2/blob/devel/docs/Readme.md")),
        "spdlog" => Some(("https://github.com", "/gabime/spdlog/wiki")),
        "matplotlib" => Some(("https://matplotlib.org", "/stable/")),
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

fn strip_html_attribute(html: &mut String, attr_name: &str) {
    let mut search_from = 0;
    while let Some(pos) = html[search_from..].find(attr_name) {
        let abs_pos = search_from + pos;
        if abs_pos > 0 {
            let prev = html.as_bytes()[abs_pos - 1];
            if prev != b' ' && prev != b'\t' && prev != b'\n' {
                search_from = abs_pos + attr_name.len();
                continue;
            }
        }
        let after_attr = abs_pos + attr_name.len();
        if after_attr < html.len() && html.as_bytes()[after_attr] == b'=' {
            let val_start = after_attr + 1;
            if val_start < html.len() {
                let quote = html.as_bytes()[val_start];
                if quote == b'"' || quote == b'\'' {
                    if let Some(end_quote) = html[val_start + 1..].find(quote as char) {
                        let abs_end = val_start + 1 + end_quote + 1;
                        html.replace_range(abs_pos..abs_end, "");
                        search_from = abs_pos;
                        continue;
                    }
                } else {
                    let mut end = val_start;
                    while end < html.len() {
                        let b = html.as_bytes()[end];
                        if b == b' ' || b == b'>' || b == b'\t' || b == b'\n' {
                            break;
                        }
                        end += 1;
                    }
                    html.replace_range(abs_pos..end, "");
                    search_from = abs_pos;
                    continue;
                }
            }
        }
        search_from = abs_pos + attr_name.len();
    }
}

fn inject_reader_bridge(site_key: &str, mut html: String) -> Vec<u8> {
    if html.contains("id=\"docx-reader-bridge\"") {
        return html.into_bytes();
    }
    let site_id = match site_key {
        "tw" => "tailwind",
        "sh" => "shadcn",
        "css" => "mdn_css",
        "html" => "mdn_html",
        "js" => "mdn_js",
        "wasm" => "mdn_wasm",
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

    // Strip SRI integrity and crossorigin hashes to prevent browsers blocking rewritten local stylesheets (Git, Cobra)
    strip_html_attribute(&mut html, "integrity");
    strip_html_attribute(&mut html, "crossorigin");

    // Neutralize blocking external analytics/hydration/preload tags so pages render in <10ms, while preserving SPAs (Three.js, Nest, Angular, Lucide)
    if site_id != "threejs" && site_id != "nestjs" && site_id != "angular" && site_id != "lucide" {
        html = html
            .replace("rel=\"modulepreload\"", "rel=\"docx-disabled\"")
            .replace("rel='modulepreload'", "rel='docx-disabled'");
    }
    html = html
        .replace("https://www.googletagmanager.com/gtm.js", "data:text/javascript,")
        .replace("https://api.motion.dev/score/badge", "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7#")
        .replace("import \"https://motion.dev/assets/", "// import \"https://motion.dev/assets/")
        .replace("import \"/assets/manifest-", "// import \"/assets/manifest-");

    if site_id == "qt" {
        html = html.replace("href=\"/qt/", "href=\"/qt-6/");
    }

    // Ensure all documentation pages are responsive on mobile screens
    if !html.contains("name=\"viewport\"") && !html.contains("name='viewport'") {
        if let Some(pos) = html.find("<head>").or_else(|| html.find("<HEAD>")) {
            html.insert_str(pos + 6, "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover\" />");
        }
    }

    if site_id == "lucide" {
        html = html.replace(
            "</body>",
            r#"<script src="/assets/docx-lucide-bundle.js"></script></body>"#,
        );
    }

    // Strip any legacy baked-in <style id="docx-styled-scroll">...</script> snippet from older docpacks
    // so its unconditional dark-mode override never conflicts with runtime theme synchronization.
    if let Some(old_idx) = html.find("<style id=\"docx-styled-scroll\">") {
        if let Some(body_end) = html[old_idx..].find("</body>") {
            html.replace_range(old_idx..(old_idx + body_end), "");
        } else {
            html.truncate(old_idx);
        }
    }

    let inject = r###"<style id="docx-styled-scroll">
/* Hide empty Carbon ad floating banner in Lucide Icons */
.floating-ad, .VPDocAsideCarbonAds, .VPCarbonAds {
  display: none !important;
}
::-webkit-scrollbar { width: 8px !important; height: 8px !important; }
::-webkit-scrollbar-track { background: #070709 !important; }
::-webkit-scrollbar-thumb { background-color: #24242b !important; border-radius: 999px !important; border: 2px solid #070709 !important; min-height: 36px !important; }
::-webkit-scrollbar-thumb:hover { background-color: #3a3a45 !important; }
* { scrollbar-width: thin; scrollbar-color: #24242b #070709; }

html.docx-smart-dark,
html.docx-smart-dark body {
  background-color: #1e1e22 !important;
  color: #ffffff !important;
  color-scheme: dark !important;
}

html.docx-smart-light,
html.docx-smart-light body {
  background-color: #ffffff !important;
  color: #000000 !important;
  color-scheme: light !important;
}

/* Responsive media containment (prevents Pandas & scientific SVGs and wide images from overflowing) */
.bd-content svg, .bd-content img, .figure svg, .figure img, svg.output_svg, .jp-RenderedSVG,
article img, article svg:not([class*="icon"]):not([class*="lucide"]),
main img, main svg:not([class*="icon"]):not([class*="lucide"]) {
  max-width: 100% !important;
  height: auto !important;
}

/* VitePress (Hono, Vue, Elysia, Vite, Pinia, etc.) interactive sidebar & menu rules */
.VPSidebarItem.collapsible > .item { cursor: pointer !important; user-select: none; }
.VPSidebarItem.collapsible.collapsed > .items { display: none !important; }
.VPSidebarItem.collapsible:not(.collapsed) > .items { display: block !important; }
.VPSidebarItem.collapsible > .item .caret { transition: transform 0.2s ease; }
.VPSidebarItem.collapsible:not(.collapsed) > .item .caret { transform: rotate(90deg); }
.vp-code-group .tabs label { cursor: pointer; }
@media (max-width: 959px) {
  .VPSidebar.open {
    opacity: 1 !important;
    visibility: visible !important;
    transform: translateX(0) !important;
    transition: opacity 0.25s, transform 0.25s ease !important;
    z-index: 100 !important;
  }
}

/* Express.js sidebar triggers */
[data-submenu-trigger], [data-back-button], [data-toggle-nested-button] {
  cursor: pointer;
}

/* Rust mdBook code block container & syntax highlighting theme rules */
#mdbook-body-container pre > code {
  display: block;
  overflow-x: auto;
  padding: 1rem;
  border-radius: 5px;
}
#mdbook-body-container :not(pre) > code.hljs {
  display: inline;
  padding: 0.1em 0.3em;
  border-radius: 3px;
}
html.navy #mdbook-body-container pre > code,
html.coal #mdbook-body-container pre > code,
html.navy #mdbook-body-container :not(pre) > code.hljs,
html.coal #mdbook-body-container :not(pre) > code.hljs {
  background: #1d1f21 !important;
  color: #c5c8c6;
}
html.ayu #mdbook-body-container pre > code,
html.ayu #mdbook-body-container :not(pre) > code.hljs {
  background: #191f26 !important;
  color: #e6e1cf;
}
html.light #mdbook-body-container pre > code,
html.rust #mdbook-body-container pre > code,
html.light #mdbook-body-container :not(pre) > code.hljs,
html.rust #mdbook-body-container :not(pre) > code.hljs {
  background: #f6f7f6 !important;
  color: #000000;
}
html.navy #mdbook-body-container .hljs-comment, html.coal #mdbook-body-container .hljs-comment { color: #969896 !important; }
html.navy #mdbook-body-container .hljs-variable, html.navy #mdbook-body-container .hljs-attribute, html.navy #mdbook-body-container .hljs-attr, html.navy #mdbook-body-container .hljs-tag, html.navy #mdbook-body-container .hljs-regexp,
html.coal #mdbook-body-container .hljs-variable, html.coal #mdbook-body-container .hljs-attribute, html.coal #mdbook-body-container .hljs-attr, html.coal #mdbook-body-container .hljs-tag, html.coal #mdbook-body-container .hljs-regexp { color: #cc6666 !important; }
html.navy #mdbook-body-container .hljs-number, html.navy #mdbook-body-container .hljs-built_in, html.navy #mdbook-body-container .hljs-builtin-name, html.navy #mdbook-body-container .hljs-literal, html.navy #mdbook-body-container .hljs-type, html.navy #mdbook-body-container .hljs-params, html.navy #mdbook-body-container .hljs-meta, html.navy #mdbook-body-container .hljs-symbol,
html.coal #mdbook-body-container .hljs-number, html.coal #mdbook-body-container .hljs-built_in, html.coal #mdbook-body-container .hljs-builtin-name, html.coal #mdbook-body-container .hljs-literal, html.coal #mdbook-body-container .hljs-type, html.coal #mdbook-body-container .hljs-params, html.coal #mdbook-body-container .hljs-meta, html.coal #mdbook-body-container .hljs-symbol { color: #de935f !important; }
html.navy #mdbook-body-container .hljs-string, html.navy #mdbook-body-container .hljs-bullet,
html.coal #mdbook-body-container .hljs-string, html.coal #mdbook-body-container .hljs-bullet { color: #b5bd68 !important; }
html.navy #mdbook-body-container .hljs-title, html.navy #mdbook-body-container .hljs-section,
html.coal #mdbook-body-container .hljs-title, html.coal #mdbook-body-container .hljs-section { color: #8abeb7 !important; }
html.navy #mdbook-body-container .hljs-keyword, html.navy #mdbook-body-container .hljs-selector-tag,
html.coal #mdbook-body-container .hljs-keyword, html.coal #mdbook-body-container .hljs-selector-tag { color: #b294bb !important; }
html.ayu #mdbook-body-container .hljs-comment { color: #5c6773 !important; }
html.ayu #mdbook-body-container .hljs-variable, html.ayu #mdbook-body-container .hljs-attribute, html.ayu #mdbook-body-container .hljs-attr, html.ayu #mdbook-body-container .hljs-regexp, html.ayu #mdbook-body-container .hljs-keyword, html.ayu #mdbook-body-container .hljs-symbol { color: #ff7733 !important; }
html.ayu #mdbook-body-container .hljs-number, html.ayu #mdbook-body-container .hljs-meta, html.ayu #mdbook-body-container .hljs-builtin-name, html.ayu #mdbook-body-container .hljs-literal, html.ayu #mdbook-body-container .hljs-type, html.ayu #mdbook-body-container .hljs-params { color: #ffee99 !important; }
html.ayu #mdbook-body-container .hljs-string, html.ayu #mdbook-body-container .hljs-bullet { color: #b8cc52 !important; }
html.ayu #mdbook-body-container .hljs-title, html.ayu #mdbook-body-container .hljs-built_in, html.ayu #mdbook-body-container .hljs-section { color: #ffb454 !important; }
html.light #mdbook-body-container .hljs-comment, html.rust #mdbook-body-container .hljs-comment { color: #575757 !important; }
html.light #mdbook-body-container .hljs-variable, html.light #mdbook-body-container .hljs-attribute, html.light #mdbook-body-container .hljs-attr, html.light #mdbook-body-container .hljs-tag, html.light #mdbook-body-container .hljs-regexp,
html.rust #mdbook-body-container .hljs-variable, html.rust #mdbook-body-container .hljs-attribute, html.rust #mdbook-body-container .hljs-attr, html.rust #mdbook-body-container .hljs-tag, html.rust #mdbook-body-container .hljs-regexp { color: #d70025 !important; }
html.light #mdbook-body-container .hljs-number, html.light #mdbook-body-container .hljs-meta, html.light #mdbook-body-container .hljs-built_in, html.light #mdbook-body-container .hljs-builtin-name, html.light #mdbook-body-container .hljs-literal, html.light #mdbook-body-container .hljs-type, html.light #mdbook-body-container .hljs-params,
html.rust #mdbook-body-container .hljs-number, html.rust #mdbook-body-container .hljs-meta, html.rust #mdbook-body-container .hljs-built_in, html.rust #mdbook-body-container .hljs-builtin-name, html.rust #mdbook-body-container .hljs-literal, html.rust #mdbook-body-container .hljs-type, html.rust #mdbook-body-container .hljs-params { color: #b21e00 !important; }
html.light #mdbook-body-container .hljs-string, html.light #mdbook-body-container .hljs-symbol, html.light #mdbook-body-container .hljs-bullet,
html.rust #mdbook-body-container .hljs-string, html.rust #mdbook-body-container .hljs-symbol, html.rust #mdbook-body-container .hljs-bullet { color: #008200 !important; }
html.light #mdbook-body-container .hljs-title, html.light #mdbook-body-container .hljs-section,
html.rust #mdbook-body-container .hljs-title, html.rust #mdbook-body-container .hljs-section { color: #0030f2 !important; }
html.light #mdbook-body-container .hljs-keyword, html.light #mdbook-body-container .hljs-selector-tag,
html.rust #mdbook-body-container .hljs-keyword, html.rust #mdbook-body-container .hljs-selector-tag { color: #9d00ec !important; }
</style>
<script id="docx-reader-bridge">
(function(){
  var SITE_ID = "__DOCX_SITE_ID__";
  var SITE_ORIGIN = "__DOCX_SITE_ORIGIN__";

  function applyCustomFont(fontEnabled) {
    try {
      var existing = document.getElementById("docx-custom-font");
      if (!fontEnabled) {
        if (existing) existing.remove();
        return;
      }
      if (!existing) {
        existing = document.createElement("style");
        existing.id = "docx-custom-font";
        existing.textContent =
          "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');" +
          "html, body, #cpp-head-first, #cpp-head-second, #content, #mw-content-text, " +
          "p, div, span, a, li, td, th, h1, h2, h3, h4, h5, h6, input, select, button, " +
          ".t-navbar, .t-nv, .t-nv-ln-table, .t-dsc, .t-par, .wikitable { " +
          "font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important; " +
          "-webkit-font-smoothing: antialiased !important; letter-spacing: -0.011em; } " +
          "code, pre, tt, kbd, samp, .mw-geshi, .mw-geshi *, .source-cpp, .source-cpp *, .source-c, .source-c *, .t-c, .t-c *, .t-lc, .t-lc *, .highlight *, .prism * { " +
          "font-family: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace !important; letter-spacing: 0 !important; }";
        (document.head || document.documentElement).appendChild(existing);
      }
    } catch (e) {}
  }

  // Known strictly single-theme sites (also verified dynamically via computed background luminance)
  var LIGHT_ONLY_SITES = {
    cppreference: true,
    learncpp: true,
    lua: true,
    cmake: true,
    boost: true,
    sqlite: true,
    tanstack_react_charts: true,
    raylib: true,
    material_design: true,
    refactoring: true,
    design_patterns: true
  };

  var DARK_ONLY_SITES = {};

  var isApplyingTheme = false;
  var currentSmartMode = null;

  function getSystemDarkDefault() {
    try {
      var sys = localStorage.getItem('docx_system_dark');
      if (sys === '1') return true;
      if (sys === '0') return false;
      if (window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
    } catch (e) {}
    return true;
  }

  function getSavedSiteDark() {
    try {
      var perSite = localStorage.getItem('docx_dark_v3_' + SITE_ID);
      if (perSite !== null) return perSite !== '0';
      var globalVal = localStorage.getItem('docx_dark_v3');
      if (globalVal !== null) return globalVal !== '0';
    } catch (e) {}
    return getSystemDarkDefault();
  }

  function getSavedThemeEnabled() {
    try {
      var v = localStorage.getItem('docx_theme_enabled');
      if (v !== null) return v !== '0';
    } catch (e) {}
    return true;
  }

  function getSavedFontEnabled() {
    try {
      var v = localStorage.getItem('docx_font_enabled');
      if (v !== null) return v === '1';
    } catch (e) {}
    return SITE_ID === 'cppreference';
  }

  function parseRgba(str) {
    if (!str || str === 'transparent' || str === 'none') return null;
    var m = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?\s*\)/i);
    if (!m) return null;
    var r = parseInt(m[1], 10);
    var g = parseInt(m[2], 10);
    var b = parseInt(m[3], 10);
    var a = m[4] !== undefined ? parseFloat(m[4]) : 1;
    return { r: r, g: g, b: b, a: a };
  }

  function rgbToHslAndLum(r, g, b) {
    var rn = r / 255, gn = g / 255, bn = b / 255;
    var max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    var h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
        case gn: h = (bn - rn) / d + 2; break;
        case bn: h = (rn - gn) / d + 4; break;
      }
      h /= 6;
    }
    var lum = 0.2126 * rn + 0.7152 * gn + 0.0722 * bn;
    return { h: Math.round(h * 360), s: s, l: l, lum: lum };
  }

  function getEffectivePageLuminance() {
    try {
      var candidates = [
        document.body,
        document.documentElement,
        document.querySelector('main, #content, article, .content, .VPDoc, .md-main')
      ];
      for (var i = 0; i < candidates.length; i++) {
        var el = candidates[i];
        if (!el) continue;
        var cs = window.getComputedStyle(el);
        var c = parseRgba(cs.backgroundColor);
        if (c && c.a > 0.15) {
          return rgbToHslAndLum(c.r, c.g, c.b).lum;
        }
      }
    } catch (e) {}
    return null;
  }

  function clearSmartSingleTheme() {
    try {
      var root = document.documentElement;
      root.classList.remove('docx-smart-dark', 'docx-smart-light', 'docx-force-dark');
      currentSmartMode = null;
      var styled = document.querySelectorAll('[data-docx-orig-style]');
      for (var i = 0; i < styled.length; i++) {
        var el = styled[i];
        var orig = el.getAttribute('data-docx-orig-style');
        el.removeAttribute('data-docx-orig-style');
        if (orig === '') {
          el.removeAttribute('style');
        } else if (orig !== null) {
          el.setAttribute('style', orig);
        }
      }
    } catch (e) {}
  }

  // Smart color-preserving restyler for Light-only sites -> Dark mode (dark grey bg + white text + keep visible colors)
  // and Dark-only sites -> Light mode (white bg + black text + keep visible colors)
  function applySmartSingleTheme(targetMode) {
    if (!document.body) return;
    try {
      if (currentSmartMode && currentSmartMode !== targetMode) {
        clearSmartSingleTheme();
      }
      var root = document.documentElement;
      root.classList.remove('docx-force-dark');
      root.classList.toggle('docx-smart-dark', targetMode === 'dark');
      root.classList.toggle('docx-smart-light', targetMode === 'light');
      currentSmartMode = targetMode;

      var skipTags = {
        IMG: 1, SVG: 1, PATH: 1, CIRCLE: 1, RECT: 1, POLYGON: 1, LINE: 1, POLYLINE: 1,
        VIDEO: 1, CANVAS: 1, PICTURE: 1, IFRAME: 1, SCRIPT: 1, STYLE: 1, LINK: 1, META: 1, HEAD: 1
      };

      var all = document.body.getElementsByTagName('*');
      var len = all.length;
      for (var i = 0; i < len; i++) {
        var el = all[i];
        if (skipTags[el.tagName]) continue;
        if (el.hasAttribute('data-docx-smart-mode') && el.getAttribute('data-docx-smart-mode') === targetMode) {
          continue;
        }
        var cs = window.getComputedStyle(el);
        var bg = parseRgba(cs.backgroundColor);
        var fg = parseRgba(cs.color);
        var bd = parseRgba(cs.borderTopColor);

        var newBg = null, newFg = null, newBd = null;

        if (targetMode === 'dark') {
          // Light-only site -> Dark Grey background (#1e1e22 / #27272d) & White text (#ffffff), keeping visible colors
          if (bg && bg.a > 0.08) {
            var bgInfo = rgbToHslAndLum(bg.r, bg.g, bg.b);
            if (bgInfo.lum > 0.48) {
              if (bgInfo.s < 0.16) {
                newBg = bgInfo.lum > 0.90 ? '#1e1e22' : '#27272d';
              } else {
                var satD = Math.round(Math.min(bgInfo.s * 100, 55));
                newBg = 'hsl(' + bgInfo.h + ', ' + satD + '%, 20%)';
              }
            }
          }
          if (fg && fg.a > 0.08) {
            var fgInfo = rgbToHslAndLum(fg.r, fg.g, fg.b);
            if (fgInfo.s < 0.14) {
              if (fgInfo.lum < 0.78) {
                newFg = fgInfo.lum < 0.35 ? '#ffffff' : '#d4d4d8';
              }
            } else {
              // Colored text: keep as-is if already visible on dark grey; otherwise lift lightness while keeping hue
              if (fgInfo.lum < 0.48) {
                var satFgD = Math.round(Math.max(fgInfo.s * 100, 65));
                newFg = 'hsl(' + fgInfo.h + ', ' + satFgD + '%, 68%)';
              }
            }
          }
          if (bd && bd.a > 0.08) {
            var bdInfo = rgbToHslAndLum(bd.r, bd.g, bd.b);
            if (bdInfo.s < 0.16 && bdInfo.lum > 0.55) {
              newBd = '#34343d';
            }
          }
        } else {
          // Dark-only site -> White background (#ffffff / #f4f4f6) & Black text (#000000), keeping visible colors
          if (bg && bg.a > 0.08) {
            var bgInfoL = rgbToHslAndLum(bg.r, bg.g, bg.b);
            if (bgInfoL.lum < 0.48) {
              if (bgInfoL.s < 0.16) {
                newBg = bgInfoL.lum < 0.12 ? '#ffffff' : '#f4f4f6';
              } else {
                var satL = Math.round(Math.min(bgInfoL.s * 100, 60));
                newBg = 'hsl(' + bgInfoL.h + ', ' + satL + '%, 92%)';
              }
            }
          }
          if (fg && fg.a > 0.08) {
            var fgInfoL = rgbToHslAndLum(fg.r, fg.g, fg.b);
            if (fgInfoL.s < 0.14) {
              if (fgInfoL.lum > 0.35) {
                newFg = fgInfoL.lum > 0.72 ? '#000000' : '#3f3f46';
              }
            } else {
              // Colored text: keep as-is if already visible on white; otherwise darken lightness while keeping hue
              if (fgInfoL.lum > 0.48) {
                var satFgL = Math.round(Math.max(fgInfoL.s * 100, 65));
                newFg = 'hsl(' + fgInfoL.h + ', ' + satFgL + '%, 34%)';
              }
            }
          }
          if (bd && bd.a > 0.08) {
            var bdInfoL = rgbToHslAndLum(bd.r, bd.g, bd.b);
            if (bdInfoL.s < 0.16 && bdInfoL.lum < 0.45) {
              newBd = '#e4e4e7';
            }
          }
        }

        if (newBg || newFg || newBd) {
          if (!el.hasAttribute('data-docx-orig-style')) {
            el.setAttribute('data-docx-orig-style', el.getAttribute('style') || '');
          }
          if (newBg) el.style.setProperty('background-color', newBg, 'important');
          if (newFg) el.style.setProperty('color', newFg, 'important');
          if (newBd) el.style.setProperty('border-color', newBd, 'important');
        }
        el.setAttribute('data-docx-smart-mode', targetMode);
      }
    } catch (e) {}
  }

  function clearSmartTagsAndRestore() {
    clearSmartSingleTheme();
    try {
      var tagged = document.querySelectorAll('[data-docx-smart-mode]');
      for (var i = 0; i < tagged.length; i++) {
        tagged[i].removeAttribute('data-docx-smart-mode');
      }
    } catch (e) {}
  }

  function syncMediaDarkStylesheets(darkEnabled) {
    try {
      // 1. Toggle <link media="(prefers-color-scheme: dark|light)"> (e.g., Python pydoctheme_dark.css & pygments_dark.css)
      var mediaLinks = document.querySelectorAll('link[media*="prefers-color-scheme"], link[data-docx-dark-media]');
      for (var m = 0; m < mediaLinks.length; m++) {
        var lnk = mediaLinks[m];
        if (!lnk.hasAttribute('data-docx-dark-media')) {
          lnk.setAttribute('data-docx-dark-media', lnk.getAttribute('media') || '');
        }
        var origMedia = lnk.getAttribute('data-docx-dark-media') || '';
        if (origMedia.indexOf('dark') !== -1) {
          lnk.setAttribute('media', darkEnabled ? 'all' : 'not all');
        } else if (origMedia.indexOf('light') !== -1) {
          lnk.setAttribute('media', darkEnabled ? 'not all' : 'all');
        }
      }

      // 2. Toggle @media (prefers-color-scheme: dark|light) rules inside same-origin stylesheets (e.g., Three.js, curl, ninja, htmx, Django, Go)
      for (var s = 0; s < document.styleSheets.length; s++) {
        try {
          var rules = document.styleSheets[s].cssRules;
          if (!rules) continue;
          for (var r = 0; r < rules.length; r++) {
            var rule = rules[r];
            if (rule.type === 4 && rule.media) {
              if (!rule._docxOrigMedia) {
                var mt = rule.media.mediaText || '';
                if (mt.indexOf('prefers-color-scheme') !== -1) {
                  rule._docxOrigMedia = mt;
                }
              }
              if (rule._docxOrigMedia) {
                if (rule._docxOrigMedia.indexOf('dark') !== -1) {
                  rule.media.mediaText = darkEnabled ? 'all' : 'not all';
                } else if (rule._docxOrigMedia.indexOf('light') !== -1) {
                  rule.media.mediaText = darkEnabled ? 'not all' : 'all';
                }
              }
            }
          }
        } catch (e) {}
      }

      // 3. Angular theme stylesheet switcher (#aio-initial-theme / dark-theme.css vs light-theme.css)
      if (SITE_ID === 'angular' && document.head) {
        var aioStyle = document.getElementById('aio-initial-theme');
        if (aioStyle) {
          aioStyle.textContent = darkEnabled
            ? '@import url("dark-theme.css");'
            : '@import url("light-theme.css");';
        }
        var ngLink = document.getElementById('docx-angular-theme');
        if (!ngLink) {
          ngLink = document.createElement('link');
          ngLink.id = 'docx-angular-theme';
          ngLink.rel = 'stylesheet';
          document.head.appendChild(ngLink);
        }
        var targetHref = darkEnabled ? '/dark-theme.css' : '/light-theme.css';
        if (ngLink.getAttribute('href') !== targetHref) {
          ngLink.setAttribute('href', targetHref);
        }
      }
    } catch (e) {}
  }

  function applyRustMdbookTheme(themeChoice) {
    try {
      var root = document.documentElement;
      root.classList.add('js');
      var raw = String(themeChoice || '').toLowerCase().replace(/^mdbook-theme-/, '').replace(/^theme-/, '');
      if (raw !== 'light' && raw !== 'rust' && raw !== 'coal' && raw !== 'navy' && raw !== 'ayu' && raw !== 'default_theme') {
        raw = getSavedSiteDark()
          ? (localStorage.getItem('docx_rust_dark_theme') || 'navy')
          : (localStorage.getItem('docx_rust_light_theme') || 'light');
      }
      localStorage.setItem('docx_rust_theme_choice', raw);
      var effective = raw;
      if (raw === 'default_theme') {
        localStorage.removeItem('mdbook-theme');
        effective = getSystemDarkDefault()
          ? (localStorage.getItem('docx_rust_dark_theme') || 'navy')
          : (localStorage.getItem('docx_rust_light_theme') || 'light');
      } else {
        localStorage.setItem('mdbook-theme', raw);
        if (raw === 'navy' || raw === 'coal' || raw === 'ayu') {
          localStorage.setItem('docx_rust_dark_theme', raw);
        } else if (raw === 'light' || raw === 'rust') {
          localStorage.setItem('docx_rust_light_theme', raw);
        }
      }

      root.classList.remove('light', 'rust', 'coal', 'navy', 'ayu', 'default_theme');
      root.classList.add(effective);

      var isDark = (effective === 'navy' || effective === 'coal' || effective === 'ayu');
      root.classList.toggle('dark', isDark);
      root.setAttribute('data-theme', isDark ? 'dark' : 'light');
      root.style.colorScheme = isDark ? 'dark' : 'light';

      var ayuCss = document.querySelector('#mdbook-ayu-highlight-css, #ayu-highlight-css');
      var tmwCss = document.querySelector('#mdbook-tomorrow-night-css, #tomorrow-night-css');
      var hlCss = document.querySelector('#mdbook-highlight-css, #highlight-css');
      if (ayuCss && tmwCss && hlCss) {
        if (effective === 'ayu') {
          ayuCss.disabled = false;
          tmwCss.disabled = true;
          hlCss.disabled = true;
        } else if (effective === 'coal' || effective === 'navy') {
          ayuCss.disabled = true;
          tmwCss.disabled = false;
          hlCss.disabled = true;
        } else {
          ayuCss.disabled = true;
          tmwCss.disabled = true;
          hlCss.disabled = false;
        }
      }

      var btns = document.querySelectorAll('#mdbook-theme-list button.theme, #theme-list button.theme');
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        var bId = String(b.id || '').toLowerCase().replace(/^mdbook-theme-/, '').replace(/^theme-/, '');
        if (bId === raw) {
          b.classList.add('theme-selected');
        } else {
          b.classList.remove('theme-selected');
        }
      }
      return isDark;
    } catch (e) {
      return true;
    }
  }

  function applyReaderSettings(zoomPct, darkEnabled, themeEnabledOpt, fontEnabledOpt) {
    isApplyingTheme = true;
    try {
      var z = Math.max(60, Math.min(220, Number(zoomPct) || 100));
      document.documentElement.style.zoom = (z / 100).toString();
      localStorage.setItem('docx_zoom', String(z));

      var themeEnabled = (typeof themeEnabledOpt === 'boolean') ? themeEnabledOpt : getSavedThemeEnabled();
      var fontEnabled = (typeof fontEnabledOpt === 'boolean') ? fontEnabledOpt : getSavedFontEnabled();
      localStorage.setItem('docx_theme_enabled', themeEnabled ? '1' : '0');
      localStorage.setItem('docx_font_enabled', fontEnabled ? '1' : '0');
      localStorage.setItem('docx_dark_v3', darkEnabled ? '1' : '0');
      localStorage.setItem('docx_dark_v3_' + SITE_ID, darkEnabled ? '1' : '0');

      applyCustomFont(fontEnabled);

      var root = document.documentElement;
      if (!themeEnabled) {
        clearSmartTagsAndRestore();
        syncMediaDarkStylesheets(false);
        if (SITE_ID === 'rust') {
          var savedRustChoice = localStorage.getItem('docx_rust_theme_choice') || localStorage.getItem('mdbook-theme') || 'navy';
          applyRustMdbookTheme(savedRustChoice);
        }
      } else if (LIGHT_ONLY_SITES[SITE_ID]) {
        root.classList.remove('dark');
        root.removeAttribute('data-theme');
        if (darkEnabled) {
          applySmartSingleTheme('dark');
        } else {
          clearSmartTagsAndRestore();
        }
      } else if (DARK_ONLY_SITES[SITE_ID]) {
        if (!darkEnabled) {
          applySmartSingleTheme('light');
        } else {
          clearSmartTagsAndRestore();
        }
      } else {
        clearSmartTagsAndRestore();
        var mode = darkEnabled ? 'dark' : 'light';
        localStorage.setItem('theme', mode);
        localStorage.setItem('zeit-theme', mode);
        localStorage.setItem('theme-preference', mode);
        localStorage.setItem('vitepress-theme-appearance', mode);
        localStorage.setItem('starlight-theme', mode);
        localStorage.setItem('rustdoc-theme', mode);
        localStorage.setItem('force-color-theme', darkEnabled ? 'force-dark' : 'force-light');
        localStorage.setItem('aio-theme', darkEnabled ? 'true' : 'false');

        // Standard .dark / .light classes (Tailwind, React, Next.js, VitePress, Vue, Nuxt, Docker, Bun, Drizzle, Oxc, Hono, Elysia, TanStack)
        root.classList.toggle('dark', !!darkEnabled);
        root.classList.toggle('light', !darkEnabled);

        // Microsoft Learn (PowerShell 7.5 & Windows CMD)
        if (SITE_ID === 'powershell' || SITE_ID === 'cmd') {
          root.classList.toggle('theme-dark', !!darkEnabled);
          root.classList.toggle('theme-light', !darkEnabled);
          root.classList.remove('theme-high-contrast');
        }

        // TypeScript Handbook (.dark-theme / .light-theme)
        if (SITE_ID === 'typescript') {
          root.classList.toggle('dark-theme', !!darkEnabled);
          root.classList.toggle('light-theme', !darkEnabled);
        }

        //PostgreSQL: ensure #form-theme is visible even when external JS was stripped
        if (SITE_ID === 'postgresql') {
          var pgForm = document.getElementById('form-theme');
          if (pgForm) pgForm.classList.remove('d-none');
        }

        // Standard theme attributes on <html> (Astro, MDN, Drizzle, Go, Git, Express, Qt, Django, PostgreSQL, Motion, NestJS, FastAPI, TanStack React Charts)
        root.setAttribute('data-theme', mode);
        root.setAttribute('data-mode', mode);
        root.setAttribute('mode', mode);
        root.setAttribute('data-bs-theme', mode);
        root.setAttribute('data-color-mode', mode);
        root.setAttribute('data-md-color-scheme', darkEnabled ? 'slate' : 'default');
        root.style.colorScheme = mode;

        // Rust mdBook (.navy / .coal / .ayu / .light / .rust) — run after root.classList.toggle('light') so 'rust' isn't overwritten by 'light'
        if (SITE_ID === 'rust') {
          var curMd = localStorage.getItem('mdbook-theme') || '';
          var targetMd = darkEnabled
            ? ((curMd === 'navy' || curMd === 'coal' || curMd === 'ayu') ? curMd : (localStorage.getItem('docx_rust_dark_theme') || 'navy'))
            : ((curMd === 'light' || curMd === 'rust') ? curMd : (localStorage.getItem('docx_rust_light_theme') || 'light'));
          applyRustMdbookTheme(targetMd);
        }

        // Standard theme attributes on <body> (LLVM Furo uses body[data-theme], FastAPI MkDocs uses body[data-md-color-scheme], NestJS/Git use body.dark-mode)
        if (document.body) {
          document.body.setAttribute('data-theme', mode);
          document.body.setAttribute('data-md-color-scheme', darkEnabled ? 'slate' : 'default');
          document.body.classList.toggle('dark-mode', !!darkEnabled);
        }

        // Sync native toggle UI controls (Qt checkbox, Python/Starlight selects, ARIA switches)
        var qtToggle = document.getElementById('th-toggle');
        if (qtToggle && 'checked' in qtToggle) {
          qtToggle.checked = !!darkEnabled;
        }
        var selects = document.querySelectorAll('starlight-theme-select select, .theme-selector, #theme-selector');
        for (var sIdx = 0; sIdx < selects.length; sIdx++) {
          var sel = selects[sIdx];
          if (SITE_ID === 'typescript') {
            sel.value = darkEnabled ? 'force-dark' : 'force-light';
          } else {
            sel.value = mode;
          }
        }
        var toggles = document.querySelectorAll('.theme-toggle, .VPSwitchAppearance');
        for (var i = 0; i < toggles.length; i++) {
          toggles[i].setAttribute('aria-checked', String(!!darkEnabled));
        }
        syncMediaDarkStylesheets(!!darkEnabled);

        // Runtime single-theme check: if after setting native theme attributes, the page background is still light-only or dark-only, convert it!
        if (document.body) {
          var pageLum = getEffectivePageLuminance();
          if (darkEnabled && pageLum !== null && pageLum > 0.62) {
            applySmartSingleTheme('dark');
          } else if (!darkEnabled && pageLum !== null && pageLum < 0.20) {
            applySmartSingleTheme('light');
          }
        }
      }
    } catch (e) {}
    setTimeout(function() { isApplyingTheme = false; }, 30);
  }

  // Observe native theme changes AND handle clicks on the site's own internal theme toggle button
  function setupNativeThemeSync() {
    try {
      var root = document.documentElement;
      if (!LIGHT_ONLY_SITES[SITE_ID] && !DARK_ONLY_SITES[SITE_ID]) {
        var observer = new MutationObserver(function(mutations) {
          if (isApplyingTheme) return;
          for (var i = 0; i < mutations.length; i++) {
            var attr = mutations[i].attributeName;
            if (attr === 'data-theme' || attr === 'class' || attr === 'data-md-color-scheme' || attr === 'data-mode' || attr === 'mode') {
              var dt = (document.body && SITE_ID === 'llvm' ? document.body.getAttribute('data-theme') : root.getAttribute('data-theme')) || root.getAttribute('data-theme');
              var dm = root.getAttribute('data-mode') || root.getAttribute('mode');
              var md = (document.body && document.body.getAttribute('data-md-color-scheme')) || root.getAttribute('data-md-color-scheme');
              var newDark = getSavedSiteDark();
              if (attr === 'data-theme' && (dt === 'dark' || dt === 'light')) {
                newDark = (dt === 'dark');
              } else if ((attr === 'data-mode' || attr === 'mode') && (dm === 'dark' || dm === 'light')) {
                newDark = (dm === 'dark');
              } else if (attr === 'data-md-color-scheme' && md) {
                newDark = (md === 'slate' || md === 'dark');
              } else if (attr === 'class') {
                if (SITE_ID === 'rust') {
                  newDark = root.classList.contains('navy') || root.classList.contains('coal') || root.classList.contains('ayu');
                } else if (SITE_ID === 'powershell' || SITE_ID === 'cmd') {
                  newDark = root.classList.contains('theme-dark');
                } else if (SITE_ID === 'typescript') {
                  newDark = root.classList.contains('dark-theme');
                } else {
                  newDark = root.classList.contains('dark');
                }
              }
              if (newDark !== getSavedSiteDark()) {
                var z = parseInt(localStorage.getItem('docx_zoom') || '100', 10);
                applyReaderSettings(z, newDark);
                window.parent.postMessage({
                  type: 'DOCX_SITE_THEME_CHANGED',
                  siteId: SITE_ID,
                  darkMode: newDark
                }, '*');
              }
              break;
            }
          }
        });
        observer.observe(root, { attributes: true, attributeFilter: ['data-theme', 'class', 'data-md-color-scheme', 'data-mode', 'mode'] });
        if (document.body) {
          observer.observe(document.body, { attributes: true, attributeFilter: ['data-md-color-scheme', 'data-theme', 'class'] });
        }
      }

      var qtToggle = document.getElementById('th-toggle');
      if (qtToggle && !qtToggle.hasAttribute('data-docx-bound')) {
        qtToggle.setAttribute('data-docx-bound', 'true');
        qtToggle.addEventListener('change', function() {
          var nextDark = !!qtToggle.checked;
          var z = parseInt(localStorage.getItem('docx_zoom') || '100', 10);
          applyReaderSettings(z, nextDark);
          window.parent.postMessage({
            type: 'DOCX_SITE_THEME_CHANGED',
            siteId: SITE_ID,
            darkMode: nextDark
          }, '*');
        });
      }

      // Universal listener for sites' internal theme toggle buttons & select dropdowns
      if (!window.__docxUniversalThemeToggleBound) {
        window.__docxUniversalThemeToggleBound = true;
        document.addEventListener('change', function(e) {
          var t = e.target;
          if (!t || !t.matches) return;
          if (t.matches('starlight-theme-select select, .theme-selector, #theme-selector, select[aria-label*="theme" i]')) {
            var val = String(t.value || '').toLowerCase();
            var nextDark = (val === 'dark' || val === 'force-dark')
              ? true
              : (val === 'light' || val === 'force-light')
                ? false
                : getSystemDarkDefault();
            var z = parseInt(localStorage.getItem('docx_zoom') || '100', 10);
            applyReaderSettings(z, nextDark);
            window.parent.postMessage({
              type: 'DOCX_SITE_THEME_CHANGED',
              siteId: SITE_ID,
              darkMode: nextDark
            }, '*');
          }
        }, true);

        document.addEventListener('click', function(e) {
          var t = e.target;
          if (!t || !t.closest) return;
          // Rust mdBook theme toggle & menu are handled directly by initRustDocsUI
          if (SITE_ID === 'rust' && t.closest('#mdbook-theme-toggle, #theme-toggle, #mdbook-theme-list, #theme-list')) {
            return;
          }
          // Microsoft Learn (PowerShell & Windows CMD) explicit theme menu items
          var msLearnBtn = t.closest('[data-theme-to]');
          if (msLearnBtn) {
            e.preventDefault();
            var toVal = String(msLearnBtn.getAttribute('data-theme-to') || '').toLowerCase();
            var isDarkMs = toVal === 'dark' || toVal === 'high-contrast';
            var zMs = parseInt(localStorage.getItem('docx_zoom') || '100', 10);
            applyReaderSettings(zMs, isDarkMs);
            window.parent.postMessage({
              type: 'DOCX_SITE_THEME_CHANGED',
              siteId: SITE_ID,
              darkMode: isDarkMs
            }, '*');
            return;
          }
          var toggleEl = t.closest(
            '.theme-toggle, .VPSwitchAppearance, [data-theme-toggle], ' +
            '#dark-mode-button, #btn-theme, aio-theme-toggle, .mode-toggle, button.toggle-mode, ' +
            '[data-test-id="theme-selector-button"], form[data-md-component="palette"] label, ' +
            'button[aria-label*="theme" i], button[aria-label*="dark" i], button[aria-label*="light" i], button[aria-label*="color mode" i], button[aria-label*="appearance" i], ' +
            'button[title*="theme" i], button[title*="dark" i], button[title*="light" i], ' +
            '[role="switch"][aria-label*="theme" i], [role="switch"][aria-label*="dark" i]'
          );
          if (toggleEl) {
            var prevDark = getSavedSiteDark();
            setTimeout(function() {
              if (getSavedSiteDark() === prevDark) {
                var nextDark = !prevDark;
                var z = parseInt(localStorage.getItem('docx_zoom') || '100', 10);
                applyReaderSettings(z, nextDark);
                window.parent.postMessage({
                  type: 'DOCX_SITE_THEME_CHANGED',
                  siteId: SITE_ID,
                  darkMode: nextDark
                }, '*');
              }
            }, 25);
          }
        }, false);
      }
    } catch (e) {}
  }

  // Express.js interactive sidebar drawer & panel controller
  function initExpressDocsUI() {
    var sidebar = document.querySelector('[data-sidebar]');
    if (!sidebar) return;
    var navContainer = sidebar.querySelector('[data-nav-container]');
    if (!navContainer || navContainer.hasAttribute('data-docx-bound')) return;
    navContainer.setAttribute('data-docx-bound', 'true');

    var panels = sidebar.querySelectorAll('.sidebar-nav-panel');
    var triggers = sidebar.querySelectorAll('[data-submenu-trigger]');

    function openExpressPanel(targetId, targetLevel) {
      var foundPanel = null;
      for (var i = 0; i < panels.length; i++) {
        var p = panels[i];
        if (p.getAttribute('data-parent-id') === targetId) {
          foundPanel = p;
          p.setAttribute('aria-hidden', 'false');
          p.setAttribute('data-open', 'true');
          p.removeAttribute('inert');
          try { p.inert = false; } catch (e) {}
        } else {
          p.setAttribute('aria-hidden', 'true');
          p.removeAttribute('data-open');
          p.setAttribute('inert', '');
          try { p.inert = true; } catch (e) {}
        }
      }
      for (var j = 0; j < triggers.length; j++) {
        var t = triggers[j];
        t.setAttribute('aria-expanded', t.getAttribute('data-target-id') === targetId ? 'true' : 'false');
      }
      if (foundPanel) {
        navContainer.setAttribute('data-current-nav-level', String(targetLevel || '1'));
        sidebar.classList.add('sidebar--expanded');
        document.documentElement.style.setProperty(
          '--sidebar-expanded-width',
          'calc(var(--sidebar-rail-width, 65px) + var(--sidebar-panel-width, 300px))'
        );
      }
    }

    function closeExpressPanels() {
      for (var i = 0; i < panels.length; i++) {
        var p = panels[i];
        p.setAttribute('aria-hidden', 'true');
        p.removeAttribute('data-open');
        p.setAttribute('inert', '');
        try { p.inert = true; } catch (e) {}
      }
      for (var j = 0; j < triggers.length; j++) {
        triggers[j].setAttribute('aria-expanded', 'false');
      }
      navContainer.setAttribute('data-current-nav-level', '0');
      sidebar.classList.remove('sidebar--expanded');
      document.documentElement.style.setProperty('--sidebar-expanded-width', '0px');
    }

    sidebar.addEventListener('click', function(e) {
      var trigger = e.target.closest ? e.target.closest('[data-submenu-trigger]') : null;
      if (trigger) {
        e.preventDefault();
        e.stopPropagation();
        var targetId = trigger.getAttribute('data-target-id');
        var targetLevel = trigger.getAttribute('data-target-level') || '1';
        var activePanel = sidebar.querySelector('.sidebar-nav-panel[data-open="true"]');
        if (activePanel && activePanel.getAttribute('data-parent-id') === targetId && navContainer.getAttribute('data-current-nav-level') !== '0') {
          closeExpressPanels();
        } else if (targetId) {
          openExpressPanel(targetId, targetLevel);
        }
        return;
      }

      var backBtn = e.target.closest ? e.target.closest('[data-back-button]') : null;
      if (backBtn) {
        e.preventDefault();
        e.stopPropagation();
        closeExpressPanels();
        return;
      }

      var toggleNestedBtn = e.target.closest ? e.target.closest('[data-toggle-nested-button]') : null;
      if (toggleNestedBtn) {
        e.preventDefault();
        e.stopPropagation();
        var panel = toggleNestedBtn.closest('.sidebar-nav-panel') || sidebar.querySelector('.sidebar-nav-panel[data-open="true"]');
        if (panel) {
          var detailsList = panel.querySelectorAll('details.submenu-item');
          var anyClosed = false;
          for (var k = 0; k < detailsList.length; k++) {
            if (!detailsList[k].open) { anyClosed = true; break; }
          }
          for (var m = 0; m < detailsList.length; m++) {
            detailsList[m].open = anyClosed;
          }
          toggleNestedBtn.setAttribute('aria-expanded', String(anyClosed));
        }
        return;
      }
    });

    // Version switcher in Express API panel
    var versionSelects = sidebar.querySelectorAll('[data-version-switcher]');
    for (var v = 0; v < versionSelects.length; v++) {
      versionSelects[v].addEventListener('change', function(e) {
        var ver = e.target.value;
        if (ver) window.location.href = '/en/' + ver + '/api.html';
      });
    }

    // Mobile/tablet menu toggle button
    var menuButtons = document.querySelectorAll('[data-menu-toggle], #menu-toggle, .menu-toggle');
    for (var mb = 0; mb < menuButtons.length; mb++) {
      menuButtons[mb].addEventListener('click', function(e) {
        e.preventDefault();
        var isOpen = sidebar.getAttribute('data-mobile-open') === 'true';
        sidebar.setAttribute('data-mobile-open', String(!isOpen));
        sidebar.classList.toggle('sidebar--open', !isOpen);
        document.body.classList.toggle('sidebar-open', !isOpen);
      });
    }

    // Search trigger button in Express header/sidebar
    var searchBtns = document.querySelectorAll('.search-trigger, [data-search-trigger]');
    for (var sb = 0; sb < searchBtns.length; sb++) {
      searchBtns[sb].addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        window.parent.postMessage({ type: 'OPEN_UNIVERSAL_SEARCH' }, '*');
      });
    }

    // Highlight active link & auto-open matching panel
    var curPath = window.location.pathname.replace(/\/$/, '') || '/';
    var matchedPanelId = null;
    var allLinks = sidebar.querySelectorAll('.sidebar-nav-panel a[href]');
    for (var l = 0; l < allLinks.length; l++) {
      var link = allLinks[l];
      var rawHref = (link.getAttribute('href') || '').split('#')[0].replace(/\/$/, '');
      if (rawHref && (rawHref === curPath || rawHref === curPath + '.html' || curPath === rawHref + '.html')) {
        link.setAttribute('aria-current', 'page');
        var parentDetails = link.closest('details.submenu-item');
        while (parentDetails) {
          parentDetails.open = true;
          parentDetails = parentDetails.parentElement ? parentDetails.parentElement.closest('details.submenu-item') : null;
        }
        var parentPanel = link.closest('.sidebar-nav-panel');
        if (parentPanel) {
          matchedPanelId = parentPanel.getAttribute('data-parent-id');
        }
      }
    }
    if (matchedPanelId) {
      openExpressPanel(matchedPanelId, '1');
    }
  }

  // VitePress (Hono, Vue, Elysia, Vite, etc.) interactive sidebar, accordion, menu, code tabs & theme switch controller
  function initVitePressDocsUI() {
    var vpSidebar = document.querySelector('.VPSidebar');
    var vpLayout = document.querySelector('.VPLayout, #VPContent');
    if (!vpSidebar && !vpLayout) return;
    if (document.documentElement.hasAttribute('data-docx-vp-bound')) return;
    document.documentElement.setAttribute('data-docx-vp-bound', 'true');

    // 1. Expand active sidebar section(s) based on current URL, and expand top sections on root /docs
    if (vpSidebar) {
      var normPath = function(p) {
        return (p || '').split('#')[0].split('?')[0].replace(/\.html$/, '').replace(/\/$/, '') || '/';
      };
      var currentPath = normPath(window.location.pathname);
      var links = vpSidebar.querySelectorAll('a.VPLink[href]');
      var anyExpanded = false;
      for (var i = 0; i < links.length; i++) {
        var a = links[i];
        var hrefPath = normPath(a.getAttribute('href'));
        if (hrefPath === currentPath) {
          var itemWrap = a.closest('.VPSidebarItem');
          if (itemWrap) itemWrap.classList.add('is-active');
          var parentCollapsible = a.closest('.VPSidebarItem.collapsible');
          while (parentCollapsible) {
            parentCollapsible.classList.remove('collapsed');
            anyExpanded = true;
            parentCollapsible = parentCollapsible.parentElement
              ? parentCollapsible.parentElement.closest('.VPSidebarItem.collapsible')
              : null;
          }
        }
      }
      if (!anyExpanded) {
        var topCollapsibles = vpSidebar.querySelectorAll('.VPSidebarItem.level-0.collapsible');
        for (var c = 0; c < Math.min(2, topCollapsibles.length); c++) {
          topCollapsibles[c].classList.remove('collapsed');
        }
      }
    }

    // 2. Populate right-side "On this page" outline if empty
    var outlineRoot = document.querySelector('.VPDocAsideOutline .VPDocOutlineItem.root');
    var outlineWrap = document.querySelector('.VPDocAsideOutline');
    if (outlineRoot && outlineWrap && outlineRoot.children.length === 0) {
      var headings = document.querySelectorAll('.vp-doc h2[id], .vp-doc h3[id]');
      if (headings.length > 0) {
        outlineWrap.classList.add('has-outline');
        var htmlItems = [];
        for (var h = 0; h < headings.length; h++) {
          var hd = headings[h];
          var id = hd.getAttribute('id');
          var text = (hd.textContent || '').replace(/#/g, '').trim();
          if (!id || !text) continue;
          var indent = hd.tagName === 'H3' ? ' style="padding-left:12px;"' : '';
          htmlItems.push('<li' + indent + '><a class="outline-link" href="#' + id + '">' + text + '</a></li>');
        }
        outlineRoot.innerHTML = htmlItems.join('');
      }
    }

    // 3. Delegate clicks for accordions, mobile Menu button, code group tabs, copy code button, search, and theme switch
    document.addEventListener('click', function(e) {
      var target = e.target;
      if (!target || !target.closest) return;

      // VitePress Sidebar collapsible accordion toggle
      var caret = target.closest('.VPSidebarItem.collapsible > .item .caret');
      var headerItem = target.closest('.VPSidebarItem.collapsible > .item');
      if (caret || (headerItem && !target.closest('a[href]'))) {
        var section = (caret || headerItem).closest('.VPSidebarItem.collapsible');
        if (section) {
          e.preventDefault();
          e.stopPropagation();
          section.classList.toggle('collapsed');
          return;
        }
      }

      // VitePress LocalNav "Menu" button & top Navbar Hamburger button
      var menuBtn = target.closest('.VPLocalNav .menu, .VPNavBarHamburger');
      if (menuBtn && vpSidebar) {
        e.preventDefault();
        e.stopPropagation();
        var isOpen = vpSidebar.classList.toggle('open');
        menuBtn.setAttribute('aria-expanded', String(isOpen));
        return;
      }

      // Close mobile sidebar when clicking backdrop or a sidebar link on mobile
      if (vpSidebar && vpSidebar.classList.contains('open')) {
        if (target.closest('.VPBackdrop') || target.closest('.VPSidebar a.VPLink[href]')) {
          vpSidebar.classList.remove('open');
        }
      }

      // VitePress "Return to top" button in LocalNav
      var topBtn = target.closest('.VPLocalNavOutlineDropdown button, .top-link');
      if (topBtn && (topBtn.textContent || '').toLowerCase().indexOf('return to top') !== -1) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // VitePress code-group tabs (.vp-code-group .tabs label)
      var tabLabel = target.closest('.vp-code-group .tabs label');
      if (tabLabel) {
        var group = tabLabel.closest('.vp-code-group');
        if (group) {
          var labels = group.querySelectorAll('.tabs label');
          var blocks = group.querySelectorAll('.blocks > div');
          var idx = Array.prototype.indexOf.call(labels, tabLabel);
          if (idx !== -1) {
            for (var b = 0; b < blocks.length; b++) {
              blocks[b].classList.toggle('active', b === idx);
            }
          }
        }
        return;
      }

      // VitePress copy code button
      var copyBtn = target.closest('div[class*="language-"] > button.copy');
      if (copyBtn && copyBtn.parentElement) {
        var codeEl = copyBtn.parentElement.querySelector('pre code');
        if (codeEl && navigator.clipboard) {
          navigator.clipboard.writeText(codeEl.textContent || '').catch(function(){});
          copyBtn.classList.add('copied');
          setTimeout(function() { copyBtn.classList.remove('copied'); }, 2000);
        }
        return;
      }

      // VitePress DocSearch button -> open DOCX Universal Search
      var searchBtn = target.closest('.DocSearch-Button, #local-search button');
      if (searchBtn) {
        e.preventDefault();
        e.stopPropagation();
        window.parent.postMessage({ type: 'OPEN_UNIVERSAL_SEARCH' }, '*');
        return;
      }

      // VitePress Appearance Switch (.VPSwitchAppearance) -> toggle native dark mode & sync with DOCX
      var themeBtn = target.closest('.VPSwitchAppearance');
      if (themeBtn) {
        e.preventDefault();
        e.stopPropagation();
        var nextDark = !document.documentElement.classList.contains('dark');
        var curZoom = parseInt(localStorage.getItem('docx_zoom') || '100', 10);
        applyReaderSettings(curZoom, nextDark);
        window.parent.postMessage({
          type: 'DOCX_SITE_THEME_CHANGED',
          siteId: SITE_ID,
          darkMode: nextDark
        }, '*');
        return;
      }
    }, true);
  }

  function initQtDocsUI() {
    if (SITE_ID !== 'qt') return;
    try {
      var searchInput = document.getElementById('search');
      if (searchInput && !searchInput.hasAttribute('data-docx-bound')) {
        searchInput.setAttribute('data-docx-bound', 'true');
        searchInput.removeAttribute('onclick');
        searchInput.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          window.parent.postMessage({ type: 'OPEN_UNIVERSAL_SEARCH', siteId: 'qt' }, '*');
        });
      }
      var tocEl = document.getElementById('sidebar-toctree');
      if (!tocEl || tocEl.hasAttribute('data-docx-loaded')) return;
      tocEl.setAttribute('data-docx-loaded', 'true');

      fetch('/qt-6/toc-tree.json')
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(data) {
          if (!data || !data.node || !data.node.children) return;
          var curFile = window.location.pathname.split('/').pop() || 'index.html';

          function buildTreeHtml(nodes, depth) {
            if (!nodes || !nodes.length) return '';
            var html = '<ul style="list-style:none;margin:0;padding-left:' + (depth > 0 ? '14px' : '0') + ';">';
            for (var i = 0; i < nodes.length; i++) {
              var n = nodes[i];
              var href = (n.a_attr && n.a_attr.href) ? n.a_attr.href : '#';
              var fullHref = href.startsWith('/') || href.startsWith('http') ? href : ('/qt-6/' + href);
              var isCurrent = (href === curFile);
              var hasChildren = n.children && n.children.length > 0;
              var openAttr = (depth === 0 || isCurrent) ? ' open' : '';
              var linkStyle = 'display:block;padding:4px 8px;border-radius:4px;text-decoration:none;font-size:13px;line-height:1.35;' +
                (isCurrent ? 'background:rgba(65,205,82,0.18);color:#41cd52;font-weight:600;' : 'color:inherit;opacity:0.88;');
              if (hasChildren) {
                html += '<li style="margin:2px 0;"><details' + openAttr + '>' +
                  '<summary style="cursor:pointer;display:flex;align-items:center;gap:4px;padding:3px 4px;font-size:13px;user-select:none;">' +
                  '<a href="' + fullHref + '" style="' + linkStyle + 'display:inline;padding:2px 4px;">' + (n.text || '') + '</a>' +
                  '</summary>' +
                  buildTreeHtml(n.children, depth + 1) +
                  '</details></li>';
              } else {
                html += '<li style="margin:1px 0;"><a href="' + fullHref + '" style="' + linkStyle + '">' + (n.text || '') + '</a></li>';
              }
            }
            html += '</ul>';
            return html;
          }

          tocEl.innerHTML = buildTreeHtml(data.node.children, 0);
        })
        .catch(function() {});
    } catch (e) {}
  }

  function notifyParentReady() {
    window.parent.postMessage({
      type: 'DOCX_IFRAME_READY',
      siteId: SITE_ID,
      title: document.title || '',
      url: window.location.href,
      path: window.location.pathname + window.location.search + window.location.hash
    }, '*');
  }

  function initTypeScriptDocsUI() {
    if (SITE_ID !== 'typescript') return;
    if (window.__docxTsSidebarBound) return;
    window.__docxTsSidebarBound = true;
    document.addEventListener('click', function(e) {
      var target = e.target;
      if (!target || !target.closest) return;
      var mobileBtn = target.closest('#small-device-button-sidebar');
      if (mobileBtn) {
        var sb = document.getElementById('sidebar');
        if (sb) {
          e.preventDefault();
          e.stopPropagation();
          sb.style.display = (sb.style.display === 'none') ? 'block' : '';
        }
        return;
      }
      var btn = target.closest('nav#sidebar li > button');
      if (!btn) return;
      var li = btn.parentElement;
      if (!li || li.tagName !== 'LI') return;
      e.preventDefault();
      e.stopPropagation();
      var isOpen = li.classList.contains('open');
      if (isOpen) {
        li.classList.remove('open');
        li.classList.add('closed');
        btn.setAttribute('aria-expanded', 'false');
      } else {
        li.classList.remove('closed');
        li.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    }, true);
  }

  function initGoDocsUI() {
    if (SITE_ID !== 'go') return;
    if (window.__docxGoHeaderBound) return;
    window.__docxGoHeaderBound = true;
    try {
      var style = document.createElement('style');
      style.textContent =
        '.Header-menuItem:hover .Header-submenu, .Header-menuItem.is-open .Header-submenu { display: block !important; visibility: visible !important; opacity: 1 !important; }';
      (document.head || document.documentElement).appendChild(style);
    } catch (e) {}
    document.addEventListener('click', function(e) {
      var target = e.target;
      if (!target || !target.closest) return;
      var trigger = target.closest('.Header-menuItem > a.js-desktop-menu-hover');
      if (!trigger) {
        document.querySelectorAll('.Header-menuItem.is-open').forEach(function(el) {
          el.classList.remove('is-open');
        });
        return;
      }
      var href = trigger.getAttribute('href') || '';
      if (href === '#' || href === '') {
        e.preventDefault();
        e.stopPropagation();
        var item = trigger.closest('.Header-menuItem');
        if (item) {
          var wasOpen = item.classList.contains('is-open');
          document.querySelectorAll('.Header-menuItem.is-open').forEach(function(el) {
            el.classList.remove('is-open');
          });
          if (!wasOpen) item.classList.add('is-open');
        }
      }
    }, true);
  }

  function initRustDocsUI() {
    if (SITE_ID !== 'rust') return;
    try {
      document.documentElement.classList.add('js');
      var initialChoice = localStorage.getItem('docx_rust_theme_choice') || localStorage.getItem('mdbook-theme') || (getSavedSiteDark() ? 'navy' : 'light');
      applyRustMdbookTheme(initialChoice);

      function markActiveSidebarLink() {
        var sb = document.getElementById('mdbook-sidebar') || document.getElementById('sidebar');
        if (!sb) return;
        var curPath = window.location.pathname;
        if (curPath === '/book' || curPath === '/book/' || curPath === '/' || curPath === '/docs') {
          curPath = '/book/title-page.html';
        } else if (curPath === '/cargo' || curPath === '/cargo/') {
          curPath = '/cargo/index.html';
        }
        var links = sb.querySelectorAll('a[href]');
        for (var i = 0; i < links.length; i++) {
          var a = links[i];
          var h = a.getAttribute('href') || '';
          if (h === curPath || curPath.endsWith('/' + h)) {
            a.classList.add('active');
            var parentLi = a.closest('li.chapter-item');
            while (parentLi) {
              parentLi.classList.add('expanded');
              parentLi = parentLi.parentElement ? parentLi.parentElement.closest('li.chapter-item') : null;
            }
          }
        }
      }
      markActiveSidebarLink();
      setTimeout(markActiveSidebarLink, 120);

      function escHtml(str) {
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      }

      var RUST_KW = {
        as: 1, async: 1, await: 1, break: 1, const: 1, continue: 1, crate: 1, dyn: 1,
        else: 1, enum: 1, extern: 1, fn: 1, for: 1, if: 1, impl: 1, in: 1, let: 1,
        loop: 1, match: 1, mod: 1, move: 1, mut: 1, pub: 1, ref: 1, return: 1,
        self: 1, Self: 1, static: 1, struct: 1, super: 1, trait: 1, type: 1,
        unsafe: 1, use: 1, where: 1, while: 1, yield: 1
      };
      var RUST_BUILTINS = {
        Some: 1, None: 1, Ok: 1, Err: 1, Box: 1, Vec: 1, String: 1, Option: 1, Result: 1,
        Rc: 1, Arc: 1, RefCell: 1, Cell: 1, Mutex: 1, RwLock: 1, Pin: 1, Future: 1,
        Copy: 1, Clone: 1, Debug: 1, Default: 1, Drop: 1, Eq: 1, PartialEq: 1, Ord: 1,
        PartialOrd: 1, Hash: 1, Send: 1, Sync: 1, Sized: 1, Fn: 1, FnMut: 1, FnOnce: 1,
        Iterator: 1, IntoIterator: 1, From: 1, Into: 1, TryFrom: 1, TryInto: 1,
        AsRef: 1, AsMut: 1, Deref: 1, DerefMut: 1, Display: 1, ToString: 1, drop: 1
      };
      var RUST_TYPES = {
        i8: 1, i16: 1, i32: 1, i64: 1, i128: 1, isize: 1,
        u8: 1, u16: 1, u32: 1, u64: 1, u128: 1, usize: 1,
        f32: 1, f64: 1, bool: 1, char: 1, str: 1
      };
      var SHELL_CMDS = {
        mkdir: 1, cd: 1, ls: 1, dir: 1, echo: 1, cat: 1, rm: 1, del: 1, cp: 1, copy: 1,
        mv: 1, move: 1, pwd: 1, export: 1, set: 1, source: 1, sudo: 1, apt: 1, brew: 1,
        curl: 1, sh: 1, bash: 1, git: 1, rustc: 1, cargo: 1, rustup: 1, rustfmt: 1, clippy: 1
      };

      function highlightRustSegment(text) {
        var tokRe = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(#!?\[[^\]]*\])|(b?r#+"[\s\S]*?"#+|b?r"[\s\S]*?"|b?"(?:\\[\s\S]|[^"\\])*"|b?'(?:\\.|[^'\\])')|('[a-zA-Z_][a-zA-Z0-9_]*\b)|(\b(?:0x[0-9a-fA-F_]+|0b[01_]+|0o[0-7_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?[\d_]+)?)(?:u8|u16|u32|u64|u128|usize|i8|i16|i32|i64|i128|isize|f32|f64)?\b)|(\bfn)(\s+)([a-zA-Z_][a-zA-Z0-9_]*)|(\b[a-z_][a-zA-Z0-9_]*!)|(\b[a-zA-Z_][a-zA-Z0-9_]*\b)/g;
        var out = '';
        var lastIdx = 0;
        var m;
        while ((m = tokRe.exec(text)) !== null) {
          if (m.index > lastIdx) {
            out += escHtml(text.slice(lastIdx, m.index));
          }
          if (m[1]) {
            out += '<span class="hljs-comment">' + escHtml(m[1]) + '</span>';
          } else if (m[2]) {
            out += '<span class="hljs-meta">' + escHtml(m[2]) + '</span>';
          } else if (m[3]) {
            out += '<span class="hljs-string">' + escHtml(m[3]) + '</span>';
          } else if (m[4]) {
            out += '<span class="hljs-symbol">' + escHtml(m[4]) + '</span>';
          } else if (m[5]) {
            out += '<span class="hljs-number">' + escHtml(m[5]) + '</span>';
          } else if (m[6]) {
            out += '<span class="hljs-keyword">' + escHtml(m[6]) + '</span>' + escHtml(m[7]) + '<span class="hljs-title">' + escHtml(m[8]) + '</span>';
          } else if (m[9]) {
            out += '<span class="hljs-built_in">' + escHtml(m[9]) + '</span>';
          } else if (m[10]) {
            var id = m[10];
            if (RUST_KW[id]) {
              out += '<span class="hljs-keyword">' + id + '</span>';
            } else if (id === 'true' || id === 'false') {
              out += '<span class="hljs-literal">' + id + '</span>';
            } else if (RUST_BUILTINS[id]) {
              out += '<span class="hljs-built_in">' + id + '</span>';
            } else if (RUST_TYPES[id] || /^[A-Z][A-Za-z0-9_]*$/.test(id)) {
              out += '<span class="hljs-type">' + id + '</span>';
            } else {
              out += id;
            }
          }
          lastIdx = tokRe.lastIndex;
        }
        if (lastIdx < text.length) {
          out += escHtml(text.slice(lastIdx));
        }
        return out;
      }

      function highlightShellLine(line) {
        var shRe = /(#[^\n]*)|("(?:\\.|[^"\\])*"|'[^']*')|(\$\{?[A-Za-z0-9_]+\}?|%[A-Za-z0-9_]+%)|(\s--?[A-Za-z0-9_-]+)|(\b[A-Za-z0-9_.-]+\b)/g;
        var out = '';
        var lastIdx = 0;
        var m;
        while ((m = shRe.exec(line)) !== null) {
          if (m.index > lastIdx) {
            out += escHtml(line.slice(lastIdx, m.index));
          }
          if (m[1]) {
            out += '<span class="hljs-comment">' + escHtml(m[1]) + '</span>';
          } else if (m[2]) {
            out += '<span class="hljs-string">' + escHtml(m[2]) + '</span>';
          } else if (m[3]) {
            out += '<span class="hljs-variable">' + escHtml(m[3]) + '</span>';
          } else if (m[4]) {
            out += '<span class="hljs-attr">' + escHtml(m[4]) + '</span>';
          } else if (m[5]) {
            var w = m[5];
            if (SHELL_CMDS[w]) {
              out += '<span class="hljs-built_in">' + escHtml(w) + '</span>';
            } else {
              out += escHtml(w);
            }
          }
          lastIdx = shRe.lastIndex;
        }
        if (lastIdx < line.length) {
          out += escHtml(line.slice(lastIdx));
        }
        return out;
      }

      function highlightConsoleSegment(text, isPureShell) {
        var lines = text.split('\n');
        var outLines = [];
        for (var i = 0; i < lines.length; i++) {
          var ln = lines[i];
          var pm = ln.match(/^(\s*)(\$|>)\s+(.*)$/);
          if (pm) {
            outLines.push(escHtml(pm[1]) + '<span class="hljs-meta">' + escHtml(pm[2]) + '</span> ' + highlightShellLine(pm[3]));
          } else if (isPureShell) {
            outLines.push(highlightShellLine(ln));
          } else {
            outLines.push(escHtml(ln));
          }
        }
        return outLines.join('\n');
      }

      function highlightTomlSegment(text) {
        var lines = text.split('\n');
        var outLines = [];
        for (var i = 0; i < lines.length; i++) {
          var ln = lines[i];
          if (/^\s*#/.test(ln)) {
            outLines.push('<span class="hljs-comment">' + escHtml(ln) + '</span>');
            continue;
          }
          var sec = ln.match(/^(\s*\[\[?[^\]]+\]\]?)(.*)$/);
          if (sec) {
            outLines.push('<span class="hljs-section">' + escHtml(sec[1]) + '</span>' + escHtml(sec[2]));
            continue;
          }
          var kv = ln.match(/^(\s*[A-Za-z0-9_.-]+)(\s*=\s*)(.*)$/);
          if (kv) {
            var rhs = kv[3].replace(/("(?:\\.|[^"\\])*"|'[^']*')|\b(true|false)\b|\b(\d[\d_.-]*)\b|(#.*$)/g, function(full, s, b, n, c) {
              if (s) return '<span class="hljs-string">' + escHtml(s) + '</span>';
              if (b) return '<span class="hljs-literal">' + escHtml(b) + '</span>';
              if (n) return '<span class="hljs-number">' + escHtml(n) + '</span>';
              if (c) return '<span class="hljs-comment">' + escHtml(c) + '</span>';
              return escHtml(full);
            });
            outLines.push('<span class="hljs-attr">' + escHtml(kv[1]) + '</span>' + escHtml(kv[2]) + rhs);
          } else {
            outLines.push(escHtml(ln));
          }
        }
        return outLines.join('\n');
      }

      function highlightByLang(text, lang) {
        if (lang === 'console' || lang === 'cmd' || lang === 'powershell') {
          return highlightConsoleSegment(text, false);
        }
        if (lang === 'bash' || lang === 'sh' || lang === 'zsh' || lang === 'shell') {
          return highlightConsoleSegment(text, true);
        }
        if (lang === 'toml' || lang === 'ini') {
          return highlightTomlSegment(text);
        }
        if (lang === 'text' || lang === 'plaintext') {
          return escHtml(text);
        }
        return highlightRustSegment(text);
      }

      // 1. Add .hljs to all non-header <code> elements so mdBook inline and block code styling applies
      var allCodes = document.querySelectorAll('code');
      for (var cIdx = 0; cIdx < allCodes.length; cIdx++) {
        var cEl = allCodes[cIdx];
        if (cEl.parentElement && cEl.parentElement.classList.contains('header')) continue;
        cEl.classList.add('hljs');
      }

      // 2. Syntax highlight <pre><code> blocks, setup .boring line toggles & copy-to-clipboard buttons
      var preCodes = document.querySelectorAll('pre > code');
      for (var pIdx = 0; pIdx < preCodes.length; pIdx++) {
        (function(codeBlock) {
          if (codeBlock.getAttribute('data-docx-hl') === '1') return;
          codeBlock.setAttribute('data-docx-hl', '1');

          var cls = codeBlock.className || '';
          var langMatch = cls.match(/language-([a-zA-Z0-9_-]+)/);
          var lang = langMatch ? langMatch[1].toLowerCase() : 'rust';

          if (window.hljs && typeof window.hljs.highlightBlock === 'function') {
            try { window.hljs.highlightBlock(codeBlock); } catch (e) {}
          } else if (!codeBlock.querySelector('[class*="hljs-"]')) {
            var children = Array.prototype.slice.call(codeBlock.childNodes);
            for (var nIdx = 0; nIdx < children.length; nIdx++) {
              var node = children[nIdx];
              if (node.nodeType === 3) {
                var txt = node.nodeValue || '';
                if (txt.length > 0) {
                  var wrap = document.createElement('span');
                  wrap.innerHTML = highlightByLang(txt, lang);
                  var frag = document.createDocumentFragment();
                  while (wrap.firstChild) {
                    frag.appendChild(wrap.firstChild);
                  }
                  codeBlock.replaceChild(frag, node);
                }
              } else if (node.nodeType === 1 && node.classList && node.classList.contains('boring')) {
                node.innerHTML = highlightByLang(node.textContent || '', lang);
              }
            }
          }

          var preEl = codeBlock.parentElement;
          if (!preEl) return;

          var hasBoring = codeBlock.querySelectorAll('.boring').length > 0;
          if (hasBoring) {
            codeBlock.classList.add('hide-boring');
          }

          var btnContainer = preEl.querySelector(':scope > .buttons');
          if (!btnContainer) {
            btnContainer = document.createElement('div');
            btnContainer.className = 'buttons';
            preEl.insertBefore(btnContainer, preEl.firstChild);
          }

          if (!btnContainer.querySelector('.clip-button')) {
            var clipBtn = document.createElement('button');
            clipBtn.className = 'clip-button';
            clipBtn.title = 'Copy to clipboard';
            clipBtn.setAttribute('aria-label', 'Copy to clipboard');
            var tooltip = document.createElement('i');
            tooltip.className = 'tooltiptext';
            clipBtn.appendChild(tooltip);

            clipBtn.addEventListener('click', function(e) {
              e.preventDefault();
              e.stopPropagation();
              var clone = codeBlock.cloneNode(true);
              if (codeBlock.classList.contains('hide-boring')) {
                var borings = clone.querySelectorAll('.boring');
                for (var b = 0; b < borings.length; b++) {
                  borings[b].remove();
                }
              }
              var rawText = clone.textContent || '';
              if (lang === 'console' || lang === 'cmd' || lang === 'powershell') {
                var rawLines = rawText.split('\n');
                var cmdLines = [];
                for (var rl = 0; rl < rawLines.length; rl++) {
                  var pm = rawLines[rl].match(/^\s*(?:\$|>)\s+(.*)$/);
                  if (pm) cmdLines.push(pm[1]);
                }
                if (cmdLines.length > 0) rawText = cmdLines.join('\n');
              }
              if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(rawText).catch(function() {});
              }
              tooltip.textContent = 'Copied!';
              clipBtn.classList.add('tooltipped');
              setTimeout(function() {
                clipBtn.classList.remove('tooltipped');
                tooltip.textContent = '';
              }, 1400);
            });

            btnContainer.appendChild(clipBtn);
          }

          if (hasBoring && !btnContainer.querySelector('.boring-toggle-btn')) {
            var eyeBtn = document.createElement('button');
            eyeBtn.className = 'fa-eye boring-toggle-btn';
            eyeBtn.title = 'Show hidden lines';
            eyeBtn.setAttribute('aria-label', 'Show hidden lines');
            var tplEye = document.getElementById('fa-eye');
            var tplEyeSlash = document.getElementById('fa-eye-slash');
            function updateEyeIcon(hidden) {
              eyeBtn.innerHTML = '';
              if (hidden && tplEye && tplEye.content) {
                eyeBtn.appendChild(tplEye.content.cloneNode(true));
              } else if (!hidden && tplEyeSlash && tplEyeSlash.content) {
                eyeBtn.appendChild(tplEyeSlash.content.cloneNode(true));
              } else {
                eyeBtn.textContent = hidden ? '👁' : '🙈';
              }
            }
            updateEyeIcon(true);
            eyeBtn.addEventListener('click', function(e) {
              e.preventDefault();
              e.stopPropagation();
              var nowHidden = codeBlock.classList.toggle('hide-boring');
              eyeBtn.title = nowHidden ? 'Show hidden lines' : 'Hide lines';
              eyeBtn.setAttribute('aria-label', eyeBtn.title);
              updateEyeIcon(nowHidden);
            });
            btnContainer.appendChild(eyeBtn);
          }
        })(preCodes[pIdx]);
      }

      // 3. Bind mdBook theme toggle button (#mdbook-theme-toggle / #theme-toggle), popup menu (#mdbook-theme-list), search button, and sidebar fold toggles
      if (!window.__docxRustUiBound) {
        window.__docxRustUiBound = true;
        document.addEventListener('click', function(e) {
          var t = e.target;
          if (!t || !t.closest) return;

          var themePopup = document.getElementById('mdbook-theme-list') || document.getElementById('theme-list');
          var themeToggle = document.getElementById('mdbook-theme-toggle') || document.getElementById('theme-toggle');

          var clickedToggle = t.closest('#mdbook-theme-toggle, #theme-toggle');
          if (clickedToggle && themePopup) {
            e.preventDefault();
            e.stopPropagation();
            var isOpen = themePopup.style.display === 'block';
            themePopup.style.display = isOpen ? 'none' : 'block';
            clickedToggle.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
            return;
          }

          var clickedThemeItem = t.closest('#mdbook-theme-list button.theme, #theme-list button.theme');
          if (clickedThemeItem) {
            e.preventDefault();
            e.stopPropagation();
            var chosenId = String(clickedThemeItem.id || '').toLowerCase().replace(/^mdbook-theme-/, '').replace(/^theme-/, '');
            isApplyingTheme = true;
            var isDarkRust = applyRustMdbookTheme(chosenId);
            localStorage.setItem('docx_dark_v3', isDarkRust ? '1' : '0');
            localStorage.setItem('docx_dark_v3_rust', isDarkRust ? '1' : '0');
            if (themePopup) themePopup.style.display = 'none';
            if (themeToggle) themeToggle.setAttribute('aria-expanded', 'false');
            window.parent.postMessage({
              type: 'DOCX_SITE_THEME_CHANGED',
              siteId: SITE_ID,
              darkMode: isDarkRust
            }, '*');
            setTimeout(function() { isApplyingTheme = false; }, 35);
            return;
          }

          if (themePopup && themePopup.style.display === 'block' && !t.closest('#mdbook-theme-list, #theme-list')) {
            themePopup.style.display = 'none';
            if (themeToggle) themeToggle.setAttribute('aria-expanded', 'false');
          }

          var searchBtn = t.closest('#mdbook-search-toggle, #search-toggle');
          if (searchBtn) {
            e.preventDefault();
            e.stopPropagation();
            window.parent.postMessage({ type: 'OPEN_UNIVERSAL_SEARCH' }, '*');
            return;
          }

          var foldToggle = t.closest('.chapter-fold-toggle');
          if (foldToggle) {
            e.preventDefault();
            e.stopPropagation();
            var chapLi = foldToggle.closest('li.chapter-item');
            if (chapLi) chapLi.classList.toggle('expanded');
            return;
          }
        }, true);

        document.addEventListener('keydown', function(e) {
          if (e.key === 'Escape') {
            var themePopup = document.getElementById('mdbook-theme-list') || document.getElementById('theme-list');
            var themeToggle = document.getElementById('mdbook-theme-toggle') || document.getElementById('theme-toggle');
            if (themePopup && themePopup.style.display === 'block') {
              themePopup.style.display = 'none';
              if (themeToggle) themeToggle.setAttribute('aria-expanded', 'false');
            }
          }
        });
      }
    } catch (e) {}
  }

  function initMsLearnDocsUI() {
    if (SITE_ID !== 'powershell' && SITE_ID !== 'cmd') return;
    try {
      var curPath = window.location.pathname.replace(/\/$/, '');
      var links = document.querySelectorAll('.docx-ms-toc-item a[href]');
      for (var i = 0; i < links.length; i++) {
        var a = links[i];
        var h = (a.getAttribute('href') || '').replace(/\/$/, '');
        if (h === curPath) {
          a.classList.add('active');
          var p = a.parentElement;
          while (p) {
            if (p.tagName === 'DETAILS') p.open = true;
            p = p.parentElement;
          }
        }
      }
    } catch (e) {}
  }

  function initShadcnDocsUI() {
    if (SITE_ID !== 'shadcn') return;
    try {
      var m = window.location.pathname.match(/^\/docs\/components\/(base|aria|radix)\//);
      if (m && m[1]) {
        localStorage.setItem('docx_shadcn_primitive', m[1]);
      }
    } catch (e) {}
    if (window.__docxShadcnBound) return;
    window.__docxShadcnBound = true;
    document.addEventListener('click', function(e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a || a.hasAttribute('target')) return;
      var href = a.getAttribute('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) return;
      try {
        var resolved = new URL(href, window.location.href);
        if (resolved.origin !== window.location.origin && resolved.origin !== SITE_ORIGIN) return;
        var targetPath = resolved.pathname;
        var pm = targetPath.match(/^\/docs\/components\/(base|aria|radix)\/(.+)$/);
        var clickedSwitcher = a.hasAttribute('data-active');
        if (pm) {
          if (clickedSwitcher) {
            localStorage.setItem('docx_shadcn_primitive', pm[1]);
          } else {
            var savedPrim = localStorage.getItem('docx_shadcn_primitive');
            if (savedPrim === 'base' || savedPrim === 'aria' || savedPrim === 'radix') {
              targetPath = '/docs/components/' + savedPrim + '/' + pm[2];
            }
          }
        } else {
          var gm = targetPath.match(/^\/docs\/components\/([^/]+)$/);
          if (gm) {
            var savedP = localStorage.getItem('docx_shadcn_primitive');
            if (savedP === 'base' || savedP === 'aria' || savedP === 'radix') {
              targetPath = '/docs/components/' + savedP + '/' + gm[1];
            }
          }
        }
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        window.location.href = targetPath + resolved.search + resolved.hash;
      } catch (err) {}
    }, true);
  }

  function initAllInteractiveControllers() {
    initExpressDocsUI();
    initVitePressDocsUI();
    initQtDocsUI();
    initTypeScriptDocsUI();
    initGoDocsUI();
    initRustDocsUI();
    initMsLearnDocsUI();
    initShadcnDocsUI();
    setupNativeThemeSync();
    if (getSavedThemeEnabled()) {
      syncMediaDarkStylesheets(getSavedSiteDark());
    }
    if (window.location.hash && window.location.hash.length > 1) {
      try {
        var targetId = decodeURIComponent(window.location.hash.slice(1));
        var el = document.getElementById(targetId) || document.getElementsByName(targetId)[0];
        if (el) el.scrollIntoView();
      } catch (e) {}
    }
  }

  try {
    var savedZoom = parseInt(localStorage.getItem('docx_zoom') || '100', 10);
    var savedDark = getSavedSiteDark();
    applyReaderSettings(savedZoom, savedDark, getSavedThemeEnabled(), getSavedFontEnabled());
    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', function() {
        applyReaderSettings(
          parseInt(localStorage.getItem('docx_zoom') || '100', 10),
          getSavedSiteDark(),
          getSavedThemeEnabled(),
          getSavedFontEnabled()
        );
        initAllInteractiveControllers();
        notifyParentReady();
      });
    } else {
      initAllInteractiveControllers();
      notifyParentReady();
    }
    window.addEventListener('load', function() {
      applyReaderSettings(
        parseInt(localStorage.getItem('docx_zoom') || '100', 10),
        getSavedSiteDark(),
        getSavedThemeEnabled(),
        getSavedFontEnabled()
      );
      initAllInteractiveControllers();
      notifyParentReady();
    });
    window.addEventListener('hashchange', function() {
      notifyParentReady();
    });
    window.addEventListener('popstate', function() {
      setTimeout(notifyParentReady, 30);
    });
    if (window.history) {
      var origPush = window.history.pushState;
      if (origPush) {
        window.history.pushState = function() {
          var res = origPush.apply(this, arguments);
          setTimeout(notifyParentReady, 40);
          return res;
        };
      }
      var origReplace = window.history.replaceState;
      if (origReplace) {
        window.history.replaceState = function() {
          var res = origReplace.apply(this, arguments);
          setTimeout(notifyParentReady, 40);
          return res;
        };
      }
    }
  } catch (e) {}

  window.addEventListener('message', function(e) {
    if (!e.data || e.data.type !== 'DOCX_READER_SETTINGS') return;
    if (typeof e.data.systemDark === 'boolean') {
      try { localStorage.setItem('docx_system_dark', e.data.systemDark ? '1' : '0'); } catch (err) {}
    }
    var fontOpt = typeof e.data.fontEnabled === 'boolean' ? e.data.fontEnabled : e.data.customFontEnabled;
    if (e.data.siteId && e.data.siteId !== SITE_ID) {
      applyReaderSettings(
        e.data.zoom,
        getSavedSiteDark(),
        e.data.themeEnabled,
        fontOpt
      );
      return;
    }
    applyReaderSettings(
      e.data.zoom,
      e.data.darkMode,
      e.data.themeEnabled,
      fontOpt
    );
  });

  window.addEventListener('keydown', function(e){
    if (e.key === 'F11') {
      e.preventDefault(); e.stopPropagation();
      window.parent.postMessage({ type: 'DOCX_TOGGLE_FULLSCREEN' }, '*');
    } else if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){
      e.preventDefault(); e.stopPropagation();
      window.parent.postMessage({ type: 'OPEN_UNIVERSAL_SEARCH' }, '*');
    } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'd') {
      e.preventDefault(); e.stopPropagation();
      window.parent.postMessage({ type: 'DOCX_TOGGLE_BOOKMARK' }, '*');
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
      e.preventDefault(); e.stopPropagation();
      window.parent.postMessage({ type: 'DOCX_TAB_ACTION', action: 'new' }, '*');
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
      e.preventDefault(); e.stopPropagation();
      window.parent.postMessage({ type: 'DOCX_TAB_ACTION', action: 'close' }, '*');
    } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
      e.preventDefault(); e.stopPropagation();
      window.parent.postMessage({ type: 'DOCX_TAB_ACTION', action: 'duplicate' }, '*');
    } else if (e.ctrlKey && e.key === 'Tab') {
      e.preventDefault(); e.stopPropagation();
      window.parent.postMessage({ type: 'DOCX_TAB_ACTION', action: e.shiftKey ? 'prev' : 'next' }, '*');
    } else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
      e.preventDefault(); e.stopPropagation();
      window.parent.postMessage({ type: 'DOCX_ZOOM_DELTA', delta: 10 }, '*');
    } else if ((e.ctrlKey || e.metaKey) && (e.key === '-') ) {
      e.preventDefault(); e.stopPropagation();
      window.parent.postMessage({ type: 'DOCX_ZOOM_DELTA', delta: -10 }, '*');
    } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
      e.preventDefault(); e.stopPropagation();
      window.parent.postMessage({ type: 'DOCX_ZOOM_RESET' }, '*');
    }
  }, true);
  var lastL = 0, lastR = 0, lastT = 0, lastC = 0;
  function checkIframeEdgeHover(e, isLeave) {
    if (window.innerWidth <= 768 || ('ontouchstart' in window && navigator.maxTouchPoints > 0)) {
      return;
    }
    var now = Date.now();
    var w = window.innerWidth || document.documentElement.clientWidth || 1000;
    var leftThresh = isLeave ? 80 : 14;
    var rightThresh = isLeave ? 80 : 14;
    var topThresh = isLeave ? 38 : 12;
    if (e.clientX <= leftThresh && (isLeave || now - lastL > 40)) {
      lastL = now;
      window.parent.postMessage({ type: 'HOVER_LEFT_EDGE', clientY: e.clientY }, '*');
    } else if (e.clientX >= w - rightThresh && (isLeave || now - lastR > 40)) {
      lastR = now;
      window.parent.postMessage({ type: 'HOVER_RIGHT_EDGE', clientY: e.clientY }, '*');
    } else if (!isLeave && e.clientX > 14 && e.clientX < w - 14 && now - lastC > 25) {
      lastC = now;
      window.parent.postMessage({ type: 'IFRAME_CURSOR_CENTER', clientX: e.clientX, clientY: e.clientY }, '*');
    }
    if (e.clientY <= topThresh && (isLeave || now - lastT > 40)) {
      lastT = now;
      window.parent.postMessage({ type: 'HOVER_TOP_EDGE' }, '*');
    }
  }
  window.addEventListener('mousemove', function(e){
    checkIframeEdgeHover(e, false);
  }, { passive: true });
  window.addEventListener('pointermove', function(e){
    checkIframeEdgeHover(e, false);
  }, { passive: true });
  document.addEventListener('mouseleave', function(e){
    checkIframeEdgeHover(e, true);
  }, { passive: true });
  window.addEventListener('mouseout', function(e){
    if (!e.relatedTarget) checkIframeEdgeHover(e, true);
  }, { passive: true });
  window.addEventListener('mousedown', function(){
    window.parent.postMessage({ type: 'IFRAME_INTERACT' }, '*');
  }, { passive: true });
  if (SITE_ID === 'threejs' && !window.location.hash && window.location.pathname.indexOf('pages/') === -1) {
    window.location.hash = 'Scene';
  }

  // Middle-click (auxclick button 1) on any documentation link opens it in a new DOCX tab
  document.addEventListener('auxclick', function(e) {
    if (e.button !== 1) return;
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href.startsWith('mailto:') || href.startsWith('javascript:')) return;
    try {
      var resolved = new URL(href, window.location.href);
      if (resolved.origin === window.location.origin || (SITE_ORIGIN && resolved.origin === SITE_ORIGIN)) {
        e.preventDefault();
        e.stopPropagation();
        window.parent.postMessage({
          type: 'DOCX_OPEN_NEW_TAB',
          siteId: SITE_ID,
          url: resolved.pathname + resolved.search + resolved.hash
        }, '*');
      }
    } catch (err) {}
  }, false);

  document.addEventListener('click', function(e){
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if(!a || e.defaultPrevented || e.shiftKey || e.altKey) return;
    var href = a.getAttribute('href');
    if(!href || href.startsWith('mailto:') || href.startsWith('javascript:')) return;

    // Ctrl+Click or Cmd+Click on any documentation link opens it in a new DOCX tab
    if (e.ctrlKey || e.metaKey) {
      try {
        var ctrlResolved = new URL(href, window.location.href);
        if (ctrlResolved.origin === window.location.origin || (SITE_ORIGIN && ctrlResolved.origin === SITE_ORIGIN)) {
          e.preventDefault();
          e.stopPropagation();
          window.parent.postMessage({
            type: 'DOCX_OPEN_NEW_TAB',
            siteId: SITE_ID,
            url: ctrlResolved.pathname + ctrlResolved.search + ctrlResolved.hash
          }, '*');
        }
      } catch (err) {}
      return;
    }

    if(a.hasAttribute('target')) return;
    if(SITE_ID === 'threejs' || SITE_ID === 'nestjs' || SITE_ID === 'angular') return;
    if(href.startsWith('#')) {
      if(href.length > 1) {
        try {
          var targetId = decodeURIComponent(href.slice(1));
          var targetEl = document.getElementById(targetId) || document.getElementsByName(targetId)[0];
          if (targetEl) {
            e.preventDefault();
            e.stopPropagation();
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            history.replaceState(null, '', href);
          }
        } catch(err) {}
      }
      return;
    }
    try {
      var resolved = new URL(href, window.location.href);
      if (resolved.origin === window.location.origin || (SITE_ORIGIN && resolved.origin === SITE_ORIGIN)) {
        e.preventDefault(); e.stopPropagation();
        window.location.href = resolved.pathname + resolved.search + resolved.hash;
      }
    } catch(err) {}
  }, false);

  function scrollToHashSymbol() {
    if (!window.location.hash || window.location.hash.length <= 1) return;
    try {
      var rawHash = decodeURIComponent(window.location.hash.slice(1));
      var direct = document.getElementById(rawHash) || document.getElementsByName(rawHash)[0];
      if (direct) {
        direct.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      var lowerHash = rawHash.toLowerCase();
      var candidates = document.querySelectorAll('tr.t-dsc, h1, h2, h3, h4, dt, code, tt, a');
      for (var i = 0; i < candidates.length; i++) {
        var el = candidates[i];
        var txt = (el.textContent || '').trim().toLowerCase();
        if (txt === lowerHash || txt === 'std::' + lowerHash || (el.tagName === 'TR' && txt.indexOf(lowerHash) !== -1)) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.style.outline = '2px solid rgba(56, 189, 248, 0.75)';
          el.style.borderRadius = '4px';
          setTimeout(function() { el.style.outline = ''; }, 2400);
          break;
        }
      }
    } catch (e) {}
  }
  window.addEventListener('hashchange', scrollToHashSymbol);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(scrollToHashSymbol, 60); });
  } else {
    setTimeout(scrollToHashSymbol, 60);
  }
})();
</script>"###
        .replace("__DOCX_SITE_ID__", site_id)
        .replace("__DOCX_SITE_ORIGIN__", &origin);

    if let Some(pos) = html.rfind("</body>") {
        html.insert_str(pos, &inject);
    } else {
        html.push_str(&inject);
    }
    html.into_bytes()
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
        .setup(|app| {
            #[cfg(mobile)]
            {
                use tauri::Manager;
                if let Ok(app_dir) = app.path().app_data_dir() {
                    set_packs_dir(app_dir.join("docx"));
                }
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

