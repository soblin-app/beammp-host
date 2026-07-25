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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Wand2,
  ChevronRight,
  ChevronLeft,
  Check,
  Download,
  Key,
  Settings2,
  Globe,
  Link2,
  PartyPopper,
  Car,
  Copy,
  ExternalLink,
  SkipForward,
  RefreshCw,
  Terminal,
} from "lucide-react";
import { useBeamMPStore } from "@/lib/beammp/store";
import { COMMON_MAPS, findMapByValue } from "@/lib/beammp/maps";
import { validateServerConfig } from "@/lib/beammp/server-config";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { WizardStepId } from "@/lib/beammp/types";
import * as bridge from "@/lib/beammp/tauri-bridge";

const STEPS: Array<{ id: WizardStepId; title: string; icon: typeof Wand2; description: string }> = [
  { id: "welcome", title: "Welcome", icon: Wand2, description: "Overview of the setup flow" },
  { id: "install", title: "Install BeamMP", icon: Download, description: "Download the server binary" },
  { id: "authkey", title: "AuthKey", icon: Key, description: "Get your BeamMP key" },
  { id: "server-config", title: "Server Config", icon: Settings2, description: "Name, map, players" },
  { id: "playit-install", title: "Install playit", icon: Globe, description: "Download the tunnel agent" },
  { id: "playit-claim", title: "Claim Agent", icon: Link2, description: "Link agent to your account" },
  { id: "tunnel-create", title: "Create Tunnel", icon: Globe, description: "TCP+UDP tunnel for BeamMP" },
  { id: "done", title: "Done", icon: PartyPopper, description: "Server is live!" },
];

