// Mock playit.gg agent process.
// In a real build this module would download and spawn the playit-agent binary,
// capture its stdout for the claim URL, then poll its local IPC API for tunnel status.
// Here we simulate the full lifecycle so the UI is fully interactive.

import type { LogLine, TunnelInfo } from "./types";
import { makeLog } from "./beammp-server-mock";

// Generate a realistic-looking playit claim URL.
// Real ones look like https://playit.gg/claim/XXXX where XXXX is a long token.
export function generateClaimUrl(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return `https://playit.gg/claim/${token}`;
}

const PLAYIT_REGIONS = ["US-East", "US-West", "EU-West", "EU-Central", "AP-Singapore", "AP-Tokyo"];
const PLAYIT_ANIMALS_A = ["abiding", "accelerating", "ambitious", "ancient", "arctic", "arrogant", "atomic", "austere"];
const PLAYIT_ANIMALS_B = ["otter", "orca", "ostrich", "owl", "ox", "octopus", "okapi", "orangutan"];
const PLAYIT_MODIFIERS = ["auto", "ball", "bite", "bounce", "blade", "branch", "breeze", "burn"];

export function generateTunnelInfo(localPort: number): TunnelInfo {
  const a = PLAYIT_ANIMALS_A[Math.floor(Math.random() * PLAYIT_ANIMALS_A.length)];
  const b = PLAYIT_ANIMALS_B[Math.floor(Math.random() * PLAYIT_ANIMALS_B.length)];
  const m = PLAYIT_MODIFIERS[Math.floor(Math.random() * PLAYIT_MODIFIERS.length)];
  const subdomain = `${a}-${b}-${m}`;
  const region = PLAYIT_REGIONS[Math.floor(Math.random() * PLAYIT_REGIONS.length)];
  // playit.gg assigns a random external port for each tunnel.
  const externalPort = 10000 + Math.floor(Math.random() * 50000);
  return {
    publicAddress: `${subdomain}.ply.gg:${externalPort}`,
    localPort,
    tunnelType: "tcp+udp",
    tunnelId: `tun_${Math.random().toString(36).slice(2, 12)}`,
    region,
  };
}

export interface AgentBootEvent {
  log: LogLine;
  done: boolean;
  claimUrl?: string;
}

/**
 * Simulated playit-agent boot sequence.
 * Real playit-agent prints a claim URL on first run after the user has not yet linked the agent.
 */
export async function* streamAgentBoot(opts: {
  alreadyClaimed: boolean;
  localPort: number;
}): AsyncGenerator<AgentBootEvent, void, unknown> {
  yield {
    log: makeLog("info", "agent", "Starting playit-agent v0.16.4..."),
    done: false,
  };
  await sleep(300);
  yield {
    log: makeLog("info", "agent", "Loading agent secret from config.toml..."),
    done: false,
  };
  await sleep(250);

  if (!opts.alreadyClaimed) {
    const claimUrl = generateClaimUrl();
    yield {
      log: makeLog("warn", "agent", "Agent is not yet linked to a playit.gg account."),
      done: false,
    };
    await sleep(200);
    yield {
      log: makeLog("info", "agent", `Open this URL in your browser to claim this agent:`),
      done: false,
    };
    await sleep(150);
    yield {
      log: makeLog("success", "agent", claimUrl),
      done: false,
      claimUrl,
    };
    await sleep(200);
    yield {
      log: makeLog("info", "agent", "Waiting for you to authorize the agent in your browser..."),
      done: false,
    };
    return;
  }

  // Already claimed path: connect directly.
  yield { log: makeLog("info", "agent", "Agent secret loaded. Connecting to playit.gg tunnel network..."), done: false };
  await sleep(700);
  yield { log: makeLog("success", "agent", "Connected to playit.gg relay."), done: false };
  await sleep(300);
  yield { log: makeLog("info", "agent", `Looking up existing tunnel for local port ${opts.localPort}...`), done: false };
  await sleep(500);
  const tunnel = generateTunnelInfo(opts.localPort);
  yield { log: makeLog("success", "agent", `Tunnel active: ${tunnel.publicAddress} -> 127.0.0.1:${tunnel.localPort} (${tunnel.tunnelType}, ${tunnel.region})`), done: false };
  yield { log: makeLog("info", "agent", `Tunnel ID: ${tunnel.tunnelId}`), done: true };
}

export async function* streamAgentClaimed(opts: { localPort: number }): AsyncGenerator<AgentBootEvent, void, unknown> {
  yield { log: makeLog("success", "agent", "Agent authorized successfully. Secret saved for next launch."), done: false };
  await sleep(400);
  yield { log: makeLog("info", "agent", "Connecting to playit.gg relay..."), done: false };
  await sleep(700);
  yield { log: makeLog("success", "agent", "Connected to playit.gg relay."), done: false };
  await sleep(300);
  yield { log: makeLog("info", "agent", `Creating TCP+UDP tunnel to 127.0.0.1:${opts.localPort}...`), done: false };
  await sleep(900);
  const tunnel = generateTunnelInfo(opts.localPort);
  yield { log: makeLog("success", "agent", `Tunnel active: ${tunnel.publicAddress} -> 127.0.0.1:${tunnel.localPort} (${tunnel.tunnelType}, ${tunnel.region})`), done: false };
  yield { log: makeLog("info", "agent", `Tunnel ID: ${tunnel.tunnelId}`), done: true };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
