//! Tauri IPC commands: pack listing/registry, install/delete/bundle, window controls.

use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

use crate::catalog::get_site_origin_and_entry;
use crate::config::{RELEASE_BASE_URL, TRAILER_MAGIC};
use crate::pack::get_packs_dir;
use crate::server::{ensure_site_server, AppState, ServerStatus};
use crate::util::curl_get_bytes;

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
pub(crate) fn get_installed_packs(state: tauri::State<'_, AppState>) -> Vec<PackStatusInfo> {
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
pub(crate) fn fetch_remote_registry(state: tauri::State<'_, AppState>) -> Result<Vec<RemoteRegistryItem>, String> {
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
pub(crate) fn ensure_site_server_cmd(site_id: String, state: tauri::State<'_, AppState>) -> u16 {
    ensure_site_server(&site_id, Arc::clone(&state.store))
}



#[tauri::command]
pub(crate) fn delete_docpack(site_id: String, state: tauri::State<'_, AppState>) -> Result<String, String> {
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
pub(crate) fn bundle_into_single_exe(state: tauri::State<'_, AppState>) -> Result<String, String> {
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

