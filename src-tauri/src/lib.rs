// BeamMP Host — Tauri backend entry point.
// Wires up plugins, registers IPC commands, and manages global process state.

mod beammp;
mod playit;
mod config;
mod github;

use std::sync::Mutex;
use tauri::{Manager, TrayIconBuilder, TrayIconEvent, menu::{Menu, MenuItem, PredefinedMenuItem}};

/// Global state shared across Tauri commands.
pub struct AppState {
    pub beammp: beammp::BeamMpServer,
    pub playit: playit::PlayitAgent,
    pub settings: Mutex<config::AppSettings>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Load settings from disk (or default on first run).
            let settings = config::load_settings().unwrap_or_default();
            *app.state::<AppState>().settings.lock().unwrap() = settings;

            // Build the system tray with Start/Stop/Open/Quit.
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let open_i = MenuItem::with_id(app, "open", "Open BeamMP Host", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(app, &[&open_i, &sep, &quit_i])?;
            let _tray = TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("BeamMP Host")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::DoubleClick { .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;
            Ok(())
        })
        .manage(AppState {
            beammp: beammp::BeamMpServer::new(),
            playit: playit::PlayitAgent::new(),
            settings: Mutex::new(config::AppSettings::default()),
        })
        .invoke_handler(tauri::generate_handler![
            // BeamMP server
            beammp::start_beammp_server,
            beammp::stop_beammp_server,
            beammp::restart_beammp_server,
            beammp::send_beammp_command,
            beammp::get_beammp_status,
            // playit agent
            playit::start_playit_agent,
            playit::confirm_playit_claimed,
            playit::stop_playit_agent,
            playit::get_playit_status,
            playit::resync_tunnel_port,
            // Config I/O
            config::load_server_config,
            config::save_server_config,
            config::load_app_settings_cmd,
            config::save_app_settings,
            // GitHub downloads
            github::check_for_updates,
            github::install_beammp_binary,
            github::install_playit_binary,
            // Misc
            open_external_url,
        ])
        .on_window_event(|window, event| {
            // Minimize to tray instead of quitting when the close button is clicked.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let app = window.app_handle();
                let state = app.state::<AppState>();
                let minimize = state.settings.lock().unwrap().minimize_to_tray;
                if minimize {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Open a URL in the user's default browser. Used for the BeamMP key portal and playit claim URL.
#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| e.to_string())
}
