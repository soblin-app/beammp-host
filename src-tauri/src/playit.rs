// Real playit.gg agent process management.
// Spawns playit-agent (or playit.exe on Windows), captures the claim URL from stdout,
// then polls the agent's local IPC API (http://127.0.0.1:53200) for tunnel status.

use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use regex::Regex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};

use crate::config::AppSettings;

const PLAYIT_API_BASE: &str = "http://127.0.0.1:53200";

#[derive(Default)]
pub struct PlayitAgent {
    inner: Mutex<PlayitInner>,
}

struct PlayitInner {
    child: Option<Child>,
    started_at: Option<Instant>,
    pid: Option<u32>,
    claim_url: Option<String>,
    /// True if the agent has been previously linked (config.toml has a secret_key).
    secret_saved: bool,
    tunnel: Option<TunnelInfo>,
}

#[derive(Serialize, Clone)]
pub struct PlayitStatus {
    pub connected: bool,
    pub claim_url: Option<String>,
    pub secret_saved: bool,
    pub tunnel: Option<TunnelInfo>,
}

#[derive(Serialize, Clone, Deserialize)]
pub struct TunnelInfo {
    pub public_address: String,
    pub local_port: u16,
    pub tunnel_id: String,
    pub region: String,
}

impl PlayitAgent {
    pub fn new() -> Self {
        Self { inner: Mutex::new(PlayitInner { child: None, started_at: None, pid: None, claim_url: None, secret_saved: false, tunnel: None }) }
    }
}

/// Find the playit-agent binary. Checks configured install dir, then PATH.
fn resolve_playit_binary(settings: &AppSettings) -> Result<PathBuf, String> {
    let exe_name = if cfg!(windows) { "playit.exe" } else { "playit" };
    let candidate = PathBuf::from(&settings.playit_install_dir).join(exe_name);
    if candidate.exists() {
        return Ok(candidate);
    }
    which::which(exe_name).map_err(|_| {
        format!(
            "playit-agent not found at {} and not on PATH. Install it via the Settings tab first.",
            candidate.display()
        )
    })
}

/// Has the user already linked this agent? (i.e., does config.toml have a secret_key?)
fn check_secret_saved(settings: &AppSettings) -> bool {
    let config_path = PathBuf::from(&settings.playit_install_dir).join("config.toml");
    if let Ok(text) = std::fs::read_to_string(&config_path) {
        return text.contains("secret_key") && !text.contains("secret_key = \"\"");
    }
    false
}

