// Real BeamMP-Server process management.
// Spawns BeamMP-Server.exe as a child process, tails stdout/stderr to the frontend
// via Tauri events, and supervises the lifecycle (start/stop/restart/auto-restart-on-crash).

use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};

use crate::config::AppSettings;

#[derive(Default)]
pub struct BeamMpServer {
    inner: Mutex<BeamMpInner>,
}

struct BeamMpInner {
    child: Option<Child>,
    started_at: Option<Instant>,
    pid: Option<u32>,
    /// True when the user explicitly stopped the server (so we shouldn't auto-restart).
    user_stopped: bool,
    /// Number of consecutive crash-restarts since the last clean start.
    restart_attempts: u32,
}

#[derive(serde::Serialize, Clone)]
pub struct BeamMpStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub uptime_secs: Option<u64>,
    pub restart_attempts: u32,
}

impl BeamMpServer {
    pub fn new() -> Self {
        Self { inner: Mutex::new(BeamMpInner { child: None, started_at: None, pid: None, user_stopped: false, restart_attempts: 0 }) }
    }
}

/// Find the BeamMP-Server binary. Checks the configured install dir first, then PATH.
fn resolve_beammp_binary(settings: &AppSettings) -> Result<PathBuf, String> {
    let exe_name = if cfg!(windows) { "BeamMP-Server.exe" } else { "BeamMP-Server" };
    let candidate = PathBuf::from(&settings.beammp_install_dir).join(exe_name);
    if candidate.exists() {
        return Ok(candidate);
    }
    which::which(exe_name).map_err(|_| {
        format!(
            "BeamMP-Server not found at {} and not on PATH. Install it via the Settings tab first.",
            candidate.display()
        )
    })
}

/// Spawn the BeamMP-Server child process and stream its stdout/stderr to the frontend.
async fn spawn_and_supervise(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let binary = resolve_beammp_binary(&settings)?;
    let mut cmd = Command::new(&binary);
    cmd.current_dir(&settings.beammp_install_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    // Optional env-var injection (BEAMMP_*) — only if user enabled it.
    if settings.env_override_enabled {
        if let Ok(cfg) = crate::config::load_server_config_file() {
            for (k, v) in crate::config::env_overrides_for(&cfg) {
                cmd.env(k, v);
            }
        }
    }

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn {}: {}", binary.display(), e))?;
    let pid = child.id();

    {
        let state = app.state::<BeamMpServer>();
        let mut inner = state.inner.lock().unwrap();
        inner.pid = pid;
        inner.started_at = Some(Instant::now());
        inner.user_stopped = false;
        inner.child = Some(child);
    }

    let _ = app.emit("beammp-log", LogPayload { level: "info".into(), source: "system".into(), text: format!("BeamMP-Server spawned (PID {})", pid) });
    let _ = app.emit("beammp-status", current_status(&app));

    // Spawn a separate task to wait for process exit and handle auto-restart.
    let app2 = app.clone();
    tokio::spawn(async move {
        let exit_status = {
            let state = app2.state::<BeamMpServer>();
            let mut inner = state.inner.lock().unwrap();
            if let Some(child) = inner.child.as_mut() {
                child.wait().await.ok()
            } else {
                None
            }
        };

        let user_stopped = {
            let state = app2.state::<BeamMpServer>();
            let mut inner = state.inner.lock().unwrap();
            let was_user = inner.user_stopped;
            inner.child = None;
            inner.pid = None;
            inner.started_at = None;
            was_user
        };

        let code = exit_status.and_then(|s| s.code()).unwrap_or(-1);
        if user_stopped {
            let _ = app2.emit("beammp-log", LogPayload { level: "success".into(), source: "system".into(), text: format!("BeamMP-Server stopped cleanly (exit {})", code) });
        } else {
            let _ = app2.emit("beammp-log", LogPayload { level: "error".into(), source: "system".into(), text: format!("BeamMP-Server crashed (exit {}). Auto-restart will trigger.", code) });
            // Auto-restart with backoff
            let settings = app2.state::<AppState>().settings.lock().unwrap().clone();
            if settings.auto_restart_on_crash {
                let backoff = settings.restart_backoff_ms.max(1000);
                let attempts = {
                    let state = app2.state::<BeamMpServer>();
                    let mut inner = state.inner.lock().unwrap();
                    inner.restart_attempts += 1;
                    inner.restart_attempts
                };
                let _ = app2.emit("beammp-log", LogPayload { level: "warn".into(), source: "system".into(), text: format!("Auto-restart attempt #{} in {}ms", attempts, backoff) });
                tokio::time::sleep(Duration::from_millis(backoff as u64)).await;
                let _ = spawn_and_supervise(app2.clone(), settings).await;
            }
        }
        let _ = app2.emit("beammp-status", current_status(&app2));
    });

    // Stream stdout/stderr lines as log events.
    if let Some(stdout) = {
        let state = app.state::<BeamMpServer>();
        let mut inner = state.inner.lock().unwrap();
        inner.child.as_mut().and_then(|c| c.stdout.take())
    } {
        let app3 = app.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let level = if line.contains("[ERROR]") || line.contains("error") { "error" }
                    else if line.contains("[WARN]") || line.contains("warn") { "warn" }
                    else if line.contains("success") || line.contains("ready") { "success" }
                    else { "info" };
                let _ = app3.emit("beammp-log", LogPayload { level: level.into(), source: "server".into(), text: line });
            }
        });
    }
    if let Some(stderr) = {
        let state = app.state::<BeamMpServer>();
        let mut inner = state.inner.lock().unwrap();
        inner.child.as_mut().and_then(|c| c.stderr.take())
    } {
        let app4 = app.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app4.emit("beammp-log", LogPayload { level: "warn".into(), source: "server".into(), text: line });
            }
        });
    }

    Ok(())
}

