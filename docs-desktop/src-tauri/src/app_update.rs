//! App-core self-update: download the fresh core, splice the DOCXPACK trailer
//! with embedded docs back on, and restart in-place.

use std::fs;
#[cfg(all(desktop, target_os = "windows"))]
use std::sync::Arc;
#[cfg(all(desktop, target_os = "windows"))]
use std::thread;
#[cfg(all(desktop, target_os = "windows"))]
use std::time::Duration;

use crate::config::{APP_BUILD_COMMIT, RELEASE_BASE_URL};
use crate::pack::get_packs_dir;
use crate::server::AppState;
use crate::util::get_metadata;
#[cfg(all(desktop, target_os = "windows"))]
use crate::commands::write_exe_with_trailer;
#[cfg(all(desktop, target_os = "windows"))]
use crate::error::{read_guard, DocxError};
#[cfg(all(desktop, target_os = "windows"))]
use crate::pack::{SiteOverridePack, EMBEDDED_SOURCE};
#[cfg(all(desktop, target_os = "windows"))]
use crate::update::{download_resumable, DownloadProgressPayload, Progress};

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
    if let Ok(bytes) = fs::read(path)
        && let Ok(manifest) = serde_json::from_slice::<AppManifestRemote>(&bytes)
            && !manifest.commit.trim().is_empty() {
                return Some(manifest.commit);
            }
    None
}

#[tauri::command]
pub(crate) async fn check_app_update() -> Result<AppUpdateStatus, String> {
    tauri::async_runtime::spawn_blocking(read_app_update_status)
        .await
        .map_err(|e| format!("Task join error: {e}"))?
}

fn read_app_update_status() -> Result<AppUpdateStatus, String> {
    let url = format!("{}/app-manifest.json", RELEASE_BASE_URL);
    let bytes = get_metadata(&url)?;
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
    tauri::async_runtime::spawn_blocking(move || -> crate::error::Result<String> {
        use std::os::windows::process::CommandExt;
        use tauri::Emitter;

        let exe_path = std::env::current_exe()?;
        let _ = fs::remove_file(exe_path.with_extension("old.exe"));
        let _ = fs::remove_file(exe_path.with_extension("new.exe"));

        let temp_dir = std::env::temp_dir();
        let tmp_core_path = temp_dir.join("Docx_core_dl.tmp");
        let staged_exe_path = temp_dir.join("Docx_staged_update.exe");

        // Fetch and persist remote app-manifest.json so check_app_update knows we are up to date after restart
        let manifest_url = format!("{}/app-manifest.json", RELEASE_BASE_URL);
        if let Ok(manifest_bytes) = get_metadata(&manifest_url) {
            let packs_dir = get_packs_dir();
            let _ = fs::create_dir_all(&packs_dir);
            let _ = fs::write(packs_dir.join("app-manifest.local.json"), &manifest_bytes);
        }

        let core_url = format!("{}/Docx-core.exe", RELEASE_BASE_URL);
        let mut sink = |payload: DownloadProgressPayload| {
            let _ = window.emit("docpack-progress", payload);
        };
        let mut progress = Progress::new("docx_app_core", &mut sink);
        let core_bytes = download_resumable(
            &core_url,
            &tmp_core_path,
            4 * 1024 * 1024,
            "Downloading app",
            &mut progress,
        )?;
        let core_dl_mb = core_bytes as f64 / (1024.0 * 1024.0);

        let _ = window.emit(
            "docpack-progress",
            DownloadProgressPayload {
                site_id: "docx_app_core".to_string(),
                phase: "Preserving Embedded Docs...".to_string(),
                downloaded_bytes: core_bytes as usize,
                total_bytes: core_bytes as usize,
                percent: 96,
                detail: "Splicing local DOCXPACK trailer onto new app core...".to_string(),
            },
        );

        // Only what the exe already carried: every other pack is a file of its own,
        // and copying those in would grow the exe by the whole library.
        let embedded: Vec<Arc<SiteOverridePack>> = read_guard(&store.overrides)?
            .values()
            .filter(|pack| pack.source == EMBEDDED_SOURCE)
            .cloned()
            .collect();

        fs::copy(&tmp_core_path, &staged_exe_path)
            .map_err(|e| DocxError::io_path(&staged_exe_path, &e))?;
        let _ = fs::remove_file(&tmp_core_path);
        let mut staged = fs::OpenOptions::new()
            .append(true)
            .open(&staged_exe_path)
            .map_err(|e| DocxError::io_path(&staged_exe_path, &e))?;
        let trailer_len = write_exe_with_trailer(&mut staged, &embedded)
            .map_err(|e| DocxError::io_path(&staged_exe_path, &e))?;
        drop(staged);

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
                downloaded_bytes: core_bytes as usize,
                total_bytes: core_bytes as usize,
                percent: 100,
                detail: format!(
                    "Updated ({:.2} MB core + {:.2} MB docs). Restarting Docx automatically...",
                    core_dl_mb,
                    trailer_len as f64 / (1024.0 * 1024.0)
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
    .map_err(|e| format!("Task join error: {}", e))?
    .map_err(|e| e.to_string())
    }
}

