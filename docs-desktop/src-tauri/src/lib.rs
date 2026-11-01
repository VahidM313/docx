#[cfg(desktop)]
use std::fs;
#[cfg(mobile)]
use std::sync::Arc;
#[cfg(desktop)]
use std::thread;
#[cfg(desktop)]
use std::time::Duration;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
use std::process::Command;

mod app_update;
mod bridge;
mod catalog;
mod commands;
mod config;
mod error;
mod pack;
mod search;
mod server;
mod update;
mod util;

#[cfg(target_os = "windows")]
use std::sync::atomic::{AtomicBool, Ordering};

use app_update::{check_app_update, self_update_app};
use commands::{
    check_servers, cursor_in_window, delete_docpack,
    ensure_site_server_cmd, fetch_remote_registry, get_installed_packs,
    get_system_theme, open_in_browser, window_close, window_minimize,
    window_show_ready, window_start_dragging, window_toggle_fullscreen,
    window_toggle_maximize,
};
use pack::load_asset_store;
#[cfg(mobile)]
use pack::{load_disk_overrides, set_packs_dir};
use search::get_extra_search_entries;
use server::AppState;
use update::install_or_update_from_github;

#[cfg(target_os = "windows")]
static WEBVIEW_MEMORY_LOW: AtomicBool = AtomicBool::new(false);

/// Asks WebView2 to give back what it can while nobody is looking at the window.
#[cfg(target_os = "windows")]
fn set_webview_memory_low(window: &tauri::Window, low: bool) {
    use tauri::Manager;
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2_19, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW,
        COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL,
    };
    use windows_core::Interface;

    let Some(webview) = window.get_webview_window("main") else {
        return;
    };
    let _ = webview.with_webview(move |webview| unsafe {
        let Ok(core) = webview.controller().CoreWebView2() else {
            return;
        };
        let Ok(core) = core.cast::<ICoreWebView2_19>() else {
            return;
        };
        let level = if low {
            COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW
        } else {
            COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL
        };
        if let Err(e) = core.SetMemoryUsageTargetLevel(level) {
            log::warn!("WebView2 memory target not set: {e}");
        }
    });
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
        // Clean up self-update staging leftovers next to the running exe
        if let Ok(exe) = std::env::current_exe() {
            let _ = fs::remove_file(exe.with_extension("old.exe"));
            let _ = fs::remove_file(exe.with_extension("new.exe"));
        }
    }

    let store = load_asset_store();
    // Packs are served by a listener created on demand when a document is opened.
    // Starting one thread/socket per installed pack during boot wasted memory and
    // file descriptors for packs the user never reads.

    #[cfg(mobile)]
    let store_clone = Arc::clone(&store);
    tauri::Builder::default()
        .manage(AppState {
            store,
        })
        .on_window_event(|win, event| match event {
            tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed => {
                std::process::exit(0);
            }
            #[cfg(target_os = "windows")]
            tauri::WindowEvent::Resized(_) => {
                let low = win.is_minimized().unwrap_or(false);
                if WEBVIEW_MEMORY_LOW.swap(low, Ordering::Relaxed) != low {
                    set_webview_memory_low(win, low);
                }
            }
            _ => {
                let _ = win;
            }
        })
        .setup(move |app| {
            // The app data dir is only known here on mobile, so its packs load now.
            #[cfg(mobile)]
            {
                use tauri::Manager;
                if let Ok(app_dir) = app.path().app_data_dir() {
                    set_packs_dir(app_dir.join("docx"));
                }
                match error::write_guard(&store_clone.overrides) {
                    Ok(mut guard) => load_disk_overrides(&mut guard),
                    Err(e) => log::error!("overrides lock poisoned during setup: {}", e),
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
            get_installed_packs,
            fetch_remote_registry,
            ensure_site_server_cmd,
            get_extra_search_entries,
            install_or_update_from_github,
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
            cursor_in_window,
            open_in_browser,
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}


