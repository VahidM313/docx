//! Tauri IPC commands: pack listing/registry, install/delete/bundle, window controls.

use std::collections::HashMap;
use std::fs;
#[cfg(desktop)]
use std::path::PathBuf;
use std::sync::Arc;

use crate::catalog::get_site_origin_and_entry;
#[cfg(desktop)]
use crate::config::TRAILER_MAGIC;
#[cfg(desktop)]
use crate::pack::SiteOverridePack;
use crate::pack::{get_packs_dir, AssetStore};
use crate::server::{ensure_site_server, AppState, ServerStatus};
use crate::update::fetch_library_directory;

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


#[tauri::command]
pub(crate) fn check_servers(state: tauri::State<'_, AppState>) -> ServerStatus {
    let ports = crate::error::read_guard(&state.store.site_ports)
        .map(|g| g.clone())
        .unwrap_or_default();
    ServerStatus {
        tailwind: true,
        shadcn: true,
        tailwind_port: state.tailwind_port,
        shadcn_port: state.shadcn_port,
        site_ports: ports,
    }
}



#[tauri::command]
pub(crate) fn get_installed_packs(state: tauri::State<'_, AppState>) -> Vec<PackStatusInfo> {
    let mut list = Vec::new();
    let Ok(guard) = crate::error::read_guard(&state.store.overrides) else {
        log::error!("overrides lock poisoned; installed-pack list unavailable");
        return list;
    };
    let Ok(ports) = crate::error::read_guard(&state.store.site_ports) else {
        log::error!("site-ports lock poisoned; installed-pack list unavailable");
        return list;
    };

    for (site_id, pack) in guard.iter() {
        list.push(PackStatusInfo {
            id: site_id.clone(),
            name: pack.meta.name.clone(),
            version: pack.meta.version.clone(),
            commit: pack.meta.commit.clone(),
            route_count: pack.meta.route_count,
            chunk_count: pack.meta.chunk_count,
            size_mb: (pack.pack_len() as f64 / (1024.0 * 1024.0) * 100.0).round() / 100.0,
            source: pack.source.clone(),
            port: ports.get(site_id).copied().unwrap_or(0),
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
    /// Older commit -> bytes a client on it must fetch.
    #[serde(default)]
    pub gens: HashMap<String, usize>,
    #[serde(default)]
    pub truncated: bool,
    /// Where the pack starts, counted from the end of the library directory.
    #[serde(default)]
    pub offset: u64,
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
    /// What updating costs from the installed build, when the registry still tracks it.
    pub updateBytes: Option<usize>,
    pub routeCount: usize,
    pub chunkCount: usize,
    pub installed: bool,
    pub local_commit: String,
    pub update_available: bool,
    pub truncated: bool,
}

pub(crate) fn parse_registry(bytes: &[u8]) -> Result<Vec<RemoteRegistryEntryRaw>, String> {
    if let Ok(wrapper_map) = serde_json::from_slice::<RemoteRegistryFileMap>(bytes) {
        Ok(wrapper_map.packs.into_values().collect())
    } else if let Ok(wrapper_vec) = serde_json::from_slice::<RemoteRegistryFileVec>(bytes) {
        Ok(wrapper_vec.packs)
    } else {
        serde_json::from_slice::<Vec<RemoteRegistryEntryRaw>>(bytes).map_err(|e| e.to_string())
    }
}

/// Fresh registry when online, the last good copy otherwise, so offline starts still
/// know what can be installed and how big it is.
fn load_registry() -> Result<Vec<RemoteRegistryEntryRaw>, String> {
    let cached = get_packs_dir().join("registry.json");
    let error = match fetch_library_directory().map_err(|e| e.to_string()).and_then(|b| Ok((parse_registry(&b)?, b))) {
        Ok((entries, bytes)) => {
            let tmp = cached.with_extension("json.tmp");
            if fs::write(&tmp, &bytes).is_ok() {
                let _ = fs::rename(&tmp, &cached);
            }
            return Ok(entries);
        }
        Err(e) => e,
    };
    let bytes = fs::read(&cached).map_err(|_| error)?;
    parse_registry(&bytes)
}

#[tauri::command]
pub(crate) async fn fetch_remote_registry(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<RemoteRegistryItem>, String> {
    let store = Arc::clone(&state.store);
    tauri::async_runtime::spawn_blocking(move || registry_items(&store))
        .await
        .map_err(|e| format!("Task join error: {e}"))?
}

fn registry_items(store: &AssetStore) -> Result<Vec<RemoteRegistryItem>, String> {
    let parsed_raw = load_registry()?;
    let guard = crate::error::read_guard(&store.overrides).map_err(|e| e.to_string())?;
    let mut out = Vec::with_capacity(parsed_raw.len());
    for item in parsed_raw {
        if get_site_origin_and_entry(&item.id).is_none() {
            continue;
        }
        let (installed, local_commit, local_routes, local_updated_at) =
            if let Some(pack) = guard.get(&item.id) {
                (
                    true,
                    pack.meta.commit.clone(),
                    pack.meta.route_count,
                    pack.meta.updated_at.clone(),
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
        let update_bytes = item.gens.get(&local_commit).copied();
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
            updateBytes: update_bytes,
            routeCount: item.routeCount,
            chunkCount: item.chunkCount,
            installed,
            local_commit,
            update_available,
            truncated: item.truncated,
        });
    }
    Ok(out)
}

#[tauri::command]
pub(crate) fn ensure_site_server_cmd(site_id: String, state: tauri::State<'_, AppState>) -> u16 {
    ensure_site_server(&site_id, Arc::clone(&state.store))
}



#[tauri::command]
pub(crate) fn delete_docpack(site_id: String, state: tauri::State<'_, AppState>) -> Result<String, String> {
    let packs_dir = get_packs_dir();
    let docpack_path = packs_dir.join(format!("{}.docpack", site_id));
    let _ = fs::remove_file(&docpack_path);
    for suffix in ["manifest.json", "search.json", "docpack.part", "docpack.etag"] {
        let _ = fs::remove_file(packs_dir.join(format!("{site_id}.{suffix}")));
    }

    {
        match crate::error::write_guard(&state.store.overrides) {
            Ok(mut guard) => {
                guard.remove(&site_id);
            }
            Err(e) => return Err(e.to_string()),
        }
    }

    Ok(format!("Deleted documentation pack for '{}'", site_id))
}

/// Writes `exe_core` plus `packs` as a DOCXPACK trailer to `out`, streaming every
/// pack from disk. The result holds whole libraries, so it must not pass through memory.
#[cfg(desktop)]
pub(crate) fn write_exe_with_trailer(
    out: &mut impl std::io::Write,
    packs: &[Arc<SiteOverridePack>],
) -> std::io::Result<u64> {
    let mut trailer_len = 0u64;
    for pack in packs {
        out.write_all(&(pack.pack_len() as u32).to_le_bytes())?;
        trailer_len += 4 + pack.copy_pack_to(out)?;
    }
    if trailer_len > 0 {
        out.write_all(&trailer_len.to_le_bytes())?;
        out.write_all(TRAILER_MAGIC)?;
    }
    Ok(trailer_len)
}

/// Length of the executable without any DOCXPACK trailer.
#[cfg(desktop)]
fn exe_core_len(path: &std::path::Path) -> std::io::Result<u64> {
    use std::io::{Read, Seek, SeekFrom};
    let mut file = fs::File::open(path)?;
    let len = file.metadata()?.len();
    if len < 16 {
        return Ok(len);
    }
    file.seek(SeekFrom::End(-16))?;
    let mut footer = [0u8; 16];
    file.read_exact(&mut footer)?;
    if &footer[8..16] != TRAILER_MAGIC {
        return Ok(len);
    }
    let trailer_len = u64::from_le_bytes(footer[..8].try_into().unwrap_or([0u8; 8]));
    Ok(len.saturating_sub(16 + trailer_len))
}

#[cfg(desktop)]
fn bundle_library(store: &AssetStore) -> Result<String, String> {
    use std::io::{Read, Write};

    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    let temp_dir = std::env::temp_dir();
    let tmp_path = temp_dir.join("Docx_bundle_staged.exe");

    let packs: Vec<Arc<SiteOverridePack>> = crate::error::read_guard(&store.overrides)
        .map_err(|e| e.to_string())?
        .values()
        .cloned()
        .collect();

    let core_len = exe_core_len(&exe_path).map_err(|e| e.to_string())?;
    let total = {
        let mut out = std::io::BufWriter::new(fs::File::create(&tmp_path).map_err(|e| e.to_string())?);
        let exe = fs::File::open(&exe_path).map_err(|e| e.to_string())?;
        std::io::copy(&mut exe.take(core_len), &mut out).map_err(|e| e.to_string())?;
        let trailer = write_exe_with_trailer(&mut out, &packs).map_err(|e| e.to_string())?;
        out.flush().map_err(|e| e.to_string())?;
        core_len + trailer + 16
    };

    let done = || {
        format!(
            "Updated standalone Desktop\\Docx.exe in-place with {} embedded packs ({:.2} MB total)!",
            packs.len(),
            total as f64 / (1024.0 * 1024.0)
        )
    };

    let out_path = std::env::var_os("USERPROFILE")
        .map(|home| PathBuf::from(home).join("Desktop").join("Docx.exe"))
        .or_else(|| std::env::var_os("DESKTOP").map(PathBuf::from).map(|p| p.join("Docx.exe")))
        .unwrap_or_else(|| temp_dir.join("Docx.exe"));
    let out_parent_stem = out_path
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| temp_dir.clone());
    let _ = fs::remove_file(out_parent_stem.join("Docx.old.exe"));
    let _ = fs::remove_file(out_parent_stem.join("Docx.new.exe"));

    if fs::copy(&tmp_path, &out_path).is_ok() {
        let _ = fs::remove_file(&tmp_path);
        return Ok(done());
    }

    let temp_old = temp_dir.join(format!("Docx_prev_{}.tmp", std::process::id()));
    let _ = fs::remove_file(&temp_old);
    if fs::rename(&out_path, &temp_old).is_ok() {
        if fs::copy(&tmp_path, &out_path).is_ok() {
            let _ = fs::remove_file(&tmp_path);
            let _ = fs::remove_file(&temp_old);
            return Ok(done());
        }
        let _ = fs::rename(&temp_old, &out_path);
    }

    Err("Could not overwrite Desktop\\Docx.exe while locked.".to_string())
}

#[tauri::command]
pub(crate) async fn bundle_into_single_exe(state: tauri::State<'_, AppState>) -> Result<String, String> {
    #[cfg(not(desktop))]
    {
        let _ = state;
        Err("Standalone single-binary bundling is only supported on desktop platforms.".to_string())
    }
    #[cfg(desktop)]
    {
        let store = Arc::clone(&state.store);
        tauri::async_runtime::spawn_blocking(move || bundle_library(&store))
            .await
            .map_err(|e| format!("Task join error: {e}"))?
    }
}


#[tauri::command]
pub(crate) fn get_system_theme(window: tauri::Window) -> String {
    match window.theme() {
        Ok(tauri::Theme::Light) => "light".to_string(),
        Ok(tauri::Theme::Dark) => "dark".to_string(),
        _ => "dark".to_string(),
    }
}

#[tauri::command]
pub(crate) fn window_minimize(window: tauri::Window) {
    #[cfg(desktop)]
    let _ = window.minimize();
    #[cfg(not(desktop))]
    let _ = window;
}

#[tauri::command]
pub(crate) fn window_toggle_maximize(window: tauri::Window) {
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
pub(crate) fn window_toggle_fullscreen(window: tauri::Window) -> bool {
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
pub(crate) fn window_close(window: tauri::Window) {
    let _ = window.close();
    #[cfg(desktop)]
    std::process::exit(0);
}

#[tauri::command]
pub(crate) fn window_start_dragging(window: tauri::Window) {
    #[cfg(desktop)]
    let _ = window.start_dragging();
    #[cfg(not(desktop))]
    let _ = window;
}

#[tauri::command]
pub(crate) fn window_show_ready(window: tauri::Window) {
    #[cfg(desktop)]
    {
        if !window.is_maximized().unwrap_or(false) {
            let _ = window.maximize();
        }
    }
    let _ = window.show();
    let _ = window.set_focus();
}

/// Cursor position relative to the webview in logical pixels.
///
/// Used by the hover-reveal chrome. One IPC call replaces the previous pair
/// (`cursorPosition` + `innerPosition`) polled several times per second.
#[tauri::command]
pub(crate) fn cursor_in_window(window: tauri::Window) -> Option<(f64, f64)> {
    #[cfg(desktop)]
    {
        // A minimized window sits at a sentinel position (-32000, -32000), so
        // cursor maths would report nonsense and pop the hover panels open.
        if window.is_minimized().unwrap_or(false) {
            return None;
        }
        let cursor = window.cursor_position().ok()?;
        let origin = window.inner_position().ok()?;
        let scale = window.scale_factor().ok().filter(|s| *s > 0.0).unwrap_or(1.0);
        return Some((
            (cursor.x - origin.x as f64) / scale,
            (cursor.y - origin.y as f64) / scale,
        ));
    }
    #[cfg(not(desktop))]
    {
        let _ = window;
        None
    }
}

#[tauri::command]
pub(crate) fn open_in_browser(url: String) -> Result<(), String> {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("Invalid URL scheme".into());
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = std::process::Command::new("cmd");
        cmd.args(["/C", "start", "", &url])
            .creation_flags(0x08000000); // CREATE_NO_WINDOW
        let _ = cmd.spawn().map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(&url).spawn().map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open").arg(&url).spawn().map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        let _ = url;
        Ok(())
    }
}
