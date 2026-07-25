// ServerConfig.toml file I/O + app settings persistence.
// On first run we generate a default ServerConfig.toml so the user has a starting point.

use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ServerConfigFile {
    pub name: String,
    pub port: u16,
    pub auth_key: String,
    pub private: bool,
    pub max_players: u32,
    pub max_cars: u32,
    pub map: String,
    pub description: String,
    pub tags: String,
    pub allow_guests: bool,
    pub log_chat: bool,
    pub debug: bool,
    pub information_packet: bool,
    pub resource_folder: String,
}

impl Default for ServerConfigFile {
    fn default() -> Self {
        Self {
            name: "My BeamMP Server".into(),
            port: 30814,
            auth_key: String::new(),
            private: true,
            max_players: 10,
            max_cars: 1,
            map: "/levels/gridmap_v2/info.json".into(),
            description: "My server".into(),
            tags: "Freeroam,Modded".into(),
            allow_guests: false,
            log_chat: false,
            debug: false,
            information_packet: true,
            resource_folder: "Resources".into(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppSettings {
    pub beammp_install_dir: String,
    pub playit_install_dir: String,
    pub auto_start_tunnel_with_server: bool,
    pub auto_restart_on_crash: bool,
    pub restart_backoff_ms: u32,
    pub minimize_to_tray: bool,
    pub env_override_enabled: bool,
    pub beammp_port: Option<u16>,
}

impl Default for AppSettings {
    fn default() -> Self {
        let home = dirs::home_dir().map(|p| p.display().to_string()).unwrap_or_else(|| ".".into());
        Self {
            beammp_install_dir: format!("{}/BeamMP-Server", home),
            playit_install_dir: format!("{}/playit-agent", home),
            auto_start_tunnel_with_server: true,
            auto_restart_on_crash: true,
            restart_backoff_ms: 3000,
            minimize_to_tray: true,
            env_override_enabled: false,
            beammp_port: Some(30814),
        }
    }
}

fn app_data_dir() -> PathBuf {
    let base = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join("BeamMPHost")
}

fn server_config_path() -> PathBuf {
    // ServerConfig.toml lives in the BeamMP install dir (BeamMP-Server reads it from cwd).
    // But for safety, we always load it from there — fall back to app data dir if not present.
    app_data_dir().join("ServerConfig.toml")
}

fn settings_path() -> PathBuf {
    app_data_dir().join("settings.json")
}

pub fn load_server_config_file() -> Result<ServerConfigFile, String> {
    let path = server_config_path();
    if !path.exists() {
        let default = ServerConfigFile::default();
        let _ = save_server_config_file(&default);
        return Ok(default);
    }
    let text = fs::read_to_string(&path).map_err(|e| format!("read {}: {}", path.display(), e))?;
    parse_server_config(&text)
}

pub fn save_server_config_file(cfg: &ServerConfigFile) -> Result<(), String> {
    let path = server_config_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let toml_text = toml::to_string_pretty(&toml::Value::Table({
        let mut t = toml::value::Table::new();
        let mut general = toml::value::Table::new();
        general.insert("Name".into(), cfg.name.clone().into());
        general.insert("Port".into(), (cfg.port as i64).into());
        general.insert("AuthKey".into(), cfg.auth_key.clone().into());
        general.insert("Private".into(), cfg.private.into());
        general.insert("MaxPlayers".into(), (cfg.max_players as i64).into());
        general.insert("MaxCars".into(), (cfg.max_cars as i64).into());
        general.insert("Map".into(), cfg.map.clone().into());
        general.insert("Description".into(), cfg.description.clone().into());
        general.insert("Tags".into(), cfg.tags.clone().into());
        general.insert("AllowGuests".into(), cfg.allow_guests.into());
        general.insert("LogChat".into(), cfg.log_chat.into());
        general.insert("Debug".into(), cfg.debug.into());
        general.insert("InformationPacket".into(), cfg.information_packet.into());
        general.insert("ResourceFolder".into(), cfg.resource_folder.clone().into());
        t.insert("General".into(), general.into());
        t
    })).map_err(|e| e.to_string())?;
    fs::write(&path, toml_text).map_err(|e| format!("write {}: {}", path.display(), e))
}

fn parse_server_config(text: &str) -> Result<ServerConfigFile, String> {
    let value: toml::Value = toml::from_str(text).map_err(|e| format!("parse TOML: {}", e))?;
    let general = value.get("General").ok_or("missing [General] section")?.as_table().ok_or("General is not a table")?;
    let get_str = |k: &str| general.get(k).and_then(|v| v.as_str()).unwrap_or("").to_string();
    let get_bool = |k: &str, def: bool| general.get(k).and_then(|v| v.as_bool()).unwrap_or(def);
    let get_int = |k: &str, def: i64| general.get(k).and_then(|v| v.as_integer()).unwrap_or(def);
    Ok(ServerConfigFile {
        name: get_str("Name"),
        port: get_int("Port", 30814) as u16,
        auth_key: get_str("AuthKey"),
        private: get_bool("Private", true),
        max_players: get_int("MaxPlayers", 10) as u32,
        max_cars: get_int("MaxCars", 1) as u32,
        map: get_str("Map"),
        description: get_str("Description"),
        tags: get_str("Tags"),
        allow_guests: get_bool("AllowGuests", false),
        log_chat: get_bool("LogChat", false),
        debug: get_bool("Debug", false),
        information_packet: get_bool("InformationPacket", true),
        resource_folder: get_str("ResourceFolder"),
    })
}

pub fn load_settings() -> Result<AppSettings, String> {
    let path = settings_path();
    if !path.exists() {
        let default = AppSettings::default();
        let _ = save_settings(&default);
        return Ok(default);
    }
    let text = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

pub fn save_settings(settings: &AppSettings) -> Result<(), String> {
    let path = settings_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let text = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&path, text).map_err(|e| e.to_string())
}

/// Build BEAMMP_<SETTING> environment variables for child process injection.
pub fn env_overrides_for(cfg: &ServerConfigFile) -> Vec<(String, String)> {
    vec![
        ("BEAMMP_NAME".into(), cfg.name.clone()),
        ("BEAMMP_PORT".into(), cfg.port.to_string()),
        ("BEAMMP_AUTHKEY".into(), cfg.auth_key.clone()),
        ("BEAMMP_PRIVATE".into(), cfg.private.to_string()),
        ("BEAMMP_MAXPLAYERS".into(), cfg.max_players.to_string()),
        ("BEAMMP_MAXCARS".into(), cfg.max_cars.to_string()),
        ("BEAMMP_MAP".into(), cfg.map.clone()),
        ("BEAMMP_DESCRIPTION".into(), cfg.description.clone()),
        ("BEAMMP_TAGS".into(), cfg.tags.clone()),
        ("BEAMMP_ALLOWGUESTS".into(), cfg.allow_guests.to_string()),
        ("BEAMMP_LOGCHAT".into(), cfg.log_chat.to_string()),
        ("BEAMMP_DEBUG".into(), cfg.debug.to_string()),
        ("BEAMMP_INFORMATIONPACKET".into(), cfg.information_packet.to_string()),
        ("BEAMMP_RESOURCEFOLDER".into(), cfg.resource_folder.clone()),
    ]
}

// ===================== IPC commands =====================

#[tauri::command]
pub fn load_server_config() -> Result<ServerConfigFile, String> {
    load_server_config_file()
}

#[tauri::command]
pub fn save_server_config(cfg: ServerConfigFile) -> Result<(), String> {
    save_server_config_file(&cfg)
}

#[tauri::command]
pub fn load_app_settings_cmd(app: AppHandle) -> AppSettings {
    let state = app.state::<crate::AppState>();
    let inner = state.settings.lock().unwrap();
    inner.clone()
}

#[tauri::command]
pub fn save_app_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    {
        let state = app.state::<crate::AppState>();
        *state.settings.lock().unwrap() = settings.clone();
    }
    save_settings(&settings)
}
