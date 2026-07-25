"use client";

import { useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Play,
  Square,
  RotateCcw,
  Trash2,
  Send,
  Terminal,
  Cpu,
  Clock,
  Users,
  Activity,
} from "lucide-react";
import { useBeamMPStore, formatUptime } from "@/lib/beammp/store";
import { cn } from "@/lib/utils";
import type { LogLine } from "@/lib/beammp/types";
import { validateServerConfig } from "@/lib/beammp/server-config";

export function ServerPanel() {
  const serverStatus = useBeamMPStore((s) => s.serverStatus);
  const config = useBeamMPStore((s) => s.config);
  const serverUptimeMs = useBeamMPStore((s) => s.serverUptimeMs);
  const serverPid = useBeamMPStore((s) => s.serverPid);
  const players = useBeamMPStore((s) => s.players);
  const startServer = useBeamMPStore((s) => s.startServer);
  const stopServer = useBeamMPStore((s) => s.stopServer);
  const restartServer = useBeamMPStore((s) => s.restartServer);
  const sendConsoleCommand = useBeamMPStore((s) => s.sendConsoleCommand);
  const logs = useBeamMPStore((s) => s.logs);
  const clearLogs = useBeamMPStore((s) => s.clearLogs);

  const [cmd, setCmd] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const issues = validateServerConfig(config);
  const blockingIssues = issues.filter((i) => i.severity === "error");

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleSend = () => {
    if (!cmd.trim()) return;
    sendConsoleCommand(cmd);
    setCmd("");
  };

  return (
    <div className="space-y-6">
      {/* Control card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Cpu className="h-4 w-4" /> BeamMP-Server Lifecycle
              </CardTitle>
              <CardDescription>Start, stop, and monitor your BeamMP-Server process</CardDescription>
            </div>
            <ServerStatusBadge status={serverStatus} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat icon={Activity} label="Process ID" value={serverPid ? String(serverPid) : "—"} />
            <Stat icon={Clock} label="Uptime" value={serverStatus === "running" ? formatUptime(serverUptimeMs) : "—"} />
            <Stat icon={Users} label="Players" value={`${players.length} / ${config.MaxPlayers}`} />
          </div>

          <div className="flex flex-wrap gap-2">
            {serverStatus === "running" ? (
              <>
                <Button variant="destructive" onClick={() => stopServer()}>
                  <Square className="mr-2 h-4 w-4" /> Stop
                </Button>
                <Button variant="outline" onClick={() => restartServer()}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Restart
                </Button>
              </>
            ) : (
              <Button
                onClick={() => startServer()}
                disabled={blockingIssues.length > 0 || serverStatus === "starting"}
              >
                <Play className="mr-2 h-4 w-4" />
                {serverStatus === "starting" ? "Starting..." : "Start Server"}
              </Button>
            )}
          </div>

          {blockingIssues.length > 0 && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 space-y-1">
              {blockingIssues.map((issue, i) => (
                <p key={i} className="text-xs text-red-700 dark:text-red-300">
                  • {issue.message}
                </p>
              ))}
            </div>
          )}

          <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
            <p>
              <strong className="text-foreground/80">Tip:</strong> BeamMP-Server listens on port{" "}
              <code className="rounded bg-background px-1 py-0.5">{config.Port}</code> (TCP+UDP).
              Make sure your playit.gg tunnel points at the same local port.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Console + players */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Console (2 cols) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Terminal className="h-4 w-4" /> Live Console
                </CardTitle>
                <CardDescription>Server stdout and your console commands</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setAutoScroll((s) => !s)}
                >
                  Auto-scroll: {autoScroll ? "on" : "off"}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearLogs}>
                  <Trash2 className="mr-1 h-3 w-3" /> Clear
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div
              ref={scrollRef}
              className="h-[420px] overflow-y-auto rounded-md border bg-zinc-950 p-3 font-mono text-[12px] leading-relaxed"
            >
              {logs.length === 0 ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Terminal className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    <p>No log output yet. Start the server to see live logs.</p>
                  </div>
                </div>
              ) : (
                logs.map((line) => <LogLineRow key={line.id} line={line} />)
              )}
            </div>

            <Separator className="my-4" />

            <div className="flex gap-2">
              <Input
                placeholder="Type a console command (e.g. help, status, say hello)"
                value={cmd}
                onChange={(e) => setCmd(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSend();
                }}
                className="font-mono"
                disabled={serverStatus !== "running"}
              />
              <Button onClick={handleSend} disabled={serverStatus !== "running" || !cmd.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Commands: <code>help</code>, <code>status</code>, <code>list_players</code>,{" "}
              <code>kick &lt;name&gt;</code>, <code>say &lt;msg&gt;</code>,{" "}
              <code>reload_plugins</code>, <code>version</code>
            </p>
          </CardContent>
        </Card>

        {/* Players (1 col) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Players
            </CardTitle>
            <CardDescription>{players.length} of {config.MaxPlayers} slots used</CardDescription>
          </CardHeader>
          <CardContent>
            {players.length === 0 ? (
              <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
                <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                No players connected.
                {serverStatus === "running" && (
                  <p className="mt-1 text-xs">Players will appear here as they join.</p>
                )}
              </div>
            ) : (
              <ScrollArea className="h-[420px] pr-2">
                <div className="space-y-2">
                  {players.map((p) => (
                    <div key={p.name + p.connectedAt} className="flex items-center justify-between rounded-md border p-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {p.cars} car{p.cars !== 1 ? "s" : ""} · joined {new Date(p.connectedAt).toLocaleTimeString()}
                        </div>
                      </div>
                      <Badge variant="outline" className={cn(p.pingMs < 80 ? "text-emerald-600 dark:text-emerald-400" : p.pingMs < 150 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400")}>
                        {p.pingMs}ms
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card/50 p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-1 text-sm font-semibold font-mono">{value}</div>
    </div>
  );
}

function ServerStatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    stopped: { color: "bg-muted text-muted-foreground", label: "Stopped" },
    starting: { color: "bg-amber-500/15 text-amber-600 dark:text-amber-400", label: "Starting" },
    running: { color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", label: "Running" },
    stopping: { color: "bg-amber-500/15 text-amber-600 dark:text-amber-400", label: "Stopping" },
    crashed: { color: "bg-red-500/15 text-red-600 dark:text-red-400", label: "Crashed" },
  };
  const cfg = map[status] ?? map.stopped;
  return (
    <Badge variant="outline" className={cn("gap-1.5", cfg.color)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.color.split(" ")[0].replace("/15", ""))} />
      {cfg.label}
    </Badge>
  );
}

function LogLineRow({ line }: { line: LogLine }) {
  const time = new Date(line.ts).toLocaleTimeString(undefined, { hour12: false });
  const colorMap: Record<LogLine["level"], string> = {
    info: "text-zinc-300",
    warn: "text-amber-400",
    error: "text-red-400",
    cmd: "text-sky-300",
    success: "text-emerald-400",
  };
  const sourceTag: Record<LogLine["source"], string> = {
    server: "[SERVER]",
    agent: "[AGENT]",
    system: "[SYSTEM]",
  };
  const isClaimUrl = line.text.startsWith("https://playit.gg/claim/");
  return (
    <div className="flex gap-2 leading-snug">
      <span className="shrink-0 text-zinc-600 select-none">{time}</span>
      <span className={cn("shrink-0 font-semibold select-none", colorMap[line.level])}>
        {sourceTag[line.source]}
      </span>
      <span className={cn("flex-1 break-words", colorMap[line.level], isClaimUrl && "underline")}>
        {line.text}
      </span>
    </div>
  );
}
