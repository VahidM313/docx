import * as React from "react";
import { useApp } from "../lib/store";
import { getBrand } from "../lib/catalog";
import { Tooltip } from "../ui";
import {
  Menu,
  ChevronLeft,
  RotateCw,
  Sun,
  Moon,
  Layers,
  Search,
  Settings,
} from "lucide-react";
import { type ReaderPanelsApi } from "./readerPanels";

/** Mobile Reader Top App Bar (Pure mobile, zero desktop controls) */
export function MobileReaderHeader({
  readerApi,
  onOpenNav,
  onOpenTabs,
}: {
  readerApi: React.RefObject<ReaderPanelsApi | null>;
  onOpenNav: () => void;
  onOpenTabs: () => void;
}) {
  const app = useApp();
  const active = app.activeTab;
  const brand = active?.siteId ? getBrand(active.siteId) : null;
  const webTabs = app.tabs.filter((t) => t.siteId !== "home");
  const isDarkDoc = active?.siteId ? app.effectiveSiteDark(active.siteId) : app.isDark;

  return (
    <header className="flex h-12 w-full shrink-0 items-center justify-between border-b border-border bg-surface px-2.5 pt-[env(safe-area-inset-top,0px)] select-none shadow-xs">
      {/* Left: Back to Channels / Categories Navigation */}
      <button
        type="button"
        onClick={onOpenNav}
        className="flex items-center gap-1.5 h-8 px-2 rounded-lg bg-accent/60 hover:bg-accent text-foreground transition-colors cursor-pointer text-xs font-bold max-w-[150px] truncate"
        aria-label="Back to Channels"
      >
        <ChevronLeft className="h-4 w-4 shrink-0 text-brand" />
        <span className="truncate">{brand ? brand.name : "Channels"}</span>
      </button>

      {/* Center: Font Size Stepper + Doc Theme Toggle */}
      <div className="flex items-center gap-1">
        {active?.siteId && (
          <>
            {/* Font Stepper */}
            <div className="flex items-center rounded-lg border border-border bg-background/80 p-0.5 text-xs text-foreground shadow-xs">
              <button
                type="button"
                onClick={() => app.stepDocFontSize(active.siteId, -1)}
                className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer font-bold text-[11px]"
                aria-label="Decrease Font Size"
              >
                A-
              </button>
              <span className="px-1 font-mono font-bold text-[10px] text-foreground">
                {app.getDocPrefs(active.siteId).fontSize}
              </span>
              <button
                type="button"
                onClick={() => app.stepDocFontSize(active.siteId, 1)}
                className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer font-bold text-[12px]"
                aria-label="Increase Font Size"
              >
                A+
              </button>
            </div>

            {/* Doc Theme Toggle */}
            <button
              type="button"
              onClick={() => {
                app.toggleSiteDark(active.siteId);
                readerApi.current?.toggleDark(active.siteId);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background/80 hover:bg-accent text-foreground transition-colors cursor-pointer shadow-xs"
              aria-label="Toggle Doc Theme"
            >
              {isDarkDoc ? (
                <Moon className="h-3.5 w-3.5 text-brand" />
              ) : (
                <Sun className="h-3.5 w-3.5 text-warning" />
              )}
            </button>
          </>
        )}

        {/* Reload */}
        <button
          type="button"
          onClick={() => readerApi.current?.reload()}
          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          aria-label="Reload Doc"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Right: Chrome-Style Tab Switcher Badge Button */}
      <button
        type="button"
        onClick={onOpenTabs}
        className="flex items-center justify-center h-7 min-w-[28px] px-1.5 rounded-lg border-2 border-foreground/80 bg-background text-foreground font-mono font-black text-xs hover:bg-accent transition-colors cursor-pointer shadow-xs"
        aria-label={`Open tabs (${webTabs.length})`}
        title="Open tabs"
      >
        <span>{webTabs.length}</span>
      </button>
    </header>
  );
}

/** Mobile Navigation Bottom Bar (Shown when in Domain Rail + Channel Sidebar view) */
export function MobileNavBottomBar({
  onOpenTabs,
}: {
  onOpenTabs: () => void;
}) {
  const app = useApp();
  const webTabs = app.tabs.filter((t) => t.siteId !== "home");

  return (
    <footer className="flex h-12 w-full shrink-0 items-center justify-between border-t border-border bg-surface px-4 pb-[env(safe-area-inset-bottom,0px)] select-none shadow-sm z-30">
      {/* Left: Quick Search */}
      <button
        type="button"
        onClick={() => app.setPaletteOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search docs</span>
      </button>

      {/* Right: Chrome-style Tab Switcher + Settings */}
      <div className="flex items-center gap-2">
        {/* Settings button */}
        <button
          type="button"
          onClick={() => app.setSettingsOpen(true)}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>

        {/* Chrome-Style Tab Switcher Badge Button */}
        <button
          type="button"
          onClick={onOpenTabs}
          className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-brand text-white font-semibold text-xs shadow-xs hover:bg-brand-hover transition-colors cursor-pointer"
          aria-label="View Open Tabs"
        >
          <div className="h-4 w-4 rounded border border-white flex items-center justify-center font-mono font-black text-[10px]">
            {webTabs.length}
          </div>
          <span>Tabs</span>
        </button>
      </div>
    </footer>
  );
}
