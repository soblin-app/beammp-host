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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Wrench,
  Download,
  RefreshCw,
  HardDrive,
  Clock,
  FolderOpen,
  Trash2,
  FileDown,
  Bell,
  Cpu,
  Globe,
  Shield,
} from "lucide-react";
import { useBeamMPStore } from "@/lib/beammp/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { compareVersions } from "@/lib/beammp/github-api";

export function SettingsPanel() {
  const settings = useBeamMPStore((s) => s.settings);
  const setSettings = useBeamMPStore((s) => s.setSettings);
  const beammpBinary = useBeamMPStore((s) => s.beammpBinary);
  const playitBinary = useBeamMPStore((s) => s.playitBinary);
  const checkForUpdates = useBeamMPStore((s) => s.checkForUpdates);
  const installBeamMP = useBeamMPStore((s) => s.installBeamMP);
  const installPlayit = useBeamMPStore((s) => s.installPlayit);
  const logs = useBeamMPStore((s) => s.logs);
  const clearLogs = useBeamMPStore((s) => s.clearLogs);

  const [checking, setChecking] = useState(false);

  const handleCheck = async () => {
    setChecking(true);
    await checkForUpdates();
    setChecking(false);
    toast.success("Update check complete.");
  };

  const exportLogs = () => {
    const text = logs
      .map((l) => `[${new Date(l.ts).toISOString()}] [${l.source.toUpperCase()}] [${l.level.toUpperCase()}] ${l.text}`)
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `beammp-host-logs-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Logs exported.");
  };

  return (
    <div className="space-y-6">
      {/* Install directories */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="h-4 w-4" /> Install Directories
          </CardTitle>
          <CardDescription>Where the app stores BeamMP-Server and playit-agent binaries</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="set-beammp-dir">BeamMP-Server install path</Label>
            <Input
              id="set-beammp-dir"
              value={settings.beammpInstallDir}
              onChange={(e) => setSettings({ beammpInstallDir: e.target.value })}
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              ServerConfig.toml, Resources/, and logs will be stored here.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="set-playit-dir">playit-agent install path</Label>
            <Input
              id="set-playit-dir"
              value={settings.playitInstallDir}
              onChange={(e) => setSettings({ playitInstallDir: e.target.value })}
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              The agent secret (config.toml) will be stored here. Keep this folder private.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Binary update checker */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="h-4 w-4" /> Binary Updates
              </CardTitle>
              <CardDescription>Check GitHub for newer versions of BeamMP-Server and playit-agent</CardDescription>
            </div>
            <Button onClick={handleCheck} disabled={checking} size="sm" variant="outline">
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", checking && "animate-spin")} />
              {checking ? "Checking..." : "Check for updates"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <BinaryRow
            icon={Cpu}
            name="BeamMP-Server"
            installed={beammpBinary.installedVersion}
            latest={beammpBinary.latestVersion}
            installPath={beammpBinary.installPath}
            lastChecked={beammpBinary.lastChecked}
            onInstall={() => installBeamMP()}
          />
          <BinaryRow
            icon={Globe}
            name="playit-agent"
            installed={playitBinary.installedVersion}
            latest={playitBinary.latestVersion}
            installPath={playitBinary.installPath}
            lastChecked={playitBinary.lastChecked}
            onInstall={() => installPlayit()}
          />
        </CardContent>
      </Card>

      {/* Behavior */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="h-4 w-4" /> Behavior
          </CardTitle>
          <CardDescription>How the app manages your server and tunnel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToggleRow
            label="Auto-start tunnel with server"
            description="Starting the server also starts the playit agent. Stopping the server stops the tunnel."
            checked={settings.autoStartTunnelWithServer}
            onChange={(v) => setSettings({ autoStartTunnelWithServer: v })}
          />
          <ToggleRow
            label="Auto-restart on crash"
            description="If the server exits unexpectedly, attempt to restart it with exponential backoff."
            checked={settings.autoRestartOnCrash}
            onChange={(v) => setSettings({ autoRestartOnCrash: v })}
          />
          <ToggleRow
            label="Minimize to system tray"
            description="Closing the main window keeps the server running in the system tray. Right-click the tray icon to quit."
            checked={settings.minimizeToTray}
            onChange={(v) => setSettings({ minimizeToTray: v })}
          />
          <ToggleRow
            label="Inject env overrides (BEAMMP_*)"
            description="Pass form values as environment variables to the child process, overriding ServerConfig.toml."
            checked={settings.envOverrideEnabled}
            onChange={(v) => setSettings({ envOverrideEnabled: v })}
          />

          <div className="grid gap-3 sm:grid-cols-2 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="set-backoff" className="text-xs">Crash-restart backoff (ms)</Label>
              <Input
                id="set-backoff"
                type="number"
                min={1000}
                step={500}
                value={settings.restartBackoffMs}
                onChange={(e) => setSettings({ restartBackoffMs: Number(e.target.value) })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log viewer */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <HardDrive className="h-4 w-4" /> Log Viewer
              </CardTitle>
              <CardDescription>
                {logs.length} log line{logs.length !== 1 ? "s" : ""} in memory
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={exportLogs} disabled={logs.length === 0}>
                <FileDown className="mr-1.5 h-3.5 w-3.5" /> Export
              </Button>
              <Button size="sm" variant="ghost" onClick={clearLogs} disabled={logs.length === 0}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
              No logs yet. Start the server or agent to generate output.
            </div>
          ) : (
            <ScrollArea className="h-[300px] rounded-md border bg-zinc-950 p-3">
              <div className="font-mono text-[11px] leading-relaxed space-y-0.5">
                {logs.map((l) => (
                  <div key={l.id} className="flex gap-2">
                    <span className="shrink-0 text-zinc-600">{new Date(l.ts).toLocaleTimeString(undefined, { hour12: false })}</span>
                    <span className={cn(
                      "shrink-0",
                      l.level === "error" ? "text-red-400" :
                      l.level === "warn" ? "text-amber-400" :
                      l.level === "success" ? "text-emerald-400" :
                      l.level === "cmd" ? "text-sky-300" :
                      "text-zinc-500"
                    )}>
                      [{l.source}]
                    </span>
                    <span className={cn(
                      "flex-1 break-words",
                      l.level === "error" ? "text-red-300" :
                      l.level === "warn" ? "text-amber-300" :
                      l.level === "success" ? "text-emerald-300" :
                      l.level === "cmd" ? "text-sky-200" :
                      "text-zinc-300"
                    )}>
                      {l.text}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Security & privacy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" /> Security &amp; Privacy
          </CardTitle>
          <CardDescription>Where your secrets live and who can see them</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground/80">BeamMP AuthKey</strong> — stored locally in <code>ServerConfig.toml</code> inside your install directory. Transmitted only to BeamMP&apos;s master server by the BeamMP-Server binary itself.
          </p>
          <p>
            <strong className="text-foreground/80">playit.gg agent secret</strong> — stored locally in <code>config.toml</code> inside the playit install directory. In a Tauri build this would be encrypted via the OS keychain.
          </p>
          <p>
            <strong className="text-foreground/80">No telemetry.</strong> This app never sends your config, logs, or secrets anywhere except to BeamMP&apos;s and playit&apos;s own official endpoints, and only via their own binaries.
          </p>
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 mt-2">
            <Bell className="inline h-3 w-3 mr-1" />
            Never run the server binary as Administrator/root. BeamMP-Server does not need elevated privileges and doing so increases your attack surface.
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>App version</span>
            <span className="font-mono">v0.1.0 (prototype)</span>
          </div>
          <div className="flex justify-between">
            <span>BeamMP-Server repo</span>
            <a href="https://github.com/BeamMP/BeamMP-Server" target="_blank" rel="noreferrer" className="underline">github.com/BeamMP/BeamMP-Server</a>
          </div>
          <div className="flex justify-between">
            <span>playit-agent repo</span>
            <a href="https://github.com/playit-cloud/playit-agent" target="_blank" rel="noreferrer" className="underline">github.com/playit-cloud/playit-agent</a>
          </div>
          <div className="flex justify-between">
            <span>BeamMP key portal</span>
            <a href="https://keymaster.beammp.com/" target="_blank" rel="noreferrer" className="underline">keymaster.beammp.com</a>
          </div>
          <Separator className="my-2" />
          <p className="pt-1">
            This is a UI prototype. Process lifecycle is simulated in-browser so you can fully explore the workflow. See the README for instructions on wrapping this UI in Tauri or Electron to drive real BeamMP-Server and playit-agent binaries.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function BinaryRow({
  icon: Icon,
  name,
  installed,
  latest,
  installPath,
  lastChecked,
  onInstall,
}: {
  icon: typeof Cpu;
  name: string;
  installed: string | null;
  latest: string | null;
  installPath: string;
  lastChecked: number;
  onInstall: () => void;
}) {
  const hasUpdate = !!installed && !!latest && compareVersions(latest, installed) > 0;
  return (
    <div className="flex items-center gap-3 rounded-md border p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{name}</div>
        <div className="text-[11px] text-muted-foreground truncate font-mono">{installPath}</div>
        <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
          <Clock className="h-2.5 w-2.5" />
          {lastChecked ? `Last checked ${new Date(lastChecked).toLocaleString()}` : "Never checked"}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        {installed ? (
          <Badge variant="outline" className={cn("gap-1", hasUpdate ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
            {hasUpdate ? `Update: ${latest}` : `Installed: ${installed}`}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">Not installed</Badge>
        )}
        <Button size="sm" variant="outline" className="h-7" onClick={() => onInstall()}>
          <Download className="mr-1 h-3 w-3" />
          {installed ? "Reinstall" : "Install"}
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-[11px] text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
