"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Globe,
  Play,
  Square,
  Copy,
  ExternalLink,
  AlertTriangle,
  Check,
  Link2,
  ShieldCheck,
  RefreshCw,
  QrCode,
  Network,
  Info,
} from "lucide-react";
import { useBeamMPStore } from "@/lib/beammp/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { TunnelStatus } from "@/lib/beammp/types";
import * as bridge from "@/lib/beammp/tauri-bridge";

export function TunnelPanel() {
  const tunnelStatus = useBeamMPStore((s) => s.tunnelStatus);
  const tunnelInfo = useBeamMPStore((s) => s.tunnelInfo);
  const claimUrl = useBeamMPStore((s) => s.claimUrl);
  const agentSecretSaved = useBeamMPStore((s) => s.agentSecretSaved);
  const config = useBeamMPStore((s) => s.config);
  const playitBinary = useBeamMPStore((s) => s.playitBinary);
  const settings = useBeamMPStore((s) => s.settings);
  const setSettings = useBeamMPStore((s) => s.setSettings);

  // When running inside Tauri, the claim URL is REAL (printed by the actual playit-agent binary).
  // When in a browser, it's simulated.
  const isRealTauri = bridge.isTauri();

  const startAgent = useBeamMPStore((s) => s.startAgent);
  const confirmClaimed = useBeamMPStore((s) => s.confirmClaimed);
  const stopAgent = useBeamMPStore((s) => s.stopAgent);
  const resyncTunnelPort = useBeamMPStore((s) => s.resyncTunnelPort);

  const [showQr, setShowQr] = useState(false);

  const portMismatch = !!tunnelInfo && tunnelInfo.localPort !== config.Port;

  return (
    <div className="space-y-6">
      {/* Hero status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4" /> playit.gg Tunnel
              </CardTitle>
              <CardDescription>
                Expose your BeamMP server to the internet without router port-forwarding.
              </CardDescription>
            </div>
            <TunnelStatusBadge status={tunnelStatus} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Top-level actions */}
          <div className="flex flex-wrap gap-2">
            {tunnelStatus === "disconnected" || tunnelStatus === "error" ? (
              <Button onClick={() => startAgent()} disabled={!playitBinary.installedVersion}>
                <Play className="mr-2 h-4 w-4" /> Start playit Agent
              </Button>
            ) : (
              <Button variant="destructive" onClick={() => stopAgent()}>
                <Square className="mr-2 h-4 w-4" /> Stop Agent
              </Button>
            )}
            {tunnelInfo && (
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(tunnelInfo.publicAddress);
                  toast.success("Public address copied");
                }}
              >
                <Copy className="mr-2 h-4 w-4" /> Copy public address
              </Button>
            )}
          </div>

          {!playitBinary.installedVersion && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                playit-agent binary is not installed yet. Visit <strong>Settings → Install playit-agent</strong> first.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Claim URL flow */}
      {(tunnelStatus === "needs_claim" || tunnelStatus === "claiming") && claimUrl && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4" /> Authorize Your playit.gg Agent
            </CardTitle>
            <CardDescription>
              Open the claim URL below in your browser and sign in to your playit.gg account to link this agent.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Simulation notice — only show in browser mode. In Tauri, the URL is real. */}
            {!isRealTauri && (
            <div className="rounded-md border border-sky-500/40 bg-sky-500/10 p-3 text-xs text-sky-700 dark:text-sky-300">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="space-y-1.5">
                  <p className="font-medium">Prototype notice</p>
                  <p>
                    This claim URL is <strong>simulated</strong>. Because this prototype runs a mock playit agent (no real binary),
                    the URL below looks realistic but is not registered with playit.gg&apos;s servers — opening it will show
                    &quot;Invalid claim code&quot; on playit.gg.
                  </p>
                  <p>
                    To continue the prototype flow, just click <strong>&quot;I&apos;ve authorized — continue&quot;</strong> below.
                    In a real Tauri-wrapped build, this URL would be printed by the actual <code>playit-agent</code> binary
                    and would link your real playit.gg account.
                  </p>
                </div>
              </div>
            </div>
            )}
            {isRealTauri && (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="space-y-1.5">
                  <p className="font-medium">Real playit-agent running</p>
                  <p>
                    This claim URL was printed by the actual <code>playit-agent</code> binary running on your machine.
                    Open it in your browser, sign in to playit.gg, and approve the new agent to link it to your account.
                  </p>
                </div>
              </div>
            </div>
            )}

            <div className="rounded-md border bg-card p-4">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                Claim URL{!isRealTauri && " (simulated)"}
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate text-sm font-mono text-amber-700 dark:text-amber-300">{claimUrl}</code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(claimUrl);
                    toast.success("Claim URL copied");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild variant={isRealTauri ? "default" : "outline"}>
                <a href={claimUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> Open in browser{!isRealTauri && " (will show invalid)"}
                </a>
              </Button>
              <Button variant="outline" onClick={() => setShowQr((s) => !s)}>
                <QrCode className="mr-2 h-4 w-4" /> {showQr ? "Hide" : "Show"} QR code
              </Button>
            </div>

            {showQr && (
              <div className="rounded-md border bg-white p-4 flex justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(claimUrl)}`}
                  alt="Claim URL QR code"
                  width={240}
                  height={240}
                />
              </div>
            )}

            <Separator />

            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-sm font-medium mb-1">{isRealTauri ? "After you authorize in the browser:" : "Continue to the next step"}</p>
              <p className="text-xs text-muted-foreground mb-3">
                {isRealTauri
                  ? "The agent will receive its secret key and automatically connect. Once you see the \"Agent authorized\" success message in the playit.gg dashboard, click the button below."
                  : "In the prototype, just click the button below — the mock agent will simulate receiving its secret key and connecting to the playit.gg relay. In a real Tauri build, you'd click this only after seeing the \"Agent authorized\" success message in the playit.gg dashboard."}
              </p>
              <Button onClick={() => confirmClaimed()}>
                <Check className="mr-2 h-4 w-4" /> I&apos;ve authorized — continue
              </Button>
            </div>

            <div className="rounded-md border border-sky-500/40 bg-sky-500/10 p-3 text-xs text-sky-700 dark:text-sky-300 flex items-start gap-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                <strong>Why this step is needed:</strong> the first time you run a playit agent on a new machine, playit needs to verify you own the playit.gg account that will host the tunnel. After this one-time link, the agent secret is saved locally and you won&apos;t need to re-claim on future launches.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active tunnel info */}
      {tunnelInfo && tunnelStatus === "tunnel_ready" && (
        <Card className="border-emerald-500/40 bg-emerald-500/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Tunnel Active
            </CardTitle>
            <CardDescription>Your BeamMP server is now reachable from the public internet.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoTile label="Public Address" value={tunnelInfo.publicAddress} mono highlight />
              <InfoTile label="Tunnel Type" value={tunnelInfo.tunnelType.toUpperCase()} />
              <InfoTile label="Local Target" value={`127.0.0.1:${tunnelInfo.localPort}`} mono />
              <InfoTile label="Region" value={tunnelInfo.region} />
              <InfoTile label="Tunnel ID" value={tunnelInfo.tunnelId} mono />
              <InfoTile label="Agent Secret" value={agentSecretSaved ? "Saved locally ✓" : "Not saved"} />
            </div>

            <div className="rounded-md border bg-card p-4">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Share with players</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate text-sm font-mono text-emerald-700 dark:text-emerald-300">
                  {tunnelInfo.publicAddress}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(tunnelInfo.publicAddress);
                    toast.success("Public address copied");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Players enter this address in BeamNG.drive → Multiplayer → Direct Connect.
              </p>
            </div>

            {portMismatch && (
              <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-700 dark:text-red-300">Port mismatch detected</p>
                    <p className="text-xs text-red-700/80 dark:text-red-300/80 mt-1">
                      Your BeamMP server is configured to listen on <strong>{config.Port}</strong>, but the
                      tunnel is forwarding traffic to <strong>{tunnelInfo.localPort}</strong>. Players will not be able to connect.
                    </p>
                    <Button size="sm" variant="outline" className="mt-2 h-7" onClick={() => resyncTunnelPort()}>
                      <RefreshCw className="mr-1.5 h-3 w-3" /> Resync tunnel to port {config.Port}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Status flow */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Network className="h-4 w-4" /> How It Works
          </CardTitle>
          <CardDescription>The 4-step lifecycle of your playit.gg tunnel</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            <StepRow
              n={1}
              title="Start agent"
              desc="The app launches the playit-agent binary in the background. On first run it generates an agent identity and a claim URL."
              done={tunnelStatus !== "disconnected"}
            />
            <StepRow
              n={2}
              title="Claim the agent"
              desc="Open the claim URL, sign in to playit.gg, and approve the new agent. The agent receives a permanent secret key, saved locally."
              done={agentSecretSaved}
            />
            <StepRow
              n={3}
              title="Tunnel created"
              desc="A TCP+UDP tunnel is allocated pointing at 127.0.0.1:<BeamMP port>. playit assigns a public address like something.ply.gg:12345."
              done={tunnelStatus === "tunnel_ready"}
            />
            <StepRow
              n={4}
              title="Players connect"
              desc="Players use the public address in BeamNG.drive's Direct Connect dialog. Traffic flows: player → playit relay → your agent → 127.0.0.1:port → BeamMP-Server."
              done={tunnelStatus === "tunnel_ready"}
            />
          </ol>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tunnel Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">Auto-start tunnel with server</div>
              <div className="text-[11px] text-muted-foreground">
                When you click Start Server, the playit agent starts automatically. Stopping the server also stops the tunnel.
              </div>
            </div>
            <Switch
              checked={settings.autoStartTunnelWithServer}
              onCheckedChange={(v) => setSettings({ autoStartTunnelWithServer: v })}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">BeamMP Port (from config)</label>
              <Input value={config.Port} disabled className="font-mono" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Tunnel Local Port</label>
              <Input
                value={tunnelInfo?.localPort ?? "—"}
                disabled
                className={cn("font-mono", portMismatch && "border-red-500/50 text-red-600 dark:text-red-400")}
              />
            </div>
          </div>

          {portMismatch && (
            <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3" />
              Ports differ. Click &quot;Resync&quot; in the active tunnel card above to fix.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TunnelStatusBadge({ status }: { status: TunnelStatus }) {
  const map: Record<TunnelStatus, { color: string; label: string }> = {
    disconnected: { color: "bg-muted text-muted-foreground", label: "Disconnected" },
    needs_claim: { color: "bg-amber-500/15 text-amber-600 dark:text-amber-400", label: "Needs claim" },
    claiming: { color: "bg-amber-500/15 text-amber-600 dark:text-amber-400", label: "Authorizing" },
    connected: { color: "bg-sky-500/15 text-sky-600 dark:text-sky-400", label: "Connected" },
    tunnel_pending: { color: "bg-amber-500/15 text-amber-600 dark:text-amber-400", label: "Creating tunnel" },
    tunnel_ready: { color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", label: "Active" },
    error: { color: "bg-red-500/15 text-red-600 dark:text-red-400", label: "Error" },
  };
  const cfg = map[status];
  return (
    <Badge variant="outline" className={cn("gap-1.5", cfg.color)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {cfg.label}
    </Badge>
  );
}

function InfoTile({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-md border bg-card/50 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-sm font-medium truncate", mono && "font-mono", highlight && "text-emerald-600 dark:text-emerald-400")}>
        {value}
      </div>
    </div>
  );
}

function StepRow({ n, title, desc, done }: { n: number; title: string; desc: string; done: boolean }) {
  return (
    <li className="flex gap-3">
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
          done ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "border-border bg-muted text-muted-foreground",
        )}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : n}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
      </div>
    </li>
  );
}
