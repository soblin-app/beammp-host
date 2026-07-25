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
  Copy,
  Share2,
  Globe,
  Map as MapIcon,
  Users,
  Clock,
  Server,
  Check,
  MessageCircle,
} from "lucide-react";
import { useBeamMPStore, formatUptime } from "@/lib/beammp/store";
import { findMapByValue } from "@/lib/beammp/maps";
import { stripColorCodes } from "@/lib/beammp/color-codes";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function JoinInfo() {
  const config = useBeamMPStore((s) => s.config);
  const tunnelInfo = useBeamMPStore((s) => s.tunnelInfo);
  const tunnelStatus = useBeamMPStore((s) => s.tunnelStatus);
  const serverStatus = useBeamMPStore((s) => s.serverStatus);
  const players = useBeamMPStore((s) => s.players);
  const serverUptimeMs = useBeamMPStore((s) => s.serverUptimeMs);
  const setActiveView = useBeamMPStore((s) => s.setActiveView);

  const plainName = stripColorCodes(config.Name) || "BeamMP Server";
  const mapLabel = findMapByValue(config.Map)?.label ?? config.Map;
  const publicAddr = tunnelInfo?.publicAddress ?? "";
  const ready = serverStatus === "running" && tunnelStatus === "tunnel_ready" && !!publicAddr;

  const discordMessage = `Join my BeamMP server: ${plainName} — ${publicAddr || "(tunnel not active)"} (Direct Connect in BeamNG)`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="space-y-6">
      {/* Main join card */}
      <Card className={cn(ready && "border-emerald-500/40 bg-emerald-500/5")}>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Share2 className="h-4 w-4" /> Join Information
              </CardTitle>
              <CardDescription>Everything your players need to connect in one place</CardDescription>
            </div>
            {ready ? (
              <Badge className="gap-1.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                <Check className="h-3 w-3" /> Server live &amp; tunnel active
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Not ready — server: {serverStatus}, tunnel: {tunnelStatus}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Server identity block */}
          <div className="rounded-lg border bg-card p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Server Name</div>
                <div className="mt-1 text-2xl font-bold truncate">{plainName}</div>
                <div className="mt-1 text-xs text-muted-foreground">{config.Description}</div>
              </div>
              {config.Tags && (
                <div className="flex flex-wrap gap-1.5">
                  {config.Tags.split(",").map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag.trim()}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile icon={Globe} label="Public Address" value={publicAddr || "—"} mono highlight={!!publicAddr} />
            <StatTile icon={MapIcon} label="Map" value={mapLabel} />
            <StatTile icon={Users} label="Players" value={`${players.length} / ${config.MaxPlayers}`} />
            <StatTile icon={Clock} label="Uptime" value={serverStatus === "running" ? formatUptime(serverUptimeMs) : "—"} />
          </div>

          {/* Connect address spotlight */}
          {publicAddr ? (
            <div className="rounded-lg border-2 border-emerald-500/40 bg-emerald-500/5 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Server className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  Direct Connect Address
                </span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate text-lg font-mono font-bold text-emerald-700 dark:text-emerald-300">
                  {publicAddr}
                </code>
                <Button
                  size="sm"
                  onClick={() => copyToClipboard(publicAddr, "Connect address")}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Paste this into BeamNG.drive → Multiplayer → Direct Connect → Server Address field.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed p-5 text-center">
              <Globe className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium">No public address yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Start the server and tunnel to generate your public connect address.
              </p>
              <div className="mt-3 flex justify-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setActiveView("server")}>
                  Go to Server
                </Button>
                <Button size="sm" variant="outline" onClick={() => setActiveView("tunnel")}>
                  Go to Tunnel
                </Button>
              </div>
            </div>
          )}

          {/* Copy buttons */}
          {publicAddr && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                variant="secondary"
                className="h-auto py-3 justify-start"
                onClick={() => copyToClipboard(publicAddr, "Address")}
              >
                <Copy className="mr-3 h-5 w-5 shrink-0" />
                <div className="text-left">
                  <div className="text-sm font-semibold">Copy Address Only</div>
                  <div className="text-xs opacity-70 font-normal">{publicAddr}</div>
                </div>
              </Button>
              <Button
                variant="secondary"
                className="h-auto py-3 justify-start"
                onClick={() => copyToClipboard(discordMessage, "Discord message")}
              >
                <MessageCircle className="mr-3 h-5 w-5 shrink-0" />
                <div className="text-left">
                  <div className="text-sm font-semibold">Copy for Discord</div>
                  <div className="text-xs opacity-70 font-normal truncate max-w-[280px]">{discordMessage}</div>
                </div>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Discord preview */}
      {publicAddr && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-4 w-4" /> Discord Message Preview
            </CardTitle>
            <CardDescription>How the shareable message will look in Discord</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border bg-zinc-950 p-4">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white font-semibold text-sm">
                  You
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-white">You</span>
                    <span className="text-[11px] text-zinc-500">today at {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-200">{discordMessage}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* How players join */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How Players Join</CardTitle>
          <CardDescription>Share these steps with your friends</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            <Step n={1} title="Install BeamNG.drive">
              Available on Steam. The multiplayer mod works with the latest stable release.
            </Step>
            <Step n={2} title="Install the BeamMP launcher">
              Download from <a href="https://beammp.com/" target="_blank" rel="noreferrer" className="underline">beammp.com</a> — it injects multiplayer support into BeamNG.drive.
            </Step>
            <Step n={3} title="Launch BeamMP, then BeamNG.drive">
              The BeamMP launcher will prompt you to start BeamNG.drive with multiplayer enabled.
            </Step>
            <Step n={4} title="Open Direct Connect">
              In the BeamMP multiplayer menu, click <strong>Direct Connect</strong> (not the server browser).
            </Step>
            <Step n={5} title="Paste the address">
              Enter <code className="rounded bg-muted px-1 py-0.5 font-mono">{publicAddr || "your-address.ply.gg:port"}</code> and click <strong>Connect</strong>.
            </Step>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  mono,
  highlight,
}: {
  icon: typeof Globe;
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-md border bg-card/50 p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={cn(
        "mt-1 text-sm font-semibold truncate",
        mono && "font-mono",
        highlight && "text-emerald-600 dark:text-emerald-400",
      )} title={value}>
        {value}
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-semibold">
        {n}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{children}</div>
      </div>
    </li>
  );
}
