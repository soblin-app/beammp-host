"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  Square,
  RotateCcw,
  Globe,
  Copy,
  Users,
  Clock,
  Cpu,
  HardDrive,
  ExternalLink,
  Wand2,
} from "lucide-react";
import { useBeamMPStore, formatUptime } from "@/lib/beammp/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { findMapByValue } from "@/lib/beammp/maps";

export function Dashboard() {
  const serverStatus = useBeamMPStore((s) => s.serverStatus);
  const tunnelStatus = useBeamMPStore((s) => s.tunnelStatus);
  const tunnelInfo = useBeamMPStore((s) => s.tunnelInfo);
  const config = useBeamMPStore((s) => s.config);
  const players = useBeamMPStore((s) => s.players);
  const serverUptimeMs = useBeamMPStore((s) => s.serverUptimeMs);
  const serverStartedAt = useBeamMPStore((s) => s.serverStartedAt);
  const beammpBinary = useBeamMPStore((s) => s.beammpBinary);
  const playitBinary = useBeamMPStore((s) => s.playitBinary);
  const wizard = useBeamMPStore((s) => s.wizard);
  const startServer = useBeamMPStore((s) => s.startServer);
  const stopServer = useBeamMPStore((s) => s.stopServer);
  const restartServer = useBeamMPStore((s) => s.restartServer);
  const startAgent = useBeamMPStore((s) => s.startAgent);
  const stopAgent = useBeamMPStore((s) => s.stopAgent);
  const setActiveView = useBeamMPStore((s) => s.setActiveView);

  const wizardDone = wizard.completed.length >= 4 || wizard.skipped.length >= 4;
  const mapLabel = findMapByValue(config.Map)?.label ?? config.Map;
  const portMismatch = tunnelInfo && tunnelInfo.localPort !== config.Port;

  return (
    <div className="space-y-6">
      {/* Hero status row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatusCard
          title="BeamMP Server"
          status={serverStatus}
          icon={Cpu}
          subtitle={serverStatus === "running" ? `Online · ${formatUptime(serverUptimeMs)}` : serverStatus === "starting" ? "Booting up..." : serverStatus === "crashed" ? "Crashed — check logs" : "Stopped"}
          accent={serverStatus === "running" ? "emerald" : serverStatus === "crashed" ? "red" : serverStatus === "starting" || serverStatus === "stopping" ? "amber" : "muted"}
        />
        <StatusCard
          title="playit.gg Tunnel"
          status={tunnelStatus}
          icon={Globe}
          subtitle={tunnelStatus === "tunnel_ready" ? (tunnelInfo?.publicAddress ?? "Connected") : tunnelStatus === "disconnected" ? "Not started" : "In progress..."}
          accent={tunnelStatus === "tunnel_ready" ? "emerald" : tunnelStatus === "error" ? "red" : tunnelStatus === "disconnected" ? "muted" : "amber"}
        />
        <StatusCard
          title="Players Online"
          status={`${players.length} / ${config.MaxPlayers}`}
          icon={Users}
          subtitle={players.length > 0 ? players.map((p) => p.name).join(", ") : "No players connected"}
          accent={players.length > 0 ? "emerald" : "muted"}
        />
        <StatusCard
          title="BeamMP Binaries"
          icon={HardDrive}
          status={beammpBinary.installedVersion && playitBinary.installedVersion ? "Ready" : "Missing"}
          subtitle={`Server: ${beammpBinary.installedVersion ?? "not installed"} · Agent: ${playitBinary.installedVersion ?? "not installed"}`}
          accent={beammpBinary.installedVersion && playitBinary.installedVersion ? "emerald" : "amber"}
        />
      </div>

      {/* Wizard nudge */}
      {!wizardDone && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15">
              <Wand2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">First-time setup recommended</p>
              <p className="text-xs text-muted-foreground">
                Run the setup wizard to install BeamMP-Server, configure your AuthKey, and create your playit.gg tunnel in one guided flow.
              </p>
            </div>
            <Button size="sm" onClick={() => setActiveView("wizard")}>
              <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Open Wizard
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
          <CardDescription>Common operations to get your server online</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {serverStatus === "running" ? (
            <>
              <Button variant="destructive" onClick={() => stopServer()}>
                <Square className="mr-2 h-4 w-4" /> Stop Server
              </Button>
              <Button variant="outline" onClick={() => restartServer()}>
                <RotateCcw className="mr-2 h-4 w-4" /> Restart
              </Button>
            </>
          ) : (
            <Button onClick={() => startServer()}>
              <Play className="mr-2 h-4 w-4" /> Start Server
            </Button>
          )}
          {tunnelStatus === "tunnel_ready" ? (
            <Button variant="outline" onClick={() => stopAgent()}>
              <Globe className="mr-2 h-4 w-4" /> Stop Tunnel
            </Button>
          ) : (
            <Button variant="outline" onClick={() => startAgent()} disabled={tunnelStatus !== "disconnected" && tunnelStatus !== "error"}>
              <Globe className="mr-2 h-4 w-4" /> Start Tunnel
            </Button>
          )}
          <Button variant="outline" onClick={() => setActiveView("config")}>
            Edit Config
          </Button>
          <Button variant="outline" onClick={() => setActiveView("join")}>
            Copy Join Info
          </Button>
        </CardContent>
      </Card>

      {/* Connect info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connect Information</CardTitle>
          <CardDescription>What your players need to join</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow label="Server Name" value={config.Name} />
            <InfoRow label="Map" value={mapLabel} />
            <InfoRow label="Local Port" value={`${config.Port} (TCP+UDP)`} />
            <InfoRow label="Privacy" value={config.Private ? "Private (unlisted)" : "Public (listed)"} />
            <InfoRow
              label="Public Address"
              value={tunnelInfo?.publicAddress ?? "Tunnel not active"}
              highlight={!!tunnelInfo}
            />
            <InfoRow
              label="Server Uptime"
              value={serverStartedAt ? formatUptime(serverUptimeMs) : "—"}
            />
          </div>

          {portMismatch && (
            <div className="flex items-start gap-3 rounded-md border border-red-500/40 bg-red-500/10 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-700 dark:text-red-300">Port mismatch detected</p>
                <p className="text-xs text-red-700/80 dark:text-red-300/80">
                  BeamMP is set to port <strong>{config.Port}</strong> but your tunnel is pointing at{" "}
                  <strong>{tunnelInfo.localPort}</strong>. Players will not be able to connect.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 h-7"
                  onClick={() => setActiveView("tunnel")}
                >
                  Fix in Tunnel panel
                </Button>
              </div>
            </div>
          )}

          {tunnelInfo && (
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => {
                navigator.clipboard.writeText(tunnelInfo.publicAddress);
                toast.success("Connect address copied to clipboard");
              }}
            >
              <Copy className="mr-2 h-4 w-4" /> Copy {tunnelInfo.publicAddress}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* AuthKey warning */}
      {!config.AuthKey && (
        <Card className="border-red-500/40 bg-red-500/5">
          <CardContent className="flex items-start gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/15">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">BeamMP AuthKey is missing</p>
              <p className="text-xs text-muted-foreground">
                BeamMP-Server refuses to start without a valid AuthKey. Get one free from BeamMP&apos;s key portal.
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <a href="https://keymaster.beammp.com/" target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Get a key
              </a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusCard({
  title,
  status,
  icon: Icon,
  subtitle,
  accent,
}: {
  title: string;
  status: string;
  icon: typeof Activity;
  subtitle: string;
  accent: "emerald" | "red" | "amber" | "muted";
}) {
  const accentClasses = {
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    red: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    muted: "bg-muted text-muted-foreground border-border",
  }[accent];

  const Icon2 =
    accent === "emerald" ? CheckCircle2 : accent === "red" ? XCircle : accent === "amber" ? AlertTriangle : Activity;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">{title}</span>
            <span className="text-xl font-semibold capitalize">{status}</span>
          </div>
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg border", accentClasses)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Icon2 className={cn("h-3.5 w-3.5", accentClasses.split(" ").find((c) => c.startsWith("text")))} />
          <span className="text-xs text-muted-foreground truncate">{subtitle}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-md border bg-card/50 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-sm font-medium truncate", highlight && "text-emerald-600 dark:text-emerald-400")}>{value}</div>
    </div>
  );
}
