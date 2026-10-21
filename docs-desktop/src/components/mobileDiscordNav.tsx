import * as React from "react";
import { useApp } from "../lib/store";
import { DomainRail } from "./domainRail";
import { ChannelSidebar } from "./channelSidebar";
import {
  Compass,
  Search,
  Settings,
  MessageSquare,
  BookOpen,
  Layers,
} from "lucide-react";

export function MobileDiscordDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden animate-fade-in select-none">
      {/* Backdrop overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer content: Domain Rail + Channel Sidebar side by side */}
      <div className="relative h-full w-[312px] max-w-[88vw] flex bg-background-deep shadow-lift animate-slide-right">
        {/* Domain Rail inside drawer */}
        <DomainRail onNavigate={onClose} />

        {/* Channel Sidebar inside drawer */}
        <div className="flex-1 h-full min-w-0">
          <ChannelSidebar onNavigate={onClose} />
        </div>
      </div>
    </div>
  );
}

export function MobileDiscordBottomBar({
  onOpenDrawer,
}: {
  onOpenDrawer: () => void;
}) {
  const app = useApp();

  return (
    <nav className="flex h-12 w-full items-center justify-around border-t border-border bg-background-deep px-2 md:hidden shrink-0 z-20 safe-bottom select-none">
      {/* 1. Servers / Category Drawer */}
      <button
        type="button"
        onClick={onOpenDrawer}
        className="flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-foreground active:text-brand transition-colors py-1 px-3"
      >
        <Layers className="h-5 w-5" />
        <span className="text-[10px] font-semibold">Categories</span>
      </button>

      {/* 2. Direct Docs / Home */}
      <button
        type="button"
        onClick={() => {
          app.setSelectedCategory("home");
          app.goHome();
        }}
        className={
          "flex flex-col items-center justify-center gap-0.5 py-1 px-3 transition-colors " +
          (app.activeTabId === "home" ? "text-brand font-bold" : "text-muted-foreground hover:text-foreground")
        }
      >
        <Compass className="h-5 w-5" />
        <span className="text-[10px] font-semibold">Docs Hub</span>
      </button>

      {/* 3. Search */}
      <button
        type="button"
        onClick={() => app.setPaletteOpen(true)}
        className="flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-foreground active:text-brand transition-colors py-1 px-3"
      >
        <Search className="h-5 w-5" />
        <span className="text-[10px] font-semibold">Search</span>
      </button>

      {/* 4. Settings */}
      <button
        type="button"
        onClick={() => app.setSettingsOpen(true)}
        className="flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-foreground active:text-brand transition-colors py-1 px-3"
      >
        <Settings className="h-5 w-5" />
        <span className="text-[10px] font-semibold">Settings</span>
      </button>
    </nav>
  );
}
