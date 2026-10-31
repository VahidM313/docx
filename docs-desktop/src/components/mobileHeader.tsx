import * as React from "react";
import { useApp } from "../lib/store";
import { getBrand } from "../lib/catalog";
import {
  BookOpen,
  ChevronLeft,
  Library,
  RotateCw,
  Sun,
  Moon,
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
    <header className="box-content flex h-12 w-full shrink-0 items-center gap-1 border-b border-border bg-surface pt-[env(safe-area-inset-top,0px)] select-none shadow-xs">
      {/* Left: Back to Channels / Categories Navigation */}
      <button
        type="button"
        onClick={onOpenNav}
        className="ml-1.5 flex min-w-0 flex-1 items-center gap-1 h-10 px-1.5 rounded-lg hover:bg-accent text-foreground transition-colors cursor-pointer text-xs font-bold"
        aria-label="Back to Channels"
      >
        <ChevronLeft className="h-4 w-4 shrink-0 text-brand" />
        <span className="truncate">{brand ? brand.name : "Channels"}</span>
      </button>

      {/* Center: Font Size Stepper + Doc Theme Toggle */}
      <div className="flex shrink-0 items-center">
        {active?.siteId && (
          <>
            {/* Font Stepper */}
            <div className="flex items-center rounded-lg border border-border bg-background/80 p-0.5 text-xs text-foreground shadow-xs">
              <button
                type="button"
                onClick={() => app.stepDocFontSize(active.siteId, -1)}
                className="flex h-9 w-9 items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer font-bold text-[11px]"
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
                className="flex h-9 w-9 items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer font-bold text-[12px]"
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
              className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-accent text-foreground transition-colors cursor-pointer"
              aria-label="Toggle Doc Theme"
            >
              {isDarkDoc ? (
                <Moon className="h-4 w-4 text-brand" />
              ) : (
                <Sun className="h-4 w-4 text-warning" />
              )}
            </button>
          </>
        )}

        {/* Reload */}
        <button
          type="button"
          onClick={() => readerApi.current?.reload()}
          className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          aria-label="Reload Doc"
        >
          <RotateCw className="h-4 w-4" />
        </button>
      </div>

      {/* Right: Chrome-Style Tab Switcher Badge Button */}
      <button
        type="button"
        onClick={onOpenTabs}
        className="mr-1.5 flex shrink-0 items-center justify-center h-10 w-10 rounded-lg hover:bg-accent transition-colors cursor-pointer"
        aria-label={`Open tabs (${webTabs.length})`}
        title="Open tabs"
      >
        <span className="flex h-6 min-w-6 items-center justify-center rounded-md border-2 border-foreground/80 px-1 font-mono font-black text-xs text-foreground">
          {webTabs.length}
        </span>
      </button>
    </header>
  );
}

export type MobileRootScreen = "nav" | "library";

/** Mobile bottom navigation for the top-level screens. */
export function MobileNavBottomBar({
  active,
  onShowDocs,
  onShowLibrary,
  onOpenTabs,
}: {
  active: MobileRootScreen;
  onShowDocs: () => void;
  onShowLibrary: () => void;
  onOpenTabs: () => void;
}) {
  const app = useApp();
  const webTabs = app.tabs.filter((t) => t.siteId !== "home");

  const itemClass = (selected: boolean) =>
    "relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors cursor-pointer " +
    (selected ? "text-brand" : "text-muted-foreground active:text-foreground");

  return (
    <nav
      aria-label="Main"
      className="box-content flex h-14 w-full shrink-0 items-stretch border-t border-border bg-surface pb-[env(safe-area-inset-bottom,0px)] select-none shadow-sm z-30"
    >
      <button type="button" onClick={onShowDocs} className={itemClass(active === "nav")}>
        <BookOpen className="h-5 w-5" />
        <span>Docs</span>
      </button>
      <button type="button" onClick={onShowLibrary} className={itemClass(active === "library")}>
        <Library className="h-5 w-5" />
        <span>Library</span>
        {app.outdatedCount > 0 && (
          <span className="absolute top-1.5 left-1/2 ml-1.5 min-w-4 rounded-full bg-brand px-1 text-center text-[9px] font-bold leading-4 text-white">
            {app.outdatedCount}
          </span>
        )}
      </button>
      <button type="button" onClick={() => app.setPaletteOpen(true)} className={itemClass(false)}>
        <Search className="h-5 w-5" />
        <span>Search</span>
      </button>
      <button type="button" onClick={onOpenTabs} className={itemClass(false)} aria-label={`Open tabs (${webTabs.length})`}>
        <span className="flex h-5 min-w-5 items-center justify-center rounded border-2 border-current px-0.5 font-mono text-[10px] font-black">
          {webTabs.length}
        </span>
        <span>Tabs</span>
      </button>
      <button type="button" onClick={() => app.setSettingsOpen(true)} className={itemClass(false)}>
        <Settings className="h-5 w-5" />
        <span>Settings</span>
      </button>
    </nav>
  );
}
