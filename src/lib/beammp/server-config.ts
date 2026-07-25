// ServerConfig.toml schema, defaults, validation, and TOML serialization.
// BeamMP-Server generates ServerConfig.toml on first run with a [General] section.
// We deliberately preserve any unknown sections/keys when round-tripping.

import * as TOML from "@iarna/toml";
import type { ServerConfig } from "./types";

export const DEFAULT_SERVER_CONFIG: ServerConfig = {
  Name: "My BeamMP Server",
  Port: 30814,
  AuthKey: "",
  Private: true,
  MaxPlayers: 10,
  MaxCars: 1,
  Map: "/levels/gridmap_v2/info.json",
  Description: "My server",
  Tags: "Freeroam,Modded",
  AllowGuests: false,
  LogChat: false,
  Debug: false,
  InformationPacket: true,
  ResourceFolder: "Resources",
};

// Known General section keys (so we know what is "ours" vs. plugin-added)
export const GENERAL_SECTION_KEYS = new Set<keyof ServerConfig>([
  "Name",
  "Port",
  "AuthKey",
  "Private",
  "MaxPlayers",
  "MaxCars",
  "Map",
  "Description",
  "Tags",
  "AllowGuests",
  "LogChat",
  "Debug",
  "InformationPacket",
  "ResourceFolder",
]);

export function defaultServerConfig(): ServerConfig {
  return { ...DEFAULT_SERVER_CONFIG };
}

export interface ParsedConfigFile {
  general: ServerConfig;
  // Raw representation of every other table in the file (preserved verbatim).
  // Keys are section names like "Plugins" or "Mods".
  otherSections: Record<string, unknown>;
  // Original raw text, kept for "raw" editing mode and best-effort format preservation.
  rawText: string;
}

/**
 * Parse a ServerConfig.toml string into structured data, preserving unknown sections.
 * If parsing fails, returns a default config + the raw text so the user can edit raw.
 */
export function parseServerConfigFile(raw: string): ParsedConfigFile {
  const result: ParsedConfigFile = {
    general: defaultServerConfig(),
    otherSections: {},
    rawText: raw,
  };
  try {
    const parsed = TOML.parse(raw) as Record<string, unknown>;
    const general = (parsed.General ?? {}) as Record<string, unknown>;
    for (const key of GENERAL_SECTION_KEYS) {
      const v = general[key as string];
      if (v !== undefined) {
        // Coerce types defensively in case of malformed user edits.
        (result.general as Record<string, unknown>)[key] = coerceValue(v, key);
      }
    }
    for (const [sectionName, sectionValue] of Object.entries(parsed)) {
      if (sectionName !== "General") {
        result.otherSections[sectionName] = sectionValue;
      }
    }
  } catch {
    // Keep defaults + raw text
  }
  return result;
}

function coerceValue(v: unknown, key: keyof ServerConfig): unknown {
  switch (key) {
    case "Port":
    case "MaxPlayers":
    case "MaxCars":
      return typeof v === "number" ? v : Number(v) || 0;
    case "Private":
    case "AllowGuests":
    case "LogChat":
    case "Debug":
    case "InformationPacket":
      return typeof v === "boolean" ? v : String(v) === "true";
    default:
      return typeof v === "string" ? v : String(v ?? "");
  }
}

/**
 * Serialize a ServerConfig back to TOML, preserving any unknown sections.
 * Output is deterministic and human-readable; comments are not preserved
 * (BeamMP regenerates the file without comments anyway on first run).
 */
export function serializeServerConfig(
  general: ServerConfig,
  otherSections: Record<string, unknown> = {},
): string {
  const generalOrdered: Record<string, unknown> = {};
  // Emit in the canonical order BeamMP uses.
  for (const key of GENERAL_SECTION_KEYS) {
    generalOrdered[key as string] = general[key];
  }
  const root: Record<string, unknown> = {
    General: generalOrdered,
    ...otherSections,
  };
  return TOML.stringify(root);
}

/**
 * Validate a ServerConfig. Returns a list of human-readable problems.
 * AuthKey is mandatory — BeamMP refuses to start without one.
 */
export interface ValidationIssue {
  field: keyof ServerConfig | "_general";
  severity: "error" | "warn";
  message: string;
}

export function validateServerConfig(c: ServerConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!c.AuthKey || c.AuthKey.trim().length < 8) {
    issues.push({
      field: "AuthKey",
      severity: "error",
      message:
        "AuthKey is required. BeamMP-Server refuses to start without a valid key. Get one at https://keymaster.beammp.com/",
    });
  }
  if (c.Port < 1 || c.Port > 65535) {
    issues.push({
      field: "Port",
      severity: "error",
      message: "Port must be between 1 and 65535. Default BeamMP port is 30814.",
    });
  }
  if (c.MaxPlayers < 1 || c.MaxPlayers > 200) {
    issues.push({
      field: "MaxPlayers",
      severity: "warn",
      message: "MaxPlayers should typically be between 1 and 200.",
    });
  }
  if (c.MaxCars < 0 || c.MaxCars > 10) {
    issues.push({
      field: "MaxCars",
      severity: "warn",
      message: "MaxCars is per-player; values above 10 are unusual and may impact performance.",
    });
  }
  if (!c.Name || c.Name.trim().length === 0) {
    issues.push({
      field: "Name",
      severity: "warn",
      message: "Server Name is empty — players will see a blank name in the server list.",
    });
  }
  return issues;
}

/**
 * Generate the BEAMMP_<SETTING> environment variable map for the child process.
 * BeamMP reads env vars of this form and they override the TOML file values.
 */
export function buildEnvOverrides(c: ServerConfig): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of GENERAL_SECTION_KEYS) {
    const v = c[key];
    env[`BEAMMP_${key.toUpperCase()}`] = String(v);
  }
  return env;
}