export function SetupWizard() {
  const wizard = useBeamMPStore((s) => s.wizard);
  const setWizardStep = useBeamMPStore((s) => s.setWizardStep);
  const completeWizardStep = useBeamMPStore((s) => s.completeWizardStep);
  const skipWizardStep = useBeamMPStore((s) => s.skipWizardStep);
  const resetWizard = useBeamMPStore((s) => s.resetWizard);
  const setActiveView = useBeamMPStore((s) => s.setActiveView);

  const currentIdx = STEPS.findIndex((s) => s.id === wizard.step);

  const goNext = () => {
    const next = STEPS[currentIdx + 1];
    if (next) {
      completeWizardStep(wizard.step);
      setWizardStep(next.id);
    }
  };
  const goPrev = () => {
    const prev = STEPS[currentIdx - 1];
    if (prev) setWizardStep(prev.id);
  };

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2 overflow-x-auto">
            {STEPS.map((step, idx) => {
              const isCurrent = wizard.step === step.id;
              const isCompleted = wizard.completed.includes(step.id);
              const isSkipped = wizard.skipped.includes(step.id);
              const Icon = step.icon;
              return (
                <div key={step.id} className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setWizardStep(step.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                      isCurrent ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                        isCurrent ? "bg-primary-foreground/20" : isCompleted ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : isSkipped ? "bg-muted-foreground/15 text-muted-foreground" : "bg-muted",
                      )}
                    >
                      {isCompleted ? <Check className="h-3 w-3" /> : isSkipped ? <SkipForward className="h-3 w-3" /> : idx + 1}
                    </span>
                    <span className={cn("hidden sm:inline", isCurrent && "font-medium")}>{step.title}</span>
                  </button>
                  {idx < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {(() => {
              const Icon = STEPS[currentIdx].icon;
              return <Icon className="h-4 w-4" />;
            })()}
            {STEPS[currentIdx].title}
          </CardTitle>
          <CardDescription>{STEPS[currentIdx].description}</CardDescription>
        </CardHeader>
        <CardContent>
          {wizard.step === "welcome" && <WelcomeStep />}
          {wizard.step === "install" && <InstallStep />}
          {wizard.step === "authkey" && <AuthKeyStep />}
          {wizard.step === "server-config" && <ServerConfigStep />}
          {wizard.step === "playit-install" && <PlayitInstallStep />}
          {wizard.step === "playit-claim" && <PlayitClaimStep />}
          {wizard.step === "tunnel-create" && <TunnelCreateStep />}
          {wizard.step === "done" && <DoneStep />}

          {/* Nav buttons */}
          <div className="mt-6 flex items-center justify-between gap-2 border-t pt-4">
            <Button variant="ghost" onClick={goPrev} disabled={currentIdx === 0}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  skipWizardStep(wizard.step);
                  toast.info(`Skipped: ${STEPS[currentIdx].title}`);
                  goNext();
                }}
                disabled={wizard.step === "welcome" || wizard.step === "done"}
              >
                <SkipForward className="mr-1 h-3.5 w-3.5" /> Skip
              </Button>
              {wizard.step !== "done" ? (
                <Button onClick={goNext}>
                  {currentIdx === STEPS.length - 2 ? "Finish" : "Next"} <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => resetWizard()}>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Restart wizard
                  </Button>
                  <Button onClick={() => setActiveView("dashboard")}>
                    Go to Dashboard <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function WelcomeStep() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-md border bg-muted/30 p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Car className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-base font-semibold">Welcome to BeamMP Host</h3>
          <p className="text-sm text-muted-foreground">Let&apos;s get your local BeamMP server online in about 5 minutes.</p>
        </div>
      </div>

      <p className="text-sm">
        This wizard will walk you through:
      </p>
      <ol className="space-y-2 text-sm text-muted-foreground ml-2">
        <li className="flex gap-2"><Badge variant="outline" className="h-5 w-5 justify-center p-0 text-[10px]">1</Badge> Installing the BeamMP-Server binary</li>
        <li className="flex gap-2"><Badge variant="outline" className="h-5 w-5 justify-center p-0 text-[10px]">2</Badge> Getting a BeamMP AuthKey (required)</li>
        <li className="flex gap-2"><Badge variant="outline" className="h-5 w-5 justify-center p-0 text-[10px]">3</Badge> Naming your server &amp; picking a map</li>
        <li className="flex gap-2"><Badge variant="outline" className="h-5 w-5 justify-center p-0 text-[10px]">4</Badge> Installing the playit.gg tunnel agent</li>
        <li className="flex gap-2"><Badge variant="outline" className="h-5 w-5 justify-center p-0 text-[10px]">5</Badge> Creating a public TCP+UDP tunnel</li>
        <li className="flex gap-2"><Badge variant="outline" className="h-5 w-5 justify-center p-0 text-[10px]">6</Badge> Sharing your public address with friends</li>
      </ol>

      <div className="rounded-md border border-sky-500/40 bg-sky-500/10 p-3 text-xs text-sky-700 dark:text-sky-300">
        <strong>You&apos;ll need:</strong> a BeamMP account (free, sign in with Discord at keymaster.beammp.com) and a playit.gg account (free, sign up at playit.gg). The app cannot create these on your behalf.
      </div>
    </div>
  );
}

function InstallStep() {
  const beammpBinary = useBeamMPStore((s) => s.beammpBinary);
  const installBeamMP = useBeamMPStore((s) => s.installBeamMP);
  const settings = useBeamMPStore((s) => s.settings);
  const setSettings = useBeamMPStore((s) => s.setSettings);
  const [installing, setInstalling] = useState(false);

  const handleInstall = async () => {
    setInstalling(true);
    await installBeamMP();
    setInstalling(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm">
        The app needs the BeamMP-Server binary. We&apos;ll download the latest release from the official GitHub repository.
      </p>
      <div className="rounded-md border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">BeamMP-Server</div>
            <div className="text-xs text-muted-foreground">
              {beammpBinary.installedVersion
                ? `Installed: ${beammpBinary.installedVersion}`
                : beammpBinary.status === "downloading"
                ? "Downloading..."
                : beammpBinary.status === "checking"
                ? "Checking latest release..."
                : "Not installed"}
            </div>
          </div>
          {beammpBinary.installedVersion && (
            <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 gap-1">
              <Check className="h-3 w-3" /> Ready
            </Badge>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="install-dir" className="text-xs">Install directory</Label>
          <Input
            id="install-dir"
            value={settings.beammpInstallDir}
            onChange={(e) => setSettings({ beammpInstallDir: e.target.value })}
            className="font-mono text-xs"
          />
        </div>
        <Button onClick={handleInstall} disabled={installing || beammpBinary.status === "downloading"}>
          <Download className="mr-2 h-4 w-4" />
          {installing ? "Downloading..." : beammpBinary.installedVersion ? "Re-download" : "Download BeamMP-Server"}
        </Button>
        {beammpBinary.installedVersion && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            <Check className="inline h-3 w-3 mr-1" />
            BeamMP-Server is installed. On first launch it will generate <code>ServerConfig.toml</code> and a <code>Resources/</code> folder.
          </p>
        )}
      </div>
    </div>
  );
}

function AuthKeyStep() {
  const config = useBeamMPStore((s) => s.config);
  const setConfig = useBeamMPStore((s) => s.setConfig);
  const completeWizardStep = useBeamMPStore((s) => s.completeWizardStep);

  return (
    <div className="space-y-4">
      <p className="text-sm">
        BeamMP-Server refuses to start without a valid <code>AuthKey</code>. Keys are free and tied to your BeamMP account.
      </p>

      <ol className="space-y-2 text-sm text-muted-foreground">
        <li><strong className="text-foreground/80">1.</strong> Open the BeamMP Key Master portal:</li>
      </ol>
      <Button asChild variant="outline" size="sm">
        <a href="https://keymaster.beammp.com/" target="_blank" rel="noreferrer">
          <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open keymaster.beammp.com
        </a>
      </Button>

      <ol className="space-y-2 text-sm text-muted-foreground mt-2">
        <li><strong className="text-foreground/80">2.</strong> Sign in with Discord, click <em>Generate Key</em>, copy it.</li>
        <li><strong className="text-foreground/80">3.</strong> Paste it below:</li>
      </ol>

      <div className="space-y-2">
        <Label htmlFor="wiz-authkey">Your AuthKey</Label>
        <Input
          id="wiz-authkey"
          type="password"
          value={config.AuthKey}
          onChange={(e) => {
            setConfig({ AuthKey: e.target.value });
            if (e.target.value.trim().length >= 8) {
              completeWizardStep("authkey");
            }
          }}
          placeholder="Paste your key here"
          className={cn(config.AuthKey.length >= 8 ? "border-emerald-500/40" : "border-red-500/40")}
        />
        {config.AuthKey.length >= 8 ? (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <Check className="h-3 w-3" /> AuthKey set. You can continue.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Key must be at least 8 characters.</p>
        )}
      </div>
    </div>
  );
}

function ServerConfigStep() {
  const config = useBeamMPStore((s) => s.config);
  const setConfig = useBeamMPStore((s) => s.setConfig);
  const mapKnown = !!findMapByValue(config.Map);
  const issues = validateServerConfig(config);

  return (
    <div className="space-y-4">
      <p className="text-sm">
        Pick a name, choose a map, and set how many players your server will support. You can change these later in the Config tab.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="wiz-name">Server Name</Label>
          <Input
            id="wiz-name"
            value={config.Name}
            onChange={(e) => setConfig({ Name: e.target.value })}
            placeholder="My BeamMP Server"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wiz-map">Map</Label>
          <Select value={mapKnown ? config.Map : "__custom__"} onValueChange={(v) => v !== "__custom__" && setConfig({ Map: v })}>
            <SelectTrigger id="wiz-map"><SelectValue /></SelectTrigger>
            <SelectContent>
              {COMMON_MAPS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
              <SelectItem value="__custom__">Custom...</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="wiz-port">Port</Label>
          <Input
            id="wiz-port"
            type="number"
            value={config.Port}
            onChange={(e) => setConfig({ Port: Number(e.target.value) })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wiz-maxplayers">Max Players</Label>
          <Input
            id="wiz-maxplayers"
            type="number"
            min={1}
            value={config.MaxPlayers}
            onChange={(e) => setConfig({ MaxPlayers: Number(e.target.value) })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wiz-maxcars">Max Cars per Player</Label>
          <Input
            id="wiz-maxcars"
            type="number"
            min={0}
            value={config.MaxCars}
            onChange={(e) => setConfig({ MaxCars: Number(e.target.value) })}
          />
        </div>
        <div className="sm:col-span-2 flex items-center justify-between gap-3 rounded-md border p-3">
          <div>
            <div className="text-sm font-medium">Private server</div>
            <div className="text-[11px] text-muted-foreground">Hide from the public list — players direct-connect only.</div>
          </div>
          <Switch checked={config.Private} onCheckedChange={(v) => setConfig({ Private: v })} />
        </div>
      </div>

      {issues.filter((i) => i.severity === "error").length === 0 && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
          <Check className="h-3 w-3" /> Config looks good. Don&apos;t forget to click Save in the Config tab later.
        </p>
      )}
    </div>
  );
}

function PlayitInstallStep() {
  const playitBinary = useBeamMPStore((s) => s.playitBinary);
  const installPlayit = useBeamMPStore((s) => s.installPlayit);
  const settings = useBeamMPStore((s) => s.settings);
  const setSettings = useBeamMPStore((s) => s.setSettings);
  const [installing, setInstalling] = useState(false);

  const handleInstall = async () => {
    setInstalling(true);
    await installPlayit();
    setInstalling(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm">
        playit.gg is a tunneling service that exposes your local server to the internet without router port-forwarding. Perfect for users behind CGNAT or IPv6-only ISPs.
      </p>
      <div className="rounded-md border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">playit-agent</div>
            <div className="text-xs text-muted-foreground">
              {playitBinary.installedVersion
                ? `Installed: ${playitBinary.installedVersion}`
                : playitBinary.status === "downloading"
                ? "Downloading..."
                : "Not installed"}
            </div>
          </div>
          {playitBinary.installedVersion && (
            <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 gap-1">
              <Check className="h-3 w-3" /> Ready
            </Badge>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="playit-dir" className="text-xs">Install directory</Label>
          <Input
            id="playit-dir"
            value={settings.playitInstallDir}
            onChange={(e) => setSettings({ playitInstallDir: e.target.value })}
            className="font-mono text-xs"
          />
        </div>
        <Button onClick={handleInstall} disabled={installing || playitBinary.status === "downloading"}>
          <Download className="mr-2 h-4 w-4" />
          {installing ? "Downloading..." : playitBinary.installedVersion ? "Re-download" : "Download playit-agent"}
        </Button>
      </div>
      <div className="rounded-md border border-sky-500/40 bg-sky-500/10 p-3 text-xs text-sky-700 dark:text-sky-300">
        <strong>Don&apos;t have a playit.gg account?</strong> Sign up free at <a href="https://playit.gg/" target="_blank" rel="noreferrer" className="underline">playit.gg</a>. The free tier includes unlimited tunnels.
      </div>
    </div>
  );
}

function PlayitClaimStep() {
  const tunnelStatus = useBeamMPStore((s) => s.tunnelStatus);
  const claimUrl = useBeamMPStore((s) => s.claimUrl);
  const agentSecretSaved = useBeamMPStore((s) => s.agentSecretSaved);
  const startAgent = useBeamMPStore((s) => s.startAgent);
  const confirmClaimed = useBeamMPStore((s) => s.confirmClaimed);
  const [confirming, setConfirming] = useState(false);
  const isRealTauri = bridge.isTauri();

  return (
    <div className="space-y-4">
      <p className="text-sm">
        The first time you run the playit agent, it generates a one-time <strong>claim URL</strong>. Open it, sign in to playit.gg, and approve the new agent to link it to your account.
      </p>

      {/* Notice: real in Tauri, simulated in browser */}
      {!isRealTauri && (
        <div className="rounded-md border border-sky-500/40 bg-sky-500/10 p-3 text-xs text-sky-700 dark:text-sky-300">
          <p className="font-medium mb-1">Prototype notice</p>
          <p>
            This prototype runs a <strong>mock playit agent</strong> (no real binary), so the claim URL shown below
            looks realistic but isn&apos;t registered with playit.gg. Opening it on playit.gg will show
            &quot;Invalid claim code&quot; — that&apos;s expected. Just click <strong>&quot;I&apos;ve authorized — continue&quot;</strong>{" "}
            below to simulate the authorization and move on.
          </p>
        </div>
      )}
      {isRealTauri && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
          <p className="font-medium mb-1">Real playit-agent running</p>
          <p>
            The claim URL below was printed by the actual <code>playit-agent</code> binary on your machine. Open it,
            sign in to playit.gg, and approve the new agent. The agent secret will be saved locally so you
            won&apos;t need to re-claim on future launches.
          </p>
        </div>
      )}

      {tunnelStatus === "disconnected" && (
        <Button onClick={() => startAgent()}>
          <Globe className="mr-2 h-4 w-4" /> Start the playit agent
        </Button>
      )}

      {(tunnelStatus === "needs_claim" || tunnelStatus === "claiming") && claimUrl && (
        <div className="space-y-3">
          <div className="rounded-md border bg-card p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
              Claim URL{!isRealTauri && " (simulated)"}
            </div>
            <code className="text-sm font-mono break-all">{claimUrl}</code>
          </div>
          <div className="flex gap-2">
            <Button asChild size="sm" variant={isRealTauri ? "default" : "outline"}>
              <a href={claimUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open in browser{!isRealTauri && " (will show invalid)"}
              </a>
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(claimUrl)}>
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy URL
            </Button>
          </div>
        </div>
      )}

      {agentSecretSaved && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
          <Check className="h-3 w-3" /> Agent already linked — secret saved locally. You won&apos;t need to re-claim on future launches.
        </p>
      )}

      {(tunnelStatus === "needs_claim" || tunnelStatus === "claiming") && (
        <div className="rounded-md border bg-muted/30 p-3 space-y-2">
          <p className="text-sm font-medium">{isRealTauri ? "After you authorize the agent in the browser:" : "Continue to the next step"}</p>
          <p className="text-xs text-muted-foreground">
            {isRealTauri
              ? "You'll see a green \"Agent authorized\" message in the playit.gg dashboard. Click below to continue."
              : "In the prototype, just click below — the mock agent will simulate receiving its secret key and connecting. In a real Tauri build, you'd click this after seeing the \"Agent authorized\" message in the playit.gg dashboard."}
          </p>
          <Button
            size="sm"
            onClick={async () => {
              setConfirming(true);
              await confirmClaimed();
              setConfirming(false);
            }}
            disabled={confirming}
          >
            <Check className="mr-1.5 h-3.5 w-3.5" /> {confirming ? "Connecting..." : "I've authorized — continue"}
          </Button>
        </div>
      )}
    </div>
  );
}

function TunnelCreateStep() {
  const tunnelStatus = useBeamMPStore((s) => s.tunnelStatus);
  const tunnelInfo = useBeamMPStore((s) => s.tunnelInfo);
  const config = useBeamMPStore((s) => s.config);

  return (
    <div className="space-y-4">
      <p className="text-sm">
        playit allocates a public address (like <code>something.ply.gg:12345</code>) and forwards TCP+UDP traffic to your BeamMP server. BeamMP requires both protocols.
      </p>

      <div className="rounded-md border p-4 space-y-2 font-mono text-xs">
        <div className="text-muted-foreground">Tunnel configuration:</div>
        <div>Tunnel type: <span className="text-sky-500">TCP+UDP</span></div>
        <div>Local target: <span className="text-sky-500">127.0.0.1:{config.Port}</span></div>
        <div>Public address: <span className="text-emerald-600 dark:text-emerald-400">{tunnelInfo?.publicAddress ?? "(pending)"}</span></div>
      </div>

      {tunnelStatus === "tunnel_ready" && tunnelInfo ? (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
            <Check className="h-4 w-4" /> Tunnel is active!
          </p>
          <p className="text-xs mt-1 text-emerald-700/80 dark:text-emerald-300/80">
            Your public address is <code className="font-mono">{tunnelInfo.publicAddress}</code>.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          The tunnel is being created automatically. If you don&apos;t see a public address within 30 seconds, check the Tunnel tab.
        </p>
      )}
    </div>
  );
}

function DoneStep() {
  const config = useBeamMPStore((s) => s.config);
  const tunnelInfo = useBeamMPStore((s) => s.tunnelInfo);
  const serverStatus = useBeamMPStore((s) => s.serverStatus);
  const startServer = useBeamMPStore((s) => s.startServer);
  const setActiveView = useBeamMPStore((s) => s.setActiveView);
  const settings = useBeamMPStore((s) => s.settings);

  return (
    <div className="space-y-4">
      <div className="text-center py-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 mb-3">
          <PartyPopper className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-semibold">You&apos;re all set!</h3>
        <p className="text-sm text-muted-foreground mt-1">Your BeamMP server is configured and ready to host players.</p>
      </div>

      <div className="rounded-md border bg-card p-4 space-y-2">
        <div className="grid gap-2 sm:grid-cols-2 text-sm">
          <div>
            <span className="text-muted-foreground">Server name:</span> <strong>{config.Name}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">Map:</span> <strong>{findMapByValue(config.Map)?.label ?? config.Map}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">Port:</span> <strong className="font-mono">{config.Port}</strong>
          </div>
          <div>
            <span className="text-muted-foreground">Max players:</span> <strong>{config.MaxPlayers}</strong>
          </div>
          <div className="sm:col-span-2">
            <span className="text-muted-foreground">Public address:</span>{" "}
            <strong className="font-mono text-emerald-600 dark:text-emerald-400">
              {tunnelInfo?.publicAddress ?? "(start the server to assign one)"}
            </strong>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {serverStatus !== "running" ? (
          <Button onClick={() => startServer()}>
            <Car className="mr-2 h-4 w-4" /> Start my server
          </Button>
        ) : (
          <Button onClick={() => setActiveView("join")}>
            <ExternalLink className="mr-2 h-4 w-4" /> View Join Info
          </Button>
        )}
        <Button variant="outline" onClick={() => setActiveView("dashboard")}>
          <Terminal className="mr-2 h-4 w-4" /> Go to Dashboard
        </Button>
      </div>

      <div className="rounded-md border border-sky-500/40 bg-sky-500/10 p-3 text-xs text-sky-700 dark:text-sky-300">
        <strong>Auto-start tunnel:</strong> Currently <strong>{settings.autoStartTunnelWithServer ? "ON" : "OFF"}</strong>.
        When ON, clicking Start Server will also start your playit tunnel automatically. Toggle in Settings.
      </div>
    </div>
  );
}
