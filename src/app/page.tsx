"use client";

import { useEffect } from "react";
import { AppShell } from "@/components/beammp/app-shell";
import { Dashboard } from "@/components/beammp/dashboard";
import { ServerPanel } from "@/components/beammp/server-panel";
import { ConfigEditor } from "@/components/beammp/config-editor";
import { ModsPanel } from "@/components/beammp/mods-panel";
import { TunnelPanel } from "@/components/beammp/tunnel-panel";
import { JoinInfo } from "@/components/beammp/join-info";
import { SetupWizard } from "@/components/beammp/setup-wizard";
import { SettingsPanel } from "@/components/beammp/settings-panel";
import { useBeamMPStore } from "@/lib/beammp/store";
import * as bridge from "@/lib/beammp/tauri-bridge";

export default function Home() {
  const activeView = useBeamMPStore((s) => s.activeView);
  const hydrated = useBeamMPStore((s) => s.hydrated);
  const pushLog = useBeamMPStore((s) => s.pushLog);
  const setConfig = useBeamMPStore((s) => s.setConfig);
  const setSettings = useBeamMPStore((s) => s.setSettings);
  const setHydrated = useBeamMPStore((s) => s.setHydrated);

  // On mount: register Tauri event handlers and load real config from disk (if in Tauri).
  useEffect(() => {
    if (!hydrated) return;

    // Wire up event handlers — these only fire when running inside Tauri.
    bridge.setBridgeEventHandlers({
      onBeamMpLog: (line) => useBeamMPStore.getState().pushLog(line),
      onPlayitLog: (line) => useBeamMPStore.getState().pushLog(line),
      onBeamMpStatus: (status) => {
        const s = useBeamMPStore.getState();
        if (status.running) {
          useBeamMPStore.setState({
            serverStatus: "running",
            serverPid: status.pid,
            autoRestartAttempts: status.restart_attempts,
          });
        } else {
          useBeamMPStore.setState({
            serverStatus: s.lastCrashReason ? "crashed" : "stopped",
            serverPid: null,
            serverStartedAt: null,
            serverUptimeMs: 0,
            players: [],
          });
        }
      },
      onPlayitClaimUrl: (url) => {
        useBeamMPStore.setState({ claimUrl: url, tunnelStatus: "claiming" });
      },
      onPlayitTunnelReady: () => {
        // The background poller in Rust found a tunnel. Fetch the latest status.
        void bridge.getPlayitStatusReal().then((status) => {
          if (status?.tunnel) {
            useBeamMPStore.setState({
              tunnelStatus: "tunnel_ready",
              tunnelInfo: status.tunnel,
              agentSecretSaved: status.secret_saved,
              claimUrl: null,
            });
          }
        });
      },
      onDownloadProgress: (p) => {
        // Optional: surface download progress in the log view.
        if (p.pct === 100) {
          useBeamMPStore.getState().pushLog({
            id: `dl-${Date.now()}`,
            ts: Date.now(),
            level: "success",
            source: "system",
            text: `Downloaded ${p.label} (${(p.total / 1024 / 1024).toFixed(1)} MB)`,
          });
        }
      },
    });

    // If running in Tauri, load the real ServerConfig.toml + settings from disk.
    if (bridge.isTauri()) {
      pushLog({
        id: `init-${Date.now()}`,
        ts: Date.now(),
        level: "info",
        source: "system",
        text: "Running in Tauri desktop mode — real process management active.",
      });

      void bridge.loadServerConfigFromDisk().then((cfg) => {
        if (cfg) {
          setConfig(cfg);
          pushLog({
            id: `cfg-${Date.now()}`,
            ts: Date.now(),
            level: "success",
            source: "system",
            text: "Loaded ServerConfig.toml from disk.",
          });
        }
      });

      void bridge.loadAppSettingsFromDisk().then((settings) => {
        if (settings) {
          setSettings({
            beammpInstallDir: settings.beammp_install_dir,
            playitInstallDir: settings.playit_install_dir,
            autoStartTunnelWithServer: settings.auto_start_tunnel_with_server,
            autoRestartOnCrash: settings.auto_restart_on_crash,
            restartBackoffMs: settings.restart_backoff_ms,
            minimizeToTray: settings.minimize_to_tray,
            envOverrideEnabled: settings.env_override_enabled,
          });
        }
      });

      // Also fetch the current playit status in case the agent is already running from a previous session.
      void bridge.getPlayitStatusReal().then((status) => {
        if (status?.connected) {
          useBeamMPStore.setState({
            tunnelStatus: status.tunnel ? "tunnel_ready" : "tunnel_pending",
            tunnelInfo: status.tunnel,
            agentSecretSaved: status.secret_saved,
            claimUrl: status.claim_url,
          });
        }
      });
    }
  }, [hydrated, pushLog, setConfig, setSettings]);

  // Avoid hydration mismatch — render a minimal placeholder until hydrated.
  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-pulse rounded-lg bg-primary/20" />
          <p className="mt-3 text-sm text-muted-foreground">Loading BeamMP Host…</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      {activeView === "dashboard" && <Dashboard />}
      {activeView === "server" && <ServerPanel />}
      {activeView === "config" && <ConfigEditor />}
      {activeView === "mods" && <ModsPanel />}
      {activeView === "tunnel" && <TunnelPanel />}
      {activeView === "join" && <JoinInfo />}
      {activeView === "wizard" && <SetupWizard />}
      {activeView === "settings" && <SettingsPanel />}
    </AppShell>
  );
}
