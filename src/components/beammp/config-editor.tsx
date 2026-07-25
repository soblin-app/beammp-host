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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Save,
  RotateCcw,
  Code2,
  FormInput,
  ExternalLink,
  Key,
  AlertTriangle,
  Check,
  Eye,
} from "lucide-react";
import { useBeamMPStore } from "@/lib/beammp/store";
import { COMMON_MAPS, findMapByValue } from "@/lib/beammp/maps";
import {
  BEAMMP_COLOR_CODES,
  parseColorCodedName,
  stripColorCodes,
} from "@/lib/beammp/color-codes";
import {
  defaultServerConfig,
  serializeServerConfig,
  validateServerConfig,
} from "@/lib/beammp/server-config";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function ConfigEditor() {
  const config = useBeamMPStore((s) => s.config);
  const setConfig = useBeamMPStore((s) => s.setConfig);
  const rawConfigText = useBeamMPStore((s) => s.rawConfigText);
  const setRawConfigText = useBeamMPStore((s) => s.setRawConfigText);
  const applyRawConfig = useBeamMPStore((s) => s.applyRawConfig);
  const saveConfig = useBeamMPStore((s) => s.saveConfig);
  const configDirty = useBeamMPStore((s) => s.configDirty);
  const serverStatus = useBeamMPStore((s) => s.serverStatus);

  const [mode, setMode] = useState<"form" | "raw">("form");
  const [showColorPalette, setShowColorPalette] = useState(false);

  const issues = validateServerConfig(config);
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warn");
  const isRunning = serverStatus === "running" || serverStatus === "starting";
  const mapKnown = !!findMapByValue(config.Map);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-base">ServerConfig.toml</CardTitle>
              <CardDescription>
                Visual editor for the <code>[General]</code> section. Changes are saved to disk when you click Save.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
                <Button
                  size="sm"
                  variant={mode === "form" ? "secondary" : "ghost"}
                  className="h-7"
                  onClick={() => setMode("form")}
                >
                  <FormInput className="mr-1.5 h-3.5 w-3.5" /> Form
                </Button>
                <Button
                  size="sm"
                  variant={mode === "raw" ? "secondary" : "ghost"}
                  className="h-7"
                  onClick={() => setMode("raw")}
                >
                  <Code2 className="mr-1.5 h-3.5 w-3.5" /> Raw TOML
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Validation banner */}
          {errors.length > 0 && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 space-y-1">
              {errors.map((e, i) => (
                <p key={i} className="text-xs text-red-700 dark:text-red-300 flex items-start gap-1.5">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {e.message}
                </p>
              ))}
            </div>
          )}
          {warnings.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 space-y-1">
              {warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-1.5">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {w.message}
                </p>
              ))}
            </div>
          )}

          {isRunning && (
            <div className="rounded-md border border-sky-500/40 bg-sky-500/10 p-3 text-xs text-sky-700 dark:text-sky-300">
              Server is currently running. Some changes (Port, AuthKey) only take effect after a restart.
            </div>
          )}

          {mode === "form" ? (
            <FormEditor
              config={config}
              setConfig={setConfig}
              showColorPalette={showColorPalette}
              setShowColorPalette={setShowColorPalette}
              mapKnown={mapKnown}
            />
          ) : (
            <RawEditor
              rawText={rawConfigText}
              setRawText={setRawConfigText}
              applyRaw={applyRawConfig}
            />
          )}

          <Separator />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {configDirty ? (
                <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
                  Unsaved changes
                </Badge>
              ) : (
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 gap-1">
                  <Check className="h-3 w-3" /> Saved
                </Badge>
              )}
              <span>File: <code>ServerConfig.toml</code></span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm("Reset all [General] fields to defaults? Unknown sections will be preserved.")) {
                    setConfig(defaultServerConfig());
                    toast.info("Config reset to defaults (don't forget to Save).");
                  }
                }}
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset to defaults
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  saveConfig();
                  toast.success("ServerConfig.toml saved.");
                }}
                disabled={!configDirty}
              >
                <Save className="mr-1.5 h-3.5 w-3.5" /> Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AuthKey callout */}
      <Card className="border-amber-500/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" /> About the BeamMP AuthKey
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            BeamMP-Server refuses to start without a valid <code>AuthKey</code> in your <code>ServerConfig.toml</code>.
            Keys are free, per-server, and issued by BeamMP&apos;s key portal.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li>Sign in at <strong>keymaster.beammp.com</strong> with your Discord or forum account.</li>
            <li>Click <em>Generate Key</em> and paste it into the AuthKey field above.</li>
            <li>Each key is tied to a single server instance. Don&apos;t reuse a key across multiple running servers.</li>
            <li>If your server stops appearing in the public list, the key may be expired or revoked — generate a new one.</li>
          </ul>
          <Button asChild size="sm" variant="outline">
            <a href="https://keymaster.beammp.com/" target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open BeamMP Key Master
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Env override reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Environment Variable Overrides</CardTitle>
          <CardDescription>BeamMP reads <code>BEAMMP_&lt;SETTING&gt;</code> env vars that override the TOML file</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border bg-muted/30 p-3 font-mono text-xs space-y-1">
            <div><span className="text-muted-foreground"># Override any [General] field via environment:</span></div>
            <div><span className="text-sky-400">BEAMMP_PORT</span>=30815</div>
            <div><span className="text-sky-400">BEAMMP_MAXPLAYERS</span>=20</div>
            <div><span className="text-sky-400">BEAMMP_AUTHKEY</span>=your-key-here</div>
            <div><span className="text-sky-400">BEAMMP_NAME</span>=&quot;My Custom Server&quot;</div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Enable <strong>Env override injection</strong> in Settings to have the launcher pass these to the
            child process automatically based on the values you set in the form above. Useful for running
            multiple servers from the same install dir.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function FormEditor({
  config,
  setConfig,
  showColorPalette,
  setShowColorPalette,
  mapKnown,
}: {
  config: ReturnType<typeof useBeamMPStore.getState>["config"];
  setConfig: ReturnType<typeof useBeamMPStore.getState>["setConfig"];
  showColorPalette: boolean;
  setShowColorPalette: (v: boolean) => void;
  mapKnown: boolean;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {/* Name + color codes */}
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="cfg-name">Server Name</Label>
        <div className="flex gap-2">
          <Input
            id="cfg-name"
            value={config.Name}
            onChange={(e) => setConfig({ Name: e.target.value })}
            placeholder="My BeamMP Server"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setShowColorPalette(!showColorPalette)}
            title="Insert color code"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
        <div className="rounded-md border bg-muted/30 p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Preview (how players see it)</div>
          <NamePreview name={config.Name} />
          <div className="mt-2 text-[11px] text-muted-foreground">
            Plain text (for copy): <code>{stripColorCodes(config.Name) || "(empty)"}</code>
          </div>
        </div>
        {showColorPalette && (
          <div className="rounded-md border p-3 bg-card">
            <div className="text-xs text-muted-foreground mb-2">Click a color to insert its code at the cursor:</div>
            <div className="grid grid-cols-8 sm:grid-cols-12 gap-1.5">
              {BEAMMP_COLOR_CODES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setConfig({ Name: config.Name + c.code })}
                  className={cn(
                    "h-7 rounded-md border text-[10px] font-mono flex items-center justify-center",
                    "hover:scale-110 transition-transform",
                    c.code === "^r" && "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
                  )}
                  style={c.hex ? { backgroundColor: c.hex, color: getContrastColor(c.hex) } : undefined}
                  title={`${c.code} ${c.name}`}
                >
                  {c.code}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AuthKey */}
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="cfg-authkey" className="flex items-center gap-1.5">
          <Key className="h-3.5 w-3.5" /> AuthKey <span className="text-red-500">*</span>
        </Label>
        <Input
          id="cfg-authkey"
          type="password"
          value={config.AuthKey}
          onChange={(e) => setConfig({ AuthKey: e.target.value })}
          placeholder="Paste your key from keymaster.beammp.com"
          className={cn(!config.AuthKey && "border-red-500/50")}
        />
        <p className="text-[11px] text-muted-foreground">
          Required. Get yours at <a href="https://keymaster.beammp.com/" target="_blank" rel="noreferrer" className="underline text-foreground">keymaster.beammp.com</a>.
        </p>
      </div>

      {/* Port */}
      <div className="space-y-2">
        <Label htmlFor="cfg-port">Port</Label>
        <Input
          id="cfg-port"
          type="number"
          min={1}
          max={65535}
          value={config.Port}
          onChange={(e) => setConfig({ Port: Number(e.target.value) || 0 })}
        />
        <p className="text-[11px] text-muted-foreground">Default 30814. Both TCP and UDP must be tunneled.</p>
      </div>

      {/* MaxPlayers */}
      <div className="space-y-2">
        <Label htmlFor="cfg-maxplayers">Max Players</Label>
        <Input
          id="cfg-maxplayers"
          type="number"
          min={1}
          max={200}
          value={config.MaxPlayers}
          onChange={(e) => setConfig({ MaxPlayers: Number(e.target.value) || 1 })}
        />
      </div>

      {/* MaxCars */}
      <div className="space-y-2">
        <Label htmlFor="cfg-maxcars">Max Cars (per player)</Label>
        <Input
          id="cfg-maxcars"
          type="number"
          min={0}
          max={10}
          value={config.MaxCars}
          onChange={(e) => setConfig({ MaxCars: Number(e.target.value) || 0 })}
        />
        <p className="text-[11px] text-muted-foreground">Higher values impact server CPU and bandwidth.</p>
      </div>

      {/* Map */}
      <div className="space-y-2">
        <Label htmlFor="cfg-map">Map</Label>
        <Select value={mapKnown ? config.Map : "__custom__"} onValueChange={(v) => v !== "__custom__" && setConfig({ Map: v })}>
          <SelectTrigger id="cfg-map">
            <SelectValue placeholder="Select a map" />
          </SelectTrigger>
          <SelectContent>
            {COMMON_MAPS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
            <SelectItem value="__custom__">Custom path...</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={config.Map}
          onChange={(e) => setConfig({ Map: e.target.value })}
          placeholder="/levels/gridmap_v2/info.json"
          className="font-mono text-xs"
        />
        <p className="text-[11px] text-muted-foreground">
          {mapKnown ? findMapByValue(config.Map)?.description : "Custom or modded map path."}
        </p>
      </div>

      {/* Description */}
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="cfg-desc">Description</Label>
        <Textarea
          id="cfg-desc"
          value={config.Description}
          onChange={(e) => setConfig({ Description: e.target.value })}
          placeholder="My server"
          rows={2}
        />
      </div>

      {/* Tags */}
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="cfg-tags">Tags</Label>
        <Input
          id="cfg-tags"
          value={config.Tags}
          onChange={(e) => setConfig({ Tags: e.target.value })}
          placeholder="Freeroam,Modded"
        />
        <p className="text-[11px] text-muted-foreground">Comma-separated. Common: Freeroam, Modded, Racing, Derb.</p>
      </div>

      {/* Resource folder */}
      <div className="space-y-2">
        <Label htmlFor="cfg-resources">Resource Folder</Label>
        <Input
          id="cfg-resources"
          value={config.ResourceFolder}
          onChange={(e) => setConfig({ ResourceFolder: e.target.value })}
          placeholder="Resources"
        />
      </div>

      {/* Toggles */}
      <div className="space-y-3 md:col-span-2">
        <ToggleRow
          label="Private"
          description="Hide from the public server list. Players must direct-connect."
          checked={config.Private}
          onChange={(v) => setConfig({ Private: v })}
        />
        <ToggleRow
          label="Allow Guests"
          description="Let unauthenticated guests join without an account."
          checked={config.AllowGuests}
          onChange={(v) => setConfig({ AllowGuests: v })}
        />
        <ToggleRow
          label="Log Chat"
          description="Write all in-game chat messages to the log file."
          checked={config.LogChat}
          onChange={(v) => setConfig({ LogChat: v })}
        />
        <ToggleRow
          label="Debug"
          description="Enable verbose debug logging. Useful for troubleshooting."
          checked={config.Debug}
          onChange={(v) => setConfig({ Debug: v })}
        />
        <ToggleRow
          label="Information Packet"
          description="Respond to info-ping queries from the master server (recommended)."
          checked={config.InformationPacket}
          onChange={(v) => setConfig({ InformationPacket: v })}
        />
      </div>
    </div>
  );
}

function RawEditor({
  rawText,
  setRawText,
  applyRaw,
}: {
  rawText: string;
  setRawText: (v: string) => void;
  applyRaw: () => { ok: boolean; error?: string };
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Edit the raw TOML. Click <strong>Apply</strong> to parse it back into the form. Unknown sections are preserved.
        </p>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            const r = applyRaw();
            if (r.ok) toast.success("Raw TOML applied to form.");
            else toast.error(`Parse error: ${r.error}`);
          }}
        >
          Apply to form
        </Button>
      </div>
      <Textarea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        className="font-mono text-xs h-[480px]"
        spellCheck={false}
      />
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

function NamePreview({ name }: { name: string }) {
  const segments = parseColorCodedName(name);
  if (segments.length === 0) {
    return <span className="text-sm text-muted-foreground">(empty)</span>;
  }
  return (
    <div className="text-base font-semibold bg-zinc-950 rounded px-2 py-1.5 inline-block">
      {segments.map((seg, i) => (
        <span key={i} style={seg.hex ? { color: seg.hex } : undefined}>
          {seg.text}
        </span>
      ))}
    </div>
  );
}

function getContrastColor(hex: string): string {
  if (!hex) return "inherit";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#FFFFFF";
}

// Re-export for tests / external use
export { serializeServerConfig };
