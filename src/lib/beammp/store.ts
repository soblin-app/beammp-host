// Central Zustand store for the BeamMP hosting app.
// All process lifecycle, config, mods, tunnel, settings, and wizard state lives here.
//
// DUAL-MODE: When running inside Tauri, all process operations call the real Rust
// backend via the tauri-bridge module (which invokes commands that spawn actual
// BeamMP-Server.exe and playit-agent.exe child processes). When running in a plain
// browser (dev/preview only), it falls back to the mock implementations so the UI
// is still explorable.

"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AppSettings,
  BinaryInfo,
  LogLine,
  ModEntry,
  PlayerInfo,
  ServerConfig,
  ServerStatus,
  TunnelInfo,
  TunnelStatus,
  WizardState,
} from "./types";
import { defaultServerConfig, serializeServerConfig, validateServerConfig, parseServerConfigFile } from "./server-config";
import {
  executeConsoleCommand,
  makeLog,
  randomIdleLog,
  spawnRandomPlayer,
  streamBootLogs,
  streamCrashLogs,
} from "./beammp-server-mock";
import {
  streamAgentBoot,
  streamAgentClaimed,
  generateTunnelInfo,
} from "./playit-agent-mock";
import * as bridge from "./tauri-bridge";

const MAX_LOG_LINES = 800;

interface BeamMPState {
  // ----- hydration -----
  hydrated: boolean;
  setHydrated: (v: boolean) => void;

  // ----- active view -----
  activeView:
    | "dashboard"
    | "server"
    | "config"
    | "mods"
    | "tunnel"
    | "join"
    | "wizard"
    | "settings";
  setActiveView: (v: BeamMPState["activeView"]) => void;

  // ----- server config -----
  config: ServerConfig;
  rawConfigText: string;
  configDirty: boolean;
  setConfig: (patch: Partial<ServerConfig>) => void;
  setRawConfigText: (text: string) => void;
  applyRawConfig: () => { ok: boolean; error?: string };
  saveConfig: () => void;

  // ----- server lifecycle -----
  serverStatus: ServerStatus;
  serverPid: number | null;
  serverUptimeMs: number;
  serverStartedAt: number | null;
  autoRestartAttempts: number;
  lastCrashReason: string | null;

  startServer: () => Promise<void>;
  stopServer: () => Promise<void>;
  restartServer: () => Promise<void>;
  sendConsoleCommand: (input: string) => void;

  // ----- logs -----
  logs: LogLine[];
  pushLog: (line: LogLine) => void;
  clearLogs: () => void;

  // ----- players -----
  players: PlayerInfo[];

  // ----- mods -----
  mods: ModEntry[];
  addMod: (mod: Omit<ModEntry, "id" | "addedAt">) => void;
  toggleMod: (id: string) => void;
  deleteMod: (id: string) => void;

  // ----- playit tunnel -----
  tunnelStatus: TunnelStatus;
  tunnelInfo: TunnelInfo | null;
  claimUrl: string | null;
  agentSecretSaved: boolean;
  startAgent: () => Promise<void>;
  confirmClaimed: () => Promise<void>;
  stopAgent: () => void;
  resyncTunnelPort: () => Promise<void>;

  // ----- binaries -----
  beammpBinary: BinaryInfo;
  playitBinary: BinaryInfo;
  checkForUpdates: () => Promise<void>;
  installBeamMP: () => Promise<void>;
  installPlayit: () => Promise<void>;

  // ----- settings -----
  settings: AppSettings;
  setSettings: (patch: Partial<AppSettings>) => void;

  // ----- wizard -----
  wizard: WizardState;
  setWizardStep: (step: WizardState["step"]) => void;
  completeWizardStep: (step: WizardState["step"]) => void;
  skipWizardStep: (step: WizardState["step"]) => void;
  resetWizard: () => void;

  // ----- internal timers (not persisted) -----
  _idleTimer: ReturnType<typeof setInterval> | null;
  _uptimeTimer: ReturnType<typeof setInterval> | null;
  _playerTimer: ReturnType<typeof setInterval> | null;
}

const initialConfig = defaultServerConfig();
const initialRaw = serializeServerConfig(initialConfig);

const defaultSettings: AppSettings = {
  beammpInstallDir: "C:\\BeamMP-Server",
  playitInstallDir: "C:\\playit-agent",
  autoStartTunnelWithServer: true,
  autoRestartOnCrash: true,
  restartBackoffMs: 3000,
  minimizeToTray: true,
  envOverrideEnabled: false,
};

