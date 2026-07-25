// Core domain types for the BeamMP server hosting app

export type ServerStatus =
  | "stopped"
  | "starting"
  | "running"
  | "stopping"
  | "crashed";

export type TunnelStatus =
  | "disconnected"
  | "needs_claim"
  | "claiming"
  | "connected"
  | "tunnel_pending"
  | "tunnel_ready"
  | "error";

export type InstallStatus =
  | "not_installed"
  | "checking"
  | "downloading"
  | "installed"
  | "update_available"
  | "failed";

export interface LogLine {
  id: string;
  ts: number;
  level: "info" | "warn" | "error" | "cmd" | "success";
  source: "server" | "agent" | "system";
  text: string;
}

export interface ServerConfig {
  // [General]
  Name: string;
  Port: number;
  AuthKey: string;
  Private: boolean;
  MaxPlayers: number;
  MaxCars: number;
  Map: string;
  Description: string;
  Tags: string;
  AllowGuests: boolean;
  LogChat: boolean;
  Debug: boolean;
  InformationPacket: boolean;
  ResourceFolder: string;
}

export interface ModEntry {
  id: string;
  name: string;
  sizeBytes: number;
  folder: "Client" | "Server";
  enabled: boolean;
  addedAt: number;
}

export interface PlayerInfo {
  name: string;
  cars: number;
  pingMs: number;
  connectedAt: number;
}

export interface TunnelInfo {
  publicAddress: string; // e.g. "abiding-otter-auto.ply.gg:12345"
  localPort: number; // matches BeamMP Port
  tunnelType: "tcp+udp";
  tunnelId: string;
  region: string;
}

export interface BinaryInfo {
  installedVersion: string | null;
  latestVersion: string | null;
  installPath: string;
  status: InstallStatus;
  lastChecked: number;
}

export interface AppSettings {
  beammpInstallDir: string;
  playitInstallDir: string;
  autoStartTunnelWithServer: boolean;
  autoRestartOnCrash: boolean;
  restartBackoffMs: number;
  minimizeToTray: boolean;
  envOverrideEnabled: boolean;
}

export type WizardStepId =
  | "welcome"
  | "install"
  | "authkey"
  | "server-config"
  | "playit-install"
  | "playit-claim"
  | "tunnel-create"
  | "done";

export interface WizardState {
  step: WizardStepId;
  completed: WizardStepId[];
  skipped: WizardStepId[];
}
