"use client";

import { useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Upload,
  Trash2,
  Package,
  FolderOpen,
  HardDrive,
  AlertCircle,
} from "lucide-react";
import { useBeamMPStore, formatBytes } from "@/lib/beammp/store";
import { cn } from "@/lib/utils";
import type { ModEntry } from "@/lib/beammp/types";
import { toast } from "sonner";

export function ModsPanel() {
  const mods = useBeamMPStore((s) => s.mods);
  const addMod = useBeamMPStore((s) => s.addMod);
  const toggleMod = useBeamMPStore((s) => s.toggleMod);
  const deleteMod = useBeamMPStore((s) => s.deleteMod);
  const config = useBeamMPStore((s) => s.config);
  const [activeFolder, setActiveFolder] = useState<"Client" | "Server">("Client");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clientMods = mods.filter((m) => m.folder === "Client");
  const serverMods = mods.filter((m) => m.folder === "Server");
  const visibleMods = activeFolder === "Client" ? clientMods : serverMods;

  const totalClientBytes = clientMods.reduce((s, m) => s + m.sizeBytes, 0);
  const totalServerBytes = serverMods.reduce((s, m) => s + m.sizeBytes, 0);

  const handleFiles = (files: FileList | null, folder: "Client" | "Server") => {
    if (!files) return;
    let added = 0;
    Array.from(files).forEach((file) => {
      // Accept .zip (BeamMP mods), allow others with a warning
      const isZip = /\.zip$/i.test(file.name);
      if (!isZip) {
        toast.warning(`${file.name} is not a .zip — BeamMP only loads .zip mods.`);
      }
      addMod({
        name: file.name,
        sizeBytes: file.size || Math.floor(Math.random() * 5_000_000) + 50_000,
        folder,
        enabled: true,
      });
      added += 1;
    });
    if (added > 0) {
      toast.success(`Added ${added} mod${added !== 1 ? "s" : ""} to Resources/${folder}.`);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files, activeFolder);
  };

  // "Add sample mod" button — simulates picking a file without a real file picker.
  const addSampleMod = (folder: "Client" | "Server") => {
    const samples = [
      { name: "krwn_grandmarshal.zip", sizeBytes: 4_320_000 },
      { name: "vehicle_sunburst_rx.zip", sizeBytes: 8_500_000 },
      { name: "map_jungle_rock_island.zip", sizeBytes: 22_800_000 },
      { name: "wheel_pack_bbs.zip", sizeBytes: 1_240_000 },
      { name: "physics_realistic.zip", sizeBytes: 980_000 },
      { name: "track_nurburgring.zip", sizeBytes: 16_200_000 },
    ];
    const sample = samples[Math.floor(Math.random() * samples.length)];
    addMod({ ...sample, folder, enabled: true });
    toast.success(`Added "${sample.name}" to Resources/${folder}.`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" /> Mods / Resources
          </CardTitle>
          <CardDescription>
            Drag-and-drop <code>.zip</code> mod files into <code>Resources/Client</code> (sent to players) or{" "}
            <code>Resources/Server</code> (server-side only).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Folder tabs */}
          <div className="flex gap-2">
            <FolderTab
              label="Client"
              icon={FolderOpen}
              count={clientMods.length}
              size={totalClientBytes}
              active={activeFolder === "Client"}
              onClick={() => setActiveFolder("Client")}
            />
            <FolderTab
              label="Server"
              icon={FolderOpen}
              count={serverMods.length}
              size={totalServerBytes}
              active={activeFolder === "Server"}
              onClick={() => setActiveFolder("Server")}
            />
          </div>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            className={cn(
              "rounded-lg border-2 border-dashed p-8 text-center transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/20",
            )}
          >
            <Upload className={cn("mx-auto mb-3 h-10 w-10", dragOver ? "text-primary" : "text-muted-foreground/60")} />
            <p className="text-sm font-medium">
              Drop .zip mods here to install into <code>Resources/{activeFolder}</code>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Or use the file picker below. Files are copied to your BeamMP-Server install directory.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" /> Choose files
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => addSampleMod(activeFolder)}
              >
                <Package className="mr-1.5 h-3.5 w-3.5" /> Add sample mod
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files, activeFolder);
                e.target.value = "";
              }}
            />
          </div>

          {/* Mods list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">
                {activeFolder === "Client" ? "Client Mods" : "Server Mods"} ({visibleMods.length})
              </h3>
              {visibleMods.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  Total size: {formatBytes(activeFolder === "Client" ? totalClientBytes : totalServerBytes)}
                </span>
              )}
            </div>
            {visibleMods.length === 0 ? (
              <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
                <Package className="mx-auto mb-2 h-8 w-8 opacity-40" />
                No {activeFolder.toLowerCase()} mods installed.
                <p className="mt-1 text-xs">Drop .zip files above to get started.</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-2">
                <div className="space-y-2">
                  {visibleMods.map((mod) => (
                    <ModRow
                      key={mod.id}
                      mod={mod}
                      onToggle={() => toggleMod(mod.id)}
                      onDelete={() => {
                        if (confirm(`Delete "${mod.name}"? This removes the file from Resources/${mod.folder}.`)) {
                          deleteMod(mod.id);
                          toast.info(`Deleted "${mod.name}".`);
                        }
                      }}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How BeamMP Mods Work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground/80">Resources/Client</strong> — Mods that get streamed to every player who joins.
            Use this for new vehicles, maps, wheels, and props. Players download these automatically on connect.
          </p>
          <p>
            <strong className="text-foreground/80">Resources/Server</strong> — Mods loaded only by the server itself.
            Use this for gameplay plugins, Lua scripts, and server-side configuration packs.
          </p>
          <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Mod changes only take effect after a server restart. Disabled mods are kept on disk but skipped during loading.
              Large client mods increase join time — keep an eye on file sizes.
            </p>
          </div>
          <p className="mt-3 text-xs">
            Install path: <code>{config.ResourceFolder}/{activeFolder}/</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function FolderTab({
  label,
  icon: Icon,
  count,
  size,
  active,
  onClick,
}: {
  label: string;
  icon: typeof FolderOpen;
  count: number;
  size: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 rounded-md border p-3 text-left transition-colors",
        active ? "border-primary bg-primary/5" : "hover:bg-muted/40",
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
        <span className="text-sm font-medium">Resources/{label}</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {count} mod{count !== 1 ? "s" : ""} · {formatBytes(size)}
      </div>
    </button>
  );
}

function ModRow({
  mod,
  onToggle,
  onDelete,
}: {
  mod: ModEntry;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
        <HardDrive className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="truncate text-sm font-medium font-mono">{mod.name}</div>
        <div className="text-[11px] text-muted-foreground">
          {formatBytes(mod.sizeBytes)} · added {new Date(mod.addedAt).toLocaleDateString()}
        </div>
      </div>
      <Badge variant="outline" className={cn(mod.enabled ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
        {mod.enabled ? "Enabled" : "Disabled"}
      </Badge>
      <Switch checked={mod.enabled} onCheckedChange={onToggle} />
      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
