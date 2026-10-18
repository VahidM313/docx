use std::fs;
use std::sync::Arc;
use std::thread;
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

use app_update::{check_app_update, self_update_app};
use commands::{
    bundle_into_single_exe, check_servers, delete_docpack, ensure_site_server_cmd,
    fetch_remote_registry, get_installed_packs, get_system_theme, window_close,
    window_minimize, window_show_ready, window_start_dragging, window_toggle_fullscreen,
    window_toggle_maximize,
};
use pack::{load_asset_store, load_disk_overrides};
#[cfg(mobile)]
use pack::set_packs_dir;
use search::get_extra_search_entries;
use server::{ensure_site_server, AppState};
use update::install_or_update_from_github;

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
    let tailwind_port = ensure_site_server("tailwind", Arc::clone(&store));
    let shadcn_port = ensure_site_server("shadcn", Arc::clone(&store));

    // Also start servers for any additional installed .docpack overrides
    let extra_ids = error::read_guard(&store.overrides)
        .map(|guard| {
            guard
                .keys()
                .filter(|k| *k != "tailwind" && *k != "shadcn")
                .cloned()
                .collect::<Vec<String>>()
        })
        .unwrap_or_else(|e| {
            log::error!("overrides lock poisoned at startup: {}", e);
            Vec::new()
        });
    for id in extra_ids {
        ensure_site_server(&id, Arc::clone(&store));
    }

    let store_clone = Arc::clone(&store);
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
        .setup(move |app| {
            #[cfg(mobile)]
            {
                use tauri::Manager;
                if let Ok(app_dir) = app.path().app_data_dir() {
                    set_packs_dir(app_dir.join("docx"));
                }
            }
            // Re-scan verified packs_dir to ensure any previously downloaded packs are fully loaded
            {
                match error::write_guard(&store_clone.overrides) {
                    Ok(mut guard) => load_disk_overrides(&mut guard),
                    Err(e) => log::error!("overrides lock poisoned during setup: {}", e),
                }
            }
            let extra_ids = error::read_guard(&store_clone.overrides)
                .map(|guard| {
                    guard
                        .keys()
                        .filter(|k| *k != "tailwind" && *k != "shadcn")
                        .cloned()
                        .collect::<Vec<String>>()
                })
                .unwrap_or_else(|e| {
                    log::error!("overrides lock poisoned during setup: {}", e);
                    Vec::new()
                });
            for id in extra_ids {
                ensure_site_server(&id, Arc::clone(&store_clone));
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


