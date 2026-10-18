//! App-core self-update: download the fresh core, splice the DOCXPACK trailer
//! with embedded docs back on, and restart in-place.

use std::fs;
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use crate::config::{APP_BUILD_COMMIT, RELEASE_BASE_URL, TRAILER_MAGIC};
use crate::pack::get_packs_dir;
use crate::server::AppState;
use crate::update::{curl_download_with_progress, DownloadProgressPayload};
use crate::util::curl_get_bytes;

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
pub(crate) fn check_app_update() -> Result<AppUpdateStatus, String> {
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
pub(crate) async fn self_update_app(
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

