// Mock BeamMP-Server process manager.
// In a real Tauri/Electron build this module would spawn the actual BeamMP-Server binary
// and tail its stdout. Here we simulate the lifecycle with realistic log output so the UI
// is fully interactive without a real BeamMP install.

import type { LogLine, PlayerInfo, ServerConfig } from "./types";

let lineCounter = 0;
function nextId(): string {
  lineCounter += 1;
  return `l-${lineCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeLog(
  level: LogLine["level"],
  source: LogLine["source"],
  text: string,
): LogLine {
  return { id: nextId(), ts: Date.now(), level, source, text };
}

const BOOT_LOG_TEMPLATES: Array<{ level: LogLine["level"]; text: string; delayMs: number }> = [
  { level: "info", text: "BeamMP-Server v3.3.0 starting up...", delayMs: 200 },
  { level: "info", text: "Loading ServerConfig.toml...", delayMs: 350 },
  { level: "info", text: "Configuration parsed. Port=30814 MaxPlayers=10 Map=gridmap_v2", delayMs: 250 },
  { level: "info", text: "AuthKey present and valid format.", delayMs: 200 },
  { level: "info", text: "Scanning Resources/ folder for mods...", delayMs: 400 },
  { level: "success", text: "Loaded 0 server resources, 0 client resources.", delayMs: 300 },
  { level: "info", text: "Initializing socket on 0.0.0.0:30814 (TCP+UDP)...", delayMs: 350 },
  { level: "success", text: "Socket bound. Server is now listening.", delayMs: 250 },
  { level: "info", text: "Registering with BeamMP master server...", delayMs: 600 },
  { level: "success", text: "Successfully registered with master server. Server is publicly listed.", delayMs: 200 },
];

const CRASH_LOG_TEMPLATES: Array<{ level: LogLine["level"]; text: string }> = [
  { level: "warn", text: "Heartbeat to master server failed (timeout).", level_text: "" } as any,
  { level: "error", text: "Fatal: socket recv returned unrecoverable error (errno 104)." },
  { level: "error", text: "BeamMP-Server process exited with code 134 (SIGABRT)." },
];

const IDLE_LOG_POOL: Array<{ level: LogLine["level"]; text: string }> = [
  { level: "info", text: "Heartbeat to master server OK (latency 42ms)." },
  { level: "info", text: "Player slot usage: 0/10." },
  { level: "info", text: "Resources heartbeat: 0 client / 0 server mods active." },
  { level: "info", text: "Ticked simulation: 0 cars, 60 Hz steady." },
  { level: "info", text: "Network throughput: ↓1.2KB/s ↑0.3KB/s." },
];

export interface BootProgressEvent {
  log: LogLine;
  done: boolean;
}

/**
 * Returns an async generator that yields boot log lines with realistic timing.
 * Used by the store when the user clicks "Start".
 */
export async function* streamBootLogs(
  config: ServerConfig,
): AsyncGenerator<BootProgressEvent, void, unknown> {
  yield {
    log: makeLog("info", "server", `BeamMP-Server starting on port ${config.Port}`),
    done: false,
  };
  for (const template of BOOT_LOG_TEMPLATES) {
    await sleep(template.delayMs);
    const text = template.text
      .replace("30814", String(config.Port))
      .replace("MaxPlayers=10", `MaxPlayers=${config.MaxPlayers}`)
      .replace("gridmap_v2", config.Map.split("/")[2] ?? "gridmap_v2");
    yield { log: makeLog(template.level, "server", text), done: false };
  }
  yield { log: makeLog("success", "server", "Server is now RUNNING."), done: true };
}

export async function* streamCrashLogs(): AsyncGenerator<BootProgressEvent, void, unknown> {
  for (const template of CRASH_LOG_TEMPLATES) {
    await sleep(180);
    yield { log: makeLog(template.level, "server", template.text), done: false };
  }
  yield { log: makeLog("error", "server", "Server crashed. Auto-restart will trigger in 3s."), done: true };
}

export function randomIdleLog(): LogLine {
  const template = IDLE_LOG_POOL[Math.floor(Math.random() * IDLE_LOG_POOL.length)];
  return makeLog(template.level, "server", template.text);
}

const FAKE_PLAYER_NAMES = [
  "DriftKing",
  "CrashTestDummy",
  "OffroadAndy",
  "HighwayHannah",
  "TurboTom",
  "SlideSam",
  "BurnoutBob",
  "RallyRobin",
];

export function spawnRandomPlayer(): PlayerInfo {
  const name = FAKE_PLAYER_NAMES[Math.floor(Math.random() * FAKE_PLAYER_NAMES.length)];
  return {
    name,
    cars: 1,
    pingMs: 30 + Math.floor(Math.random() * 120),
    connectedAt: Date.now(),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mock BeamMP console commands. Returns the log line the server would print in response.
 */
export function executeConsoleCommand(input: string, config: ServerConfig): LogLine {
  const cmd = input.trim().toLowerCase();
  if (cmd === "help" || cmd === "?") {
    return makeLog("info", "server", "Available commands: help, status, list_players, kick <name>, say <msg>, reload_plugins, version, exit");
  }
  if (cmd === "status") {
    return makeLog("info", "server", `Server "${config.Name}" running on port ${config.Port}. Players: 0/${config.MaxPlayers}.`);
  }
  if (cmd === "list_players") {
    return makeLog("info", "server", "Players online: 0");
  }
  if (cmd.startsWith("kick ")) {
    const name = input.slice(5).trim();
    return makeLog("info", "server", `Kicked player "${name}".`);
  }
  if (cmd.startsWith("say ")) {
    const msg = input.slice(4).trim();
    return makeLog("success", "server", `Broadcast to all players: ${msg}`);
  }
  if (cmd === "reload_plugins") {
    return makeLog("info", "server", "Reloading all plugins from Resources/...");
  }
  if (cmd === "version") {
    return makeLog("info", "server", "BeamMP-Server v3.3.0 (mock)");
  }
  if (cmd === "exit" || cmd === "quit") {
    return makeLog("warn", "server", "Use the Stop button to shut down the server.");
  }
  return makeLog("warn", "server", `Unknown command: "${input}". Type "help" for a list.`);
}
