// Tauri bridge: detect whether we're running inside Tauri, and route calls to either
// the real Rust backend (via invoke + listen) or the in-browser mocks.
//
// When packaged as a Tauri desktop app, this module calls real Rust functions that
// spawn BeamMP-Server.exe and playit-agent.exe as actual child processes.
// When running in a plain browser (dev server only), it falls back to the mock
// implementations so you can still explore the UI.

"use client";

import type { LogLine, ServerConfig, TunnelInfo } from "./types";

// Detect Tauri at runtime. The Tauri runtime injects `window.__TAURI_INTERNALS__`
// (Tauri v2) or `window.__TAURI__` (v1). In a plain browser these are undefined.
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as any).__TAURI_INTERNALS__ || !!(window as any).__TAURI__;
}

// Lazily-imported Tauri APIs (only loaded when isTauri() returns true).
async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const m = await import("@tauri-apps/api/core");
  return m.invoke<T>(cmd, args);
}
async function tauriListen(event: string, handler: (payload: any) => void): Promise<() => void> {
  const m = await import("@tauri-apps/api/event");
  return m.listen(event, (e) => handler(e.payload));
}

// ============== Types shared with Rust backend ==============

export interface BeamMpStatusRust {
  running: boolean;
  pid: number | null;
  uptime_secs: number | null;
  restart_attempts: number;
}

export interface PlayitStatusRust {
  connected: boolean;
  claim_url: string | null;
  secret_saved: boolean;
  tunnel: TunnelInfo | null;
}

export interface ServerConfigRust {
  name: string;
  port: number;
  auth_key: string;
  private: boolean;
  max_players: number;
  max_cars: number;
  map: string;
  description: string;
  tags: string;
  allow_guests: boolean;
  log_chat: boolean;
  debug: boolean;
  information_packet: boolean;
  resource_folder: string;
}

export interface AppSettingsRust {
  beammp_install_dir: string;
  playit_install_dir: string;
  auto_start_tunnel_with_server: boolean;
  auto_restart_on_crash: boolean;
  restart_backoff_ms: number;
  minimize_to_tray: boolean;
  env_override_enabled: boolean;
  beammp_port: number | null;
}

// ============== Bridge API ==============

export interface BridgeEventHandlers {
  onBeamMpLog?: (line: LogLine) => void;
  onPlayitLog?: (line: LogLine) => void;
  onBeamMpStatus?: (status: BeamMpStatusRust) => void;
  onPlayitClaimUrl?: (url: string) => void;
  onPlayitTunnelReady?: () => void;
  onDownloadProgress?: (p: { label: string; downloaded: number; total: number; pct: number }) => void;
}

let handlers: BridgeEventHandlers = {};
let listenersAttached = false;

export function setBridgeEventHandlers(h: BridgeEventHandlers) {
  handlers = h;
  if (isTauri() && !listenersAttached) {
    listenersAttached = true;
    void attachTauriListeners();
  }
}

async function attachTauriListeners() {
  await tauriListen("beammp-log", (p: any) => {
    handlers.onBeamMpLog?.(makeLog(p.level, "server", p.text));
  });
  await tauriListen("playit-log", (p: any) => {
    handlers.onPlayitLog?.(makeLog(p.level, "agent", p.text));
  });
  await tauriListen("beammp-status", (s: any) => {
    handlers.onBeamMpStatus?.(s);
  });
  await tauriListen("playit-claim-url", (url: string) => {
    handlers.onPlayitClaimUrl?.(url);
  });
  await tauriListen("playit-tunnel-ready", () => {
    handlers.onPlayitTunnelReady?.();
  });
  await tauriListen("download-progress", (p: any) => {
    handlers.onDownloadProgress?.(p);
  });
}