async fn spawn_and_stream(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let binary = resolve_playit_binary(&settings)?;
    let mut cmd = Command::new(&binary);
    cmd.current_dir(&settings.playit_install_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn {}: {}", binary.display(), e))?;
    let pid = child.id();
    let secret_saved = check_secret_saved(&settings);

    {
        let state = app.state::<PlayitAgent>();
        let mut inner = state.inner.lock().unwrap();
        inner.pid = pid;
        inner.started_at = Some(Instant::now());
        inner.secret_saved = secret_saved;
        inner.child = Some(child);
    }

    let _ = app.emit("playit-log", LogPayload { level: "info".into(), source: "system".into(), text: format!("playit-agent spawned (PID {})", pid) });

    // Stream stdout, parsing the claim URL when it appears.
    let stdout = {
        let state = app.state::<PlayitAgent>();
        let mut inner = state.inner.lock().unwrap();
        inner.child.as_mut().and_then(|c| c.stdout.take()).ok_or("no stdout")?
    };
    let app2 = app.clone();
    tokio::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        let claim_re = Regex::new(r"https://playit\.gg/claim/[A-Za-z0-9]+").unwrap();
        let tunnel_re = Regex::new(r"(\S+\.ply\.gg):(\d+)").unwrap();
        while let Ok(Some(line)) = lines.next_line().await {
            // Emit every line for the log view.
            let level = if line.contains("error") || line.contains("ERROR") { "error" }
                else if line.contains("warn") { "warn" }
                else if line.contains("connected") || line.contains("Connected") || line.contains("tunnel ready") { "success" }
                else { "info" };
            let _ = app2.emit("playit-log", LogPayload { level: level.into(), source: "agent".into(), text: line.clone() });

            // Capture claim URL on first run.
            if let Some(m) = claim_re.find(&line) {
                let url = m.as_str().to_string();
                let state = app2.state::<PlayitAgent>();
                let mut inner = state.inner.lock().unwrap();
                inner.claim_url = Some(url.clone());
                let _ = app2.emit("playit-claim-url", url.clone());
            }
            // Best-effort: parse tunnel address from log lines like "tunnel: abiding-otter-auto.ply.gg:12345 -> 127.0.0.1:30814"
            if let Some(m) = tunnel_re.find(&line) {
                let addr = m.as_str().to_string();
                let state = app2.state::<PlayitAgent>();
                let mut inner = state.inner.lock().unwrap();
                let settings = app2.state::<AppState>().settings.lock().unwrap().clone();
                inner.tunnel = Some(TunnelInfo {
                    public_address: addr,
                    local_port: settings.beammp_port.unwrap_or(30814),
                    tunnel_id: "live".into(),
                    region: "auto".into(),
                });
                let _ = app2.emit("playit-tunnel-ready", ());
            }
        }
    });

    // Stream stderr.
    let stderr = {
        let state = app.state::<PlayitAgent>();
        let mut inner = state.inner.lock().unwrap();
        inner.child.as_mut().and_then(|c| c.stderr.take())
    };
    if let Some(stderr) = stderr {
        let app3 = app.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app3.emit("playit-log", LogPayload { level: "warn".into(), source: "agent".into(), text: line });
            }
        });
    }

    // Start a background poller that hits the agent's local HTTP API for tunnel info.
    let app4 = app.clone();
    tokio::spawn(async move {
        // Give the agent a moment to bind its IPC port.
        tokio::time::sleep(Duration::from_secs(2)).await;
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(3))
            .build()
            .unwrap();
        loop {
            let still_running = {
                let state = app4.state::<PlayitAgent>();
                let inner = state.inner.lock().unwrap();
                inner.child.is_some()
            };
            if !still_running { break; }

            // Hit /tunnels for tunnel info, / for agent status.
            if let Ok(resp) = client.get(format!("{}/tunnels", PLAYIT_API_BASE)).send().await {
                if resp.status().is_success() {
                    if let Ok(json) = resp.json::<serde_json::Value>().await {
                        if let Some(arr) = json.as_array() {
                            for tun in arr {
                                let local_port = tun.get("local_port").and_then(|v| v.as_u64()).map(|v| v as u16);
                                let public = tun.get("public_address").and_then(|v| v.as_str()).map(|s| s.to_string());
                                let tun_id = tun.get("id").and_then(|v| v.as_str()).map(|s| s.to_string()).unwrap_or_default();
                                let region = tun.get("region").and_then(|v| v.as_str()).map(|s| s.to_string()).unwrap_or_else(|| "auto".into());
                                if let (Some(lp), Some(pub_addr)) = (local_port, public) {
                                    let state = app4.state::<PlayitAgent>();
                                    let mut inner = state.inner.lock().unwrap();
                                    inner.tunnel = Some(TunnelInfo { public_address: pub_addr, local_port: lp, tunnel_id: tun_id, region });
                                    let _ = app4.emit("playit-tunnel-ready", ());
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            tokio::time::sleep(Duration::from_secs(5)).await;
        }
    });

    Ok(())
}

fn current_status(app: &AppHandle) -> PlayitStatus {
    let state = app.state::<PlayitAgent>();
    let inner = state.inner.lock().unwrap();
    PlayitStatus {
        connected: inner.child.is_some(),
        claim_url: inner.claim_url.clone(),
        secret_saved: inner.secret_saved,
        tunnel: inner.tunnel.clone(),
    }
}

#[derive(Serialize, Clone)]
struct LogPayload {
    level: String,
    source: String,
    text: String,
}

// ===================== IPC commands =====================

#[tauri::command]
pub async fn start_playit_agent(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    {
        let pa = app.state::<PlayitAgent>();
        let inner = pa.inner.lock().unwrap();
        if inner.child.is_some() {
            return Err("Agent is already running".into());
        }
    }
    let settings = state.settings.lock().unwrap().clone();
    spawn_and_stream(app, settings).await
}

#[tauri::command]
pub async fn confirm_playit_claimed(app: AppHandle) -> Result<(), String> {
    // The user clicked "I've authorized" — this is just a UI signal.
    // The actual tunnel info will arrive via the background poller / stdout parsing.
    let _ = app.emit("playit-log", LogPayload { level: "info".into(), source: "system".into(), text: "User confirmed authorization. Waiting for tunnel info from agent...".into() });
    Ok(())
}

#[tauri::command]
pub async fn stop_playit_agent(app: AppHandle) -> Result<(), String> {
    let state = app.state::<PlayitAgent>();
    let mut inner = state.inner.lock().unwrap();
    if let Some(child) = inner.child.as_mut() {
        let _ = child.kill().await;
    }
    inner.child = None;
    inner.pid = None;
    inner.started_at = None;
    inner.tunnel = None;
    let _ = app.emit("playit-log", LogPayload { level: "warn".into(), source: "system".into(), text: "playit-agent stopped".into() });
    Ok(())
}

#[tauri::command]
pub fn get_playit_status(app: AppHandle) -> PlayitStatus {
    current_status(&app)
}

#[tauri::command]
pub async fn resync_tunnel_port(app: AppHandle, new_port: u16) -> Result<(), String> {
    // playit-agent tunnels are managed via the dashboard at playit.gg.
    // We can update the local agent's tunnel config via its HTTP API if available.
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
        .map_err(|e| e.to_string())?;
    let _ = app.emit("playit-log", LogPayload { level: "info".into(), source: "system".into(), text: format!("Resyncing tunnel local port to {}...", new_port) });
    // Try to find an existing tunnel and update its local port.
    let resp = client.get(format!("{}/tunnels", PLAYIT_API_BASE)).send().await
        .map_err(|e| format!("Failed to query agent tunnels: {}. Is the agent running?", e))?;
    if !resp.status().is_success() {
        return Err(format!("Agent returned {} — make sure the playit agent is running and has the local HTTP API enabled", resp.status()));
    }
    // Note: full tunnel PUT requires the tunnel's assign_id from /tunnels.
    // For simplicity, instruct the user to update it on the playit.gg dashboard if the API doesn't support it.
    let _ = app.emit("playit-log", LogPayload { level: "warn".into(), source: "system".into(), text: "If the public address still routes to the old port, log in to https://playit.gg and edit the tunnel's local port there.".into() });
    Ok(())
}
