// Real GitHub releases API: check for updates and download/install BeamMP-Server and playit-agent.

use std::fs;
use std::io::Write;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use futures_util::StreamExt;

use crate::config::AppSettings;

const BEAMMP_REPO: &str = "BeamMP/BeamMP-Server";
const PLAYIT_REPO: &str = "playit-cloud/playit-agent";

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GithubRelease {
    pub tag_name: String,
    pub name: String,
    pub html_url: String,
    pub assets: Vec<GithubAsset>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GithubAsset {
    pub name: String,
    pub browser_download_url: String,
    pub size: u64,
}

#[derive(Serialize, Clone)]
pub struct UpdateInfo {
    pub beammp_latest: Option<String>,
    pub playit_latest: Option<String>,
}

async fn fetch_latest(repo: &str) -> Option<GithubRelease> {
    let url = format!("https://api.github.com/repos/{}/releases/latest", repo);
    let client = reqwest::Client::builder().user_agent("BeamMP-Host").build().ok()?;
    let resp = client.get(&url).header("Accept", "application/vnd.github+json").send().await.ok()?;
    if !resp.status().is_success() { return None; }
    resp.json::<GithubRelease>().await.ok()
}

fn pick_beammp_asset(release: &GithubRelease) -> Option<&GithubAsset> {
    if cfg!(windows) {
        release.assets.iter().find(|a| a.name.to_lowercase().ends_with(".exe"))
            .or_else(|| release.assets.iter().find(|a| a.name.to_lowercase().contains("windows")))
    } else {
        release.assets.iter().find(|a| a.name.to_lowercase().contains("linux"))
    }
}

fn pick_playit_asset(release: &GithubRelease) -> Option<&GithubAsset> {
    if cfg!(windows) {
        release.assets.iter().find(|a| a.name.to_lowercase().contains("windows") || a.name.to_lowercase().ends_with(".exe"))
    } else {
        release.assets.iter().find(|a| a.name.to_lowercase().contains("linux"))
    }
}

async fn download_to_file(url: &str, dest: &PathBuf, app: &AppHandle) -> Result<u64, String> {
    let client = reqwest::Client::builder().user_agent("BeamMP-Host").build().map_err(|e| e.to_string())?;
    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {} downloading {}", resp.status(), url));
    }
    let total = resp.content_length().unwrap_or(0);
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let mut file = fs::File::create(dest).map_err(|e| e.to_string())?;
    let mut stream = resp.bytes_stream();
    let mut downloaded: u64 = 0;
    let mut last_emit = std::time::Instant::now();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        if last_emit.elapsed() > std::time::Duration::from_millis(200) {
            let pct = if total > 0 { (downloaded * 100) / total } else { 0 };
            let _ = app.emit("download-progress", DownloadProgress { label: dest.file_name().map(|s| s.to_string_lossy().into()).unwrap_or_default(), downloaded, total, pct });
            last_emit = std::time::Instant::now();
        }
    }
    let _ = app.emit("download-progress", DownloadProgress { label: dest.file_name().map(|s| s.to_string_lossy().into()).unwrap_or_default(), downloaded, total: if total == 0 { downloaded } else { total }, pct: 100 });
    Ok(downloaded)
}

#[derive(Serialize, Clone)]
pub struct DownloadProgress {
    pub label: String,
    pub downloaded: u64,
    pub total: u64,
    pub pct: u64,
}

// ===================== IPC commands =====================

#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<UpdateInfo, String> {
    let _ = app.emit("download-progress", DownloadProgress { label: "Checking GitHub for updates...".into(), downloaded: 0, total: 0, pct: 0 });
    let (beammp, playit) = tokio::join!(fetch_latest(BEAMMP_REPO), fetch_latest(PLAYIT_REPO));
    Ok(UpdateInfo {
        beammp_latest: beammp.map(|r| r.tag_name),
        playit_latest: playit.map(|r| r.tag_name),
    })
}

#[tauri::command]
pub async fn install_beammp_binary(app: AppHandle, state: State<'_, crate::AppState>) -> Result<String, String> {
    let release = fetch_latest(BEAMMP_REPO).await
        .ok_or_else(|| "Failed to fetch latest BeamMP-Server release from GitHub".to_string())?;
    let asset = pick_beammp_asset(&release)
        .ok_or_else(|| "No Windows/Linux asset found in latest BeamMP-Server release".to_string())?;
    let settings = state.settings.lock().unwrap().clone();
    let dest_dir = PathBuf::from(&settings.beammp_install_dir);
    fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;
    let dest = dest_dir.join(&asset.name);
    let _ = app.emit("beammp-log", serde_json::json!({ "level": "info", "source": "system", "text": format!("Downloading {} from GitHub...", asset.name) }));
    download_to_file(&asset.browser_download_url, &dest, &app).await?;
    let _ = app.emit("beammp-log", serde_json::json!({ "level": "success", "source": "system", "text": format!("Installed {} to {}", asset.name, dest.display()) }));
    Ok(release.tag_name)
}

#[tauri::command]
pub async fn install_playit_binary(app: AppHandle, state: State<'_, crate::AppState>) -> Result<String, String> {
    let release = fetch_latest(PLAYIT_REPO).await
        .ok_or_else(|| "Failed to fetch latest playit-agent release from GitHub".to_string())?;
    let asset = pick_playit_asset(&release)
        .ok_or_else(|| "No Windows/Linux asset found in latest playit-agent release".to_string())?;
    let settings = state.settings.lock().unwrap().clone();
    let dest_dir = PathBuf::from(&settings.playit_install_dir);
    fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;
    let dest = dest_dir.join(&asset.name);
    let _ = app.emit("playit-log", serde_json::json!({ "level": "info", "source": "system", "text": format!("Downloading {} from GitHub...", asset.name) }));
    download_to_file(&asset.browser_download_url, &dest, &app).await?;
    let _ = app.emit("playit-log", serde_json::json!({ "level": "success", "source": "system", "text": format!("Installed {} to {}", asset.name, dest.display()) }));
    Ok(release.tag_name)
}