const defaultWizard: WizardState = {
  step: "welcome",
  completed: [],
  skipped: [],
};

export const useBeamMPStore = create<BeamMPState>()(
  persist(
    (set, get) => ({
      // ----- hydration -----
      hydrated: false,
      setHydrated: (v) => set({ hydrated: v }),

      // ----- view -----
      activeView: "dashboard",
      setActiveView: (v) => set({ activeView: v }),

      // ----- config -----
      config: initialConfig,
      rawConfigText: initialRaw,
      configDirty: false,
      setConfig: (patch) => {
        const next = { ...get().config, ...patch };
        set({
          config: next,
          rawConfigText: serializeServerConfig(next),
          configDirty: true,
        });
      },
      setRawConfigText: (text) => set({ rawConfigText: text, configDirty: true }),
      applyRawConfig: () => {
        try {
          const parsed = parseServerConfigFile(get().rawConfigText);
          set({ config: parsed.general, configDirty: false });
          return { ok: true };
        } catch (e) {
          return { ok: false, error: (e as Error).message };
        }
      },
      saveConfig: () => {
        // In Tauri: actually write ServerConfig.toml to the install dir via the Rust backend.
        // In browser: just mark clean and log (mock).
        set({ configDirty: false });
        if (bridge.isTauri()) {
          void bridge.saveServerConfigToDisk(get().config).then((ok) => {
            if (ok) {
              get().pushLog(makeLog("success", "system", "ServerConfig.toml saved to disk."));
            } else {
              get().pushLog(makeLog("error", "system", "Failed to save ServerConfig.toml — check permissions."));
            }
          });
        } else {
          get().pushLog(makeLog("success", "system", "ServerConfig.toml saved to disk (mock)."));
        }
      },

      // ----- server lifecycle -----
      serverStatus: "stopped",
      serverPid: null,
      serverUptimeMs: 0,
      serverStartedAt: null,
      autoRestartAttempts: 0,
      lastCrashReason: null,

      startServer: async () => {
        const state = get();
        if (state.serverStatus === "running" || state.serverStatus === "starting") return;

        const issues = validateServerConfig(state.config).filter((i) => i.severity === "error");
        if (issues.length > 0) {
          for (const issue of issues) {
            get().pushLog(makeLog("error", "system", `Cannot start server: ${issue.message}`));
          }
          return;
        }

        set({
          serverStatus: "starting",
          serverStartedAt: Date.now(),
          serverUptimeMs: 0,
          autoRestartAttempts: 0,
          lastCrashReason: null,
          serverPid: null,
        });

        // ===== Tauri path: spawn the REAL BeamMP-Server binary =====
        if (bridge.isTauri()) {
          // Make sure the latest config is on disk before spawning (the binary reads it from cwd).
          await bridge.saveServerConfigToDisk(state.config);
          const result = await bridge.startBeamMpServerReal();
          if (!result.ok) {
            get().pushLog(makeLog("error", "system", `Failed to start server: ${result.error ?? "unknown error"}`));
            set({ serverStatus: "crashed", lastCrashReason: result.error ?? "spawn failed" });
            return;
          }
          // Real status + logs will arrive via Tauri events (setBridgeEventHandlers wired in page.tsx).
          // Mark as running once we get the first status event, but for responsiveness set it now and let
          // the event listener correct it if the process exits immediately.
          set({ serverStatus: "running" });
          // Start the uptime ticker.
          const uptimeTimer = setInterval(() => {
            const s = get();
            if (s.serverStatus === "running" && s.serverStartedAt) {
              set({ serverUptimeMs: Date.now() - s.serverStartedAt });
            }
          }, 1000);
          set({ _uptimeTimer: uptimeTimer });
          // Auto-start tunnel if enabled.
          if (state.settings.autoStartTunnelWithServer && state.tunnelStatus === "disconnected") {
            get().pushLog(makeLog("info", "system", "Auto-starting playit.gg agent (configured in Settings)."));
            void get().startAgent();
          }
          return;
        }

        // ===== Browser mock path =====
        set({ serverPid: 10000 + Math.floor(Math.random() * 50000) });
        get().pushLog(makeLog("info", "system", `Spawning BeamMP-Server (PID ${get().serverPid})...`));

        // Stream boot logs
        const boot = streamBootLogs(state.config);
        for await (const ev of boot) {
          get().pushLog(ev.log);
        }

        set({ serverStatus: "running" });

        // Auto-start tunnel if enabled
        if (state.settings.autoStartTunnelWithServer && state.tunnelStatus === "disconnected") {
          get().pushLog(makeLog("info", "system", "Auto-starting playit.gg agent (configured in Settings)."));
          void get().startAgent();
        }

        // Start idle log timer
        const idleTimer = setInterval(() => {
          if (get().serverStatus === "running") {
            get().pushLog(randomIdleLog());
          }
        }, 8000);
        const uptimeTimer = setInterval(() => {
          const s = get();
          if (s.serverStatus === "running" && s.serverStartedAt) {
            set({ serverUptimeMs: Date.now() - s.serverStartedAt });
          }
        }, 1000);
        const playerTimer = setInterval(() => {
          const s = get();
          if (s.serverStatus !== "running") return;
          // Occasionally spawn or remove a fake player to make the dashboard feel alive.
          if (Math.random() < 0.25 && s.players.length < s.config.MaxPlayers) {
            const p = spawnRandomPlayer();
            set({ players: [...s.players, p] });
            s.pushLog(makeLog("info", "server", `Player "${p.name}" connected (ping ${p.pingMs}ms).`));
          } else if (Math.random() < 0.15 && s.players.length > 0) {
            const players = [...s.players];
            const removed = players.shift()!;
            set({ players });
            s.pushLog(makeLog("info", "server", `Player "${removed.name}" disconnected.`));
          }
        }, 12000);
        set({ _idleTimer: idleTimer, _uptimeTimer: uptimeTimer, _playerTimer: playerTimer });
      },

      stopServer: async () => {
        const state = get();
        if (state.serverStatus === "stopped") return;
        set({ serverStatus: "stopping" });
        get().pushLog(makeLog("warn", "system", "Stopping BeamMP-Server..."));
        // Stop timers
        if (state._idleTimer) clearInterval(state._idleTimer);
        if (state._uptimeTimer) clearInterval(state._uptimeTimer);
        if (state._playerTimer) clearInterval(state._playerTimer);

        // ===== Tauri path =====
        if (bridge.isTauri()) {
          const result = await bridge.stopBeamMpServerReal();
          if (!result.ok) {
            get().pushLog(makeLog("error", "system", `Failed to stop server: ${result.error ?? "unknown"}`));
          }
          // Real "stopped" status will arrive via beammp-status event, but set it now for responsiveness.
          set({
            serverStatus: "stopped",
            serverPid: null,
            serverStartedAt: null,
            serverUptimeMs: 0,
            players: [],
            _idleTimer: null,
            _uptimeTimer: null,
            _playerTimer: null,
          });
          if (state.settings.autoStartTunnelWithServer && state.tunnelStatus === "tunnel_ready") {
            get().pushLog(makeLog("info", "system", "Stopping playit.gg agent (linked to server lifecycle)."));
            get().stopAgent();
          }
          return;
        }

        // ===== Browser mock path =====
        await new Promise((r) => setTimeout(r, 600));
        get().pushLog(makeLog("success", "system", "BeamMP-Server stopped cleanly (exit code 0)."));
        set({
          serverStatus: "stopped",
          serverPid: null,
          serverStartedAt: null,
          serverUptimeMs: 0,
          players: [],
          _idleTimer: null,
          _uptimeTimer: null,
          _playerTimer: null,
        });
        if (state.settings.autoStartTunnelWithServer && state.tunnelStatus === "tunnel_ready") {
          get().pushLog(makeLog("info", "system", "Stopping playit.gg agent (linked to server lifecycle)."));
          get().stopAgent();
        }
      },

      restartServer: async () => {
        if (bridge.isTauri()) {
          // Tauri backend has a single restart command that handles stop+start atomically.
          get().pushLog(makeLog("info", "system", "Restarting BeamMP-Server..."));
          const result = await bridge.restartBeamMpServerReal();
          if (!result.ok) {
            get().pushLog(makeLog("error", "system", `Restart failed: ${result.error ?? "unknown"}`));
          }
          return;
        }
        await get().stopServer();
        await new Promise((r) => setTimeout(r, 400));
        await get().startServer();
      },

      sendConsoleCommand: (input) => {
        const cmd = input.trim();
        if (!cmd) return;
        get().pushLog(makeLog("cmd", "system", `> ${cmd}`));

        // ===== Tauri path: send to real server stdin =====
        if (bridge.isTauri()) {
          void bridge.sendBeamMpCommandReal(cmd).then((r) => {
            if (!r.ok) {
              get().pushLog(makeLog("error", "system", `Command failed: ${r.error ?? "unknown"}`));
            }
          });
          return;
        }

        // ===== Browser mock path =====
        const response = executeConsoleCommand(cmd, get().config);
        setTimeout(() => get().pushLog(response), 120);
      },

      // ----- logs -----
      logs: [],
      pushLog: (line) => {
        set((s) => {
          const next = [...s.logs, line];
          if (next.length > MAX_LOG_LINES) {
            next.splice(0, next.length - MAX_LOG_LINES);
          }
          return { logs: next };
        });
      },
      clearLogs: () => set({ logs: [] }),

      // ----- players -----
      players: [],

      // ----- mods -----
      mods: [],
      addMod: (mod) => {
        const entry: ModEntry = {
          ...mod,
          id: `mod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          addedAt: Date.now(),
        };
        set((s) => ({ mods: [...s.mods, entry] }));
        get().pushLog(
          makeLog("info", "system", `Added mod "${entry.name}" (${formatBytes(entry.sizeBytes)}) to Resources/${entry.folder}.`),
        );
      },
      toggleMod: (id) => {
        set((s) => ({
          mods: s.mods.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m)),
        }));
      },
      deleteMod: (id) => {
        const mod = get().mods.find((m) => m.id === id);
        if (mod) {
          get().pushLog(makeLog("warn", "system", `Deleted mod "${mod.name}" from Resources/${mod.folder}.`));
        }
        set((s) => ({ mods: s.mods.filter((m) => m.id !== id) }));
      },

      // ----- playit tunnel -----
      tunnelStatus: "disconnected",
      tunnelInfo: null,
      claimUrl: null,
      agentSecretSaved: false,

      startAgent: async () => {
        const state = get();
        if (state.tunnelStatus !== "disconnected" && state.tunnelStatus !== "error") return;
        set({ tunnelStatus: state.agentSecretSaved ? "tunnel_pending" : "needs_claim" });
        get().pushLog(makeLog("info", "system", "Starting playit-agent..."));

        // ===== Tauri path: spawn the REAL playit-agent binary =====
        if (bridge.isTauri()) {
          const result = await bridge.startPlayitAgentReal();
          if (!result.ok) {
            get().pushLog(makeLog("error", "system", `Failed to start playit agent: ${result.error ?? "unknown"}`));
            set({ tunnelStatus: "error" });
            return;
          }
          // Real claim URL (if needed) and tunnel info will arrive via Tauri events.
          // If the agent was already claimed (secret_saved), we go straight to tunnel_pending.
          set({ tunnelStatus: state.agentSecretSaved ? "tunnel_pending" : "needs_claim" });
          return;
        }

        // ===== Browser mock path =====
        const boot = streamAgentBoot({
          alreadyClaimed: state.agentSecretSaved,
          localPort: state.config.Port,
        });
        for await (const ev of boot) {
          get().pushLog(ev.log);
          if (ev.claimUrl) {
            set({ claimUrl: ev.claimUrl, tunnelStatus: "claiming" });
          }
          if (ev.done && state.agentSecretSaved) {
            const tunnel = generateTunnelInfo(state.config.Port);
            set({
              tunnelStatus: "tunnel_ready",
              tunnelInfo: tunnel,
            });
          }
        }
      },

      confirmClaimed: async () => {
        const state = get();
        if (state.tunnelStatus !== "claiming" && state.tunnelStatus !== "needs_claim") return;
        set({ tunnelStatus: "claiming" });

        // ===== Tauri path =====
        if (bridge.isTauri()) {
          await bridge.confirmPlayitClaimedReal();
          set({ agentSecretSaved: true, claimUrl: null, tunnelStatus: "tunnel_pending" });
          // Real tunnel info will arrive via the playit-tunnel-ready event.
          return;
        }

        // ===== Browser mock path =====
        const stream = streamAgentClaimed({ localPort: state.config.Port });
        for await (const ev of stream) {
          get().pushLog(ev.log);
          if (ev.claimUrl) set({ claimUrl: ev.claimUrl });
        }
        const tunnel = generateTunnelInfo(state.config.Port);
        set({
          tunnelStatus: "tunnel_ready",
          tunnelInfo: tunnel,
          agentSecretSaved: true,
          claimUrl: null,
        });
      },

      stopAgent: () => {
        get().pushLog(makeLog("warn", "system", "Stopping playit-agent..."));
        if (bridge.isTauri()) {
          void bridge.stopPlayitAgentReal();
        }
        set({
          tunnelStatus: "disconnected",
          tunnelInfo: null,
          claimUrl: null,
        });
      },

      resyncTunnelPort: async () => {
        const state = get();
        if (!state.tunnelInfo) return;
        get().pushLog(
          makeLog("info", "system", `Resyncing tunnel local port to ${state.config.Port} (was ${state.tunnelInfo.localPort})...`),
        );

        // ===== Tauri path =====
        if (bridge.isTauri()) {
          const result = await bridge.resyncTunnelPortReal(state.config.Port);
          if (result.ok) {
            set({ tunnelInfo: { ...state.tunnelInfo, localPort: state.config.Port } });
            get().pushLog(makeLog("success", "system", "Tunnel local port resync request sent. If it doesn't take effect, edit the tunnel on playit.gg."));
          } else {
            get().pushLog(makeLog("error", "system", `Resync failed: ${result.error ?? "unknown"}`));
          }
          return;
        }

        // ===== Browser mock path =====
        await new Promise((r) => setTimeout(r, 600));
        set({
          tunnelInfo: { ...state.tunnelInfo, localPort: state.config.Port },
        });
        get().pushLog(makeLog("success", "system", "Tunnel local port resynced. Players can now connect again."));
      },

      // ----- binaries -----
      beammpBinary: {
        installedVersion: null,
        latestVersion: null,
        installPath: "C:\\BeamMP-Server\\BeamMP-Server.exe",
        status: "not_installed",
        lastChecked: 0,
      },
      playitBinary: {
        installedVersion: null,
        latestVersion: null,
        installPath: "C:\\playit-agent\\playit.exe",
        status: "not_installed",
        lastChecked: 0,
      },

      checkForUpdates: async () => {
        set((s) => ({
          beammpBinary: { ...s.beammpBinary, status: "checking" },
          playitBinary: { ...s.playitBinary, status: "checking" },
        }));

        // ===== Tauri path: real GitHub API via Rust backend =====
        if (bridge.isTauri()) {
          const result = await bridge.checkForUpdatesReal();
          if (result) {
            set((s) => ({
              beammpBinary: {
                ...s.beammpBinary,
                latestVersion: result.beammp,
                status: s.beammpBinary.installedVersion ? "installed" : "not_installed",
                lastChecked: Date.now(),
              },
              playitBinary: {
                ...s.playitBinary,
                latestVersion: result.playit,
                status: s.playitBinary.installedVersion ? "installed" : "not_installed",
                lastChecked: Date.now(),
              },
            }));
            get().pushLog(
              makeLog("info", "system", `Update check complete. BeamMP latest: ${result.beammp ?? "unknown"} | playit latest: ${result.playit ?? "unknown"}.`),
            );
          }
          return;
        }

        // ===== Browser mock path: real GitHub API from the browser (CORS-allowed) =====
        const { fetchBeamMPLatestRelease, fetchPlayitLatestRelease } = await import("./github-api");
        const [beammp, playit] = await Promise.all([fetchBeamMPLatestRelease(), fetchPlayitLatestRelease()]);
        set((s) => ({
          beammpBinary: {
            ...s.beammpBinary,
            latestVersion: beammp?.tagName ?? null,
            status: s.beammpBinary.installedVersion ? "installed" : "not_installed",
            lastChecked: Date.now(),
          },
          playitBinary: {
            ...s.playitBinary,
            latestVersion: playit?.tagName ?? null,
            status: s.playitBinary.installedVersion ? "installed" : "not_installed",
            lastChecked: Date.now(),
          },
        }));
        get().pushLog(
          makeLog(
            "info",
            "system",
            `Update check complete. BeamMP latest: ${beammp?.tagName ?? "unknown"} | playit latest: ${playit?.tagName ?? "unknown"}.`,
          ),
        );
      },

      installBeamMP: async () => {
        set((s) => ({ beammpBinary: { ...s.beammpBinary, status: "downloading" } }));
        get().pushLog(makeLog("info", "system", "Downloading BeamMP-Server from GitHub releases..."));

        // ===== Tauri path: actually download + install the binary to disk =====
        if (bridge.isTauri()) {
          const result = await bridge.installBeamMpBinaryReal();
          if (result.ok) {
            const version = result.version ?? "unknown";
            set((s) => ({
              beammpBinary: {
                ...s.beammpBinary,
                installedVersion: version,
                latestVersion: version,
                status: "installed",
                lastChecked: Date.now(),
              },
            }));
            get().pushLog(makeLog("success", "system", `BeamMP-Server ${version} installed.`));
            get().completeWizardStep("install");
          } else {
            get().pushLog(makeLog("error", "system", `Install failed: ${result.error ?? "unknown"}`));
            set((s) => ({ beammpBinary: { ...s.beammpBinary, status: "failed" } }));
          }
          return;
        }

        // ===== Browser mock path =====
        await new Promise((r) => setTimeout(r, 1500));
        const { fetchBeamMPLatestRelease } = await import("./github-api");
        const release = await fetchBeamMPLatestRelease();
        const version = release?.tagName ?? "v3.3.0";
        set((s) => ({
          beammpBinary: {
            ...s.beammpBinary,
            installedVersion: version,
            latestVersion: version,
            status: "installed",
            lastChecked: Date.now(),
          },
        }));
        get().pushLog(makeLog("success", "system", `BeamMP-Server ${version} installed to ${get().beammpBinary.installPath}.`));
        get().completeWizardStep("install");
      },

      installPlayit: async () => {
        set((s) => ({ playitBinary: { ...s.playitBinary, status: "downloading" } }));
        get().pushLog(makeLog("info", "system", "Downloading playit-agent from GitHub releases..."));

        // ===== Tauri path: actually download + install the binary to disk =====
        if (bridge.isTauri()) {
          const result = await bridge.installPlayitBinaryReal();
          if (result.ok) {
            const version = result.version ?? "unknown";
            set((s) => ({
              playitBinary: {
                ...s.playitBinary,
                installedVersion: version,
                latestVersion: version,
                status: "installed",
                lastChecked: Date.now(),
              },
            }));
            get().pushLog(makeLog("success", "system", `playit-agent ${version} installed.`));
            get().completeWizardStep("playit-install");
          } else {
            get().pushLog(makeLog("error", "system", `Install failed: ${result.error ?? "unknown"}`));
            set((s) => ({ playitBinary: { ...s.playitBinary, status: "failed" } }));
          }
          return;
        }

        // ===== Browser mock path =====
        await new Promise((r) => setTimeout(r, 1500));
        const { fetchPlayitLatestRelease } = await import("./github-api");
        const release = await fetchPlayitLatestRelease();
        const version = release?.tagName ?? "v0.16.4";
        set((s) => ({
          playitBinary: {
            ...s.playitBinary,
            installedVersion: version,
            latestVersion: version,
            status: "installed",
            lastChecked: Date.now(),
          },
        }));
        get().pushLog(makeLog("success", "system", `playit-agent ${version} installed to ${get().playitBinary.installPath}.`));
        get().completeWizardStep("playit-install");
      },

      // ----- settings -----
      settings: defaultSettings,
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      // ----- wizard -----
      wizard: defaultWizard,
      setWizardStep: (step) => set((s) => ({ wizard: { ...s.wizard, step } })),
      completeWizardStep: (step) =>
        set((s) => ({
          wizard: {
            ...s.wizard,
            completed: s.wizard.completed.includes(step) ? s.wizard.completed : [...s.wizard.completed, step],
          },
        })),
      skipWizardStep: (step) =>
        set((s) => ({
          wizard: {
            ...s.wizard,
            skipped: s.wizard.skipped.includes(step) ? s.wizard.skipped : [...s.wizard.skipped, step],
          },
        })),
      resetWizard: () => set({ wizard: { ...defaultWizard } }),

      // ----- internal timers -----
      _idleTimer: null,
      _uptimeTimer: null,
      _playerTimer: null,
    }),
    {
      name: "beammp-hosting-app",
      storage: createJSONStorage(() => localStorage),
      // Don't persist transient runtime state
      partialize: (s) => ({
        config: s.config,
        rawConfigText: s.rawConfigText,
        mods: s.mods,
        agentSecretSaved: s.agentSecretSaved,
        beammpBinary: s.beammpBinary,
        playitBinary: s.playitBinary,
        settings: s.settings,
        wizard: s.wizard,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatUptime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export { formatBytes };