fn current_status(app: &AppHandle) -> BeamMpStatus {
    let state = app.state::<BeamMpServer>();
    let inner = state.inner.lock().unwrap();
    BeamMpStatus {
        running: inner.child.is_some(),
        pid: inner.pid,
        uptime_secs: inner.started_at.map(|t| t.elapsed().as_secs()),
        restart_attempts: inner.restart_attempts,
    }
}

#[derive(serde::Serialize, Clone)]
struct LogPayload {
    level: String,
    source: String,
    text: String,
}

// ===================== IPC commands =====================

#[tauri::command]
pub async fn start_beammp_server(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    // Reject if already running.
    {
        let bs = app.state::<BeamMpServer>();
        let inner = bs.inner.lock().unwrap();
        if inner.child.is_some() {
            return Err("Server is already running".into());
        }
    }
    // Validate AuthKey before spawning.
    let cfg = crate::config::load_server_config_file()
        .map_err(|e| format!("Failed to read ServerConfig.toml: {}. Save your config first.", e))?;
    if cfg.auth_key.trim().is_empty() || cfg.auth_key.trim().len() < 8 {
        return Err("AuthKey is required. Get one at https://keymaster.beammp.com/ and save it in the Config tab.".into());
    }
    let settings = state.settings.lock().unwrap().clone();
    spawn_and_supervise(app, settings).await
}

#[tauri::command]
pub async fn stop_beammp_server(app: AppHandle) -> Result<(), String> {
    let state = app.state::<BeamMpServer>();
    let mut inner = state.inner.lock().unwrap();
    inner.user_stopped = true;
    inner.restart_attempts = 0;
    if let Some(child) = inner.child.as_mut() {
        // Try to kill the whole process group (children like plugins too).
        let _ = child.kill().await;
    }
    Ok(())
}

#[tauri::command]
pub async fn restart_beammp_server(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    stop_beammp_server(app.clone()).await?;
    tokio::time::sleep(Duration::from_millis(400)).await;
    let settings = state.settings.lock().unwrap().clone();
    spawn_and_supervise(app, settings).await
}

#[tauri::command]
pub async fn send_beammp_command(app: AppHandle, input: String) -> Result<(), String> {
    let state = app.state::<BeamMpServer>();
    let mut inner = state.inner.lock().unwrap();
    if let Some(child) = inner.child.as_mut() {
        use tokio::io::AsyncWriteExt;
        if let Some(stdin) = child.stdin.as_mut() {
            let _ = app.emit("beammp-log", LogPayload { level: "cmd".into(), source: "system".into(), text: format!("> {}", input) });
            stdin.write_all(format!("{}\n", input).as_bytes()).await
                .map_err(|e| format!("Failed to write to stdin: {}", e))?;
            return Ok(());
        }
        return Err("Server stdin not available".into());
    }
    Err("Server is not running".into())
}

#[tauri::command]
pub fn get_beammp_status(app: AppHandle) -> BeamMpStatus {
    current_status(&app)
}