function makeLog(level: string, source: LogLine["source"], text: string): LogLine {
  return {
    id: `l-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    level: (["info", "warn", "error", "cmd", "success"].includes(level) ? level : "info") as LogLine["level"],
    source,
    text,
  };
}

// ============== Server config (Rust bridge) ==============

export async function loadServerConfigFromDisk(): Promise<ServerConfig | null> {
  if (!isTauri()) return null;
  try {
    const cfg = await tauriInvoke<ServerConfigRust>("load_server_config");
    return rustToConfig(cfg);
  } catch (e) {
    console.error("load_server_config failed:", e);
    return null;
  }
}

export async function saveServerConfigToDisk(cfg: ServerConfig): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    await tauriInvoke("save_server_config", { cfg: configToRust(cfg) });
    return true;
  } catch (e) {
    console.error("save_server_config failed:", e);
    return false;
  }
}

// ============== App settings (Rust bridge) ==============

export async function loadAppSettingsFromDisk(): Promise<Partial<AppSettingsRust> | null> {
  if (!isTauri()) return null;
  try {
    return await tauriInvoke<AppSettingsRust>("load_app_settings_cmd");
  } catch (e) {
    console.error("load_app_settings failed:", e);
    return null;
  }
}

export async function saveAppSettingsToDisk(settings: AppSettingsRust): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    await tauriInvoke("save_app_settings", { settings });
    return true;
  } catch (e) {
    console.error("save_app_settings failed:", e);
    return false;
  }
}

// ============== BeamMP-Server lifecycle ==============

export async function startBeamMpServerReal(): Promise<{ ok: boolean; error?: string }> {
  if (!isTauri()) return { ok: false, error: "Not in Tauri" };
  try {
    await tauriInvoke("start_beammp_server");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e) };
  }
}

export async function stopBeamMpServerReal(): Promise<{ ok: boolean; error?: string }> {
  if (!isTauri()) return { ok: false, error: "Not in Tauri" };
  try {
    await tauriInvoke("stop_beammp_server");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e) };
  }
}

export async function restartBeamMpServerReal(): Promise<{ ok: boolean; error?: string }> {
  if (!isTauri()) return { ok: false, error: "Not in Tauri" };
  try {
    await tauriInvoke("restart_beammp_server");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e) };
  }
}

export async function sendBeamMpCommandReal(input: string): Promise<{ ok: boolean; error?: string }> {
  if (!isTauri()) return { ok: false, error: "Not in Tauri" };
  try {
    await tauriInvoke("send_beammp_command", { input });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e) };
  }
}

export async function getBeamMpStatusReal(): Promise<BeamMpStatusRust | null> {
  if (!isTauri()) return null;
  try {
    return await tauriInvoke<BeamMpStatusRust>("get_beammp_status");
  } catch (e) {
    return null;
  }
}

// ============== playit-agent lifecycle ==============

export async function startPlayitAgentReal(): Promise<{ ok: boolean; error?: string }> {
  if (!isTauri()) return { ok: false, error: "Not in Tauri" };
  try {
    await tauriInvoke("start_playit_agent");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e) };
  }
}

export async function confirmPlayitClaimedReal(): Promise<{ ok: boolean }> {
  if (!isTauri()) return { ok: false };
  try {
    await tauriInvoke("confirm_playit_claimed");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function stopPlayitAgentReal(): Promise<{ ok: boolean }> {
  if (!isTauri()) return { ok: false };
  try {
    await tauriInvoke("stop_playit_agent");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function getPlayitStatusReal(): Promise<PlayitStatusRust | null> {
  if (!isTauri()) return null;
  try {
    return await tauriInvoke<PlayitStatusRust>("get_playit_status");
  } catch {
    return null;
  }
}

export async function resyncTunnelPortReal(port: number): Promise<{ ok: boolean; error?: string }> {
  if (!isTauri()) return { ok: false, error: "Not in Tauri" };
  try {
    await tauriInvoke("resync_tunnel_port", { newPort: port });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e) };
  }
}

// ============== GitHub binary downloads ==============

export async function checkForUpdatesReal(): Promise<{ beammp: string | null; playit: string | null } | null> {
  if (!isTauri()) return null;
  try {
    const r = await tauriInvoke<{ beammp_latest: string | null; playit_latest: string | null }>("check_for_updates");
    return { beammp: r.beammp_latest, playit: r.playit_latest };
  } catch {
    return null;
  }
}

export async function installBeamMpBinaryReal(): Promise<{ ok: boolean; version?: string; error?: string }> {
  if (!isTauri()) return { ok: false, error: "Not in Tauri" };
  try {
    const version = await tauriInvoke<string>("install_beammp_binary");
    return { ok: true, version };
  } catch (e: any) {
    return { ok: false, error: String(e) };
  }
}

export async function installPlayitBinaryReal(): Promise<{ ok: boolean; version?: string; error?: string }> {
  if (!isTauri()) return { ok: false, error: "Not in Tauri" };
  try {
    const version = await tauriInvoke<string>("install_playit_binary");
    return { ok: true, version };
  } catch (e: any) {
    return { ok: false, error: String(e) };
  }
}

// ============== Misc ==============

export async function openExternalUrl(url: string): Promise<void> {
  if (isTauri()) {
    try {
      await tauriInvoke("open_external_url", { url });
      return;
    } catch (e) {
      console.error("open_external_url failed:", e);
    }
  }
  // Fallback: open in a new browser tab.
  window.open(url, "_blank", "noopener,noreferrer");
}

// ============== Conversion helpers ==============

function rustToConfig(r: ServerConfigRust): ServerConfig {
  return {
    Name: r.name,
    Port: r.port,
    AuthKey: r.auth_key,
    Private: r.private,
    MaxPlayers: r.max_players,
    MaxCars: r.max_cars,
    Map: r.map,
    Description: r.description,
    Tags: r.tags,
    AllowGuests: r.allow_guests,
    LogChat: r.log_chat,
    Debug: r.debug,
    InformationPacket: r.information_packet,
    ResourceFolder: r.resource_folder,
  };
}

function configToRust(c: ServerConfig): ServerConfigRust {
  return {
    name: c.Name,
    port: c.Port,
    auth_key: c.AuthKey,
    private: c.Private,
    max_players: c.MaxPlayers,
    max_cars: c.MaxCars,
    map: c.Map,
    description: c.Description,
    tags: c.Tags,
    allow_guests: c.AllowGuests,
    log_chat: c.LogChat,
    debug: c.Debug,
    information_packet: c.InformationPacket,
    resource_folder: c.ResourceFolder,
  };
}
