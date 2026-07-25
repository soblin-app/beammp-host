"use client";

import { ReactNode } from "react";
import {
  LayoutDashboard,
  Server,
  Settings2,
  Package,
  Globe,
  Share2,
  Wand2,
  Wrench,
  Car,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBeamMPStore } from "@/lib/beammp/store";
import { ThemeToggle } from "./theme-toggle";
import type { ServerStatus, TunnelStatus } from "@/lib/beammp/types";

interface NavItem {
  id: BeamMPViewId;
  label: string;
  icon: typeof LayoutDashboard;
  description: string;
}

type BeamMPViewId =
  | "dashboard"
  | "server"
  | "config"
  | "mods"
  | "tunnel"
  | "join"
  | "wizard"
  | "settings";

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, description: "Overview of all systems" },
  { id: "server", label: "Server", icon: Server, description: "BeamMP-Server lifecycle & console" },
  { id: "config", label: "Config", icon: Settings2, description: "ServerConfig.toml editor" },
  { id: "mods", label: "Mods", icon: Package, description: "Resources/Client and Server" },
  { id: "tunnel", label: "Tunnel", icon: Globe, description: "playit.gg tunnel" },
  { id: "join", label: "Join Info", icon: Share2, description: "Shareable connect info" },
  { id: "wizard", label: "Setup Wizard", icon: Wand2, description: "First-run guided setup" },
  { id: "settings", label: "Settings", icon: Wrench, description: "Install dirs, updates, logs" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const activeView = useBeamMPStore((s) => s.activeView);
  const setActiveView = useBeamMPStore((s) => s.setActiveView);
  const serverStatus = useBeamMPStore((s) => s.serverStatus);
  const tunnelStatus = useBeamMPStore((s) => s.tunnelStatus);
  const configDirty = useBeamMPStore((s) => s.configDirty);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-sidebar/50 backdrop-blur-sm">
        <div className="flex h-16 items-center gap-3 border-b px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Car className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight">BeamMP Host</span>
            <span className="text-[11px] text-muted-foreground leading-tight">Local Server + playit.gg</span>
          </div>
        </div>

        <nav className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            const showDirtyDot = item.id === "config" && configDirty;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
                )}
                title={item.description}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                <span className="flex-1 text-left truncate">{item.label}</span>
                {showDirtyDot && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Unsaved changes" />
                )}
                {item.id === "server" && <StatusPill status={serverStatus} />}
                {item.id === "tunnel" && <TunnelPill status={tunnelStatus} />}
              </button>
            );
          })}
        </nav>

        <div className="border-t p-3">
          <div className="rounded-md bg-muted/40 p-3 text-[11px] text-muted-foreground">
            <p className="font-medium text-foreground/80 mb-1">Prototype build</p>
            <p>UI is fully interactive. Server &amp; agent processes are simulated; see README for desktop wrapping.</p>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="flex h-16 items-center gap-3 border-b px-4 md:px-6">
          {/* Mobile nav (compact) */}
          <div className="md:hidden">
            <MobileNav />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold truncate">
              {NAV_ITEMS.find((n) => n.id === activeView)?.label ?? "Dashboard"}
            </h1>
            <p className="text-xs text-muted-foreground truncate">
              {NAV_ITEMS.find((n) => n.id === activeView)?.description ?? ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <QuickStatusChip />
            <ThemeToggle />
          </div>
        </header>

        {/* Mobile horizontal nav */}
        <div className="md:hidden border-b overflow-x-auto">
          <div className="flex gap-1 p-2 min-w-max">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <Button
                  key={item.id}
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => setActiveView(item.id)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-xs">{item.label}</span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: ServerStatus }) {
  const colorMap: Record<ServerStatus, string> = {
    stopped: "bg-muted-foreground/40",
    starting: "bg-amber-500",
    running: "bg-emerald-500",
    stopping: "bg-amber-500",
    crashed: "bg-red-500",
  };
  return (
    <span
      className={cn("h-1.5 w-1.5 rounded-full", colorMap[status])}
      title={`Server: ${status}`}
    />
  );
}

function TunnelPill({ status }: { status: TunnelStatus }) {
  const colorMap: Record<TunnelStatus, string> = {
    disconnected: "bg-muted-foreground/40",
    needs_claim: "bg-amber-500",
    claiming: "bg-amber-500",
    connected: "bg-sky-500",
    tunnel_pending: "bg-amber-500",
    tunnel_ready: "bg-emerald-500",
    error: "bg-red-500",
  };
  return (
    <span
      className={cn("h-1.5 w-1.5 rounded-full", colorMap[status])}
      title={`Tunnel: ${status}`}
    />
  );
}

function QuickStatusChip() {
  const serverStatus = useBeamMPStore((s) => s.serverStatus);
  const tunnelStatus = useBeamMPStore((s) => s.tunnelStatus);
  const players = useBeamMPStore((s) => s.players);
  const config = useBeamMPStore((s) => s.config);
  const playersLabel = serverStatus === "running" ? `${players.length}/${config.MaxPlayers}` : "—";
  return (
    <div className="hidden sm:flex items-center gap-2">
      <Badge variant="outline" className="gap-1.5">
        <span className={cn("h-1.5 w-1.5 rounded-full", serverStatus === "running" ? "bg-emerald-500" : serverStatus === "crashed" ? "bg-red-500" : "bg-muted-foreground/40")} />
        Server: {serverStatus}
      </Badge>
      <Badge variant="outline" className="gap-1.5">
        <span className={cn("h-1.5 w-1.5 rounded-full", tunnelStatus === "tunnel_ready" ? "bg-emerald-500" : tunnelStatus === "disconnected" ? "bg-muted-foreground/40" : "bg-amber-500")} />
        Tunnel: {tunnelStatus}
      </Badge>
      <Badge variant="outline" className="gap-1.5">
        Players: {playersLabel}
      </Badge>
    </div>
  );
}

function MobileNav() {
  // Compact title-only for mobile; the horizontal nav below handles actual switching.
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
      <Car className="h-4 w-4 text-primary" />
    </div>
  );
}
