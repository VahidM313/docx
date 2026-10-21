import * as React from "react";
import { useApp } from "../lib/store";
import { getBrand, getAdaptiveBrandColor, getAdaptiveSiteSvg, type SiteBrand } from "../lib/catalog";
import { Tooltip } from "../ui";
import {
  Hash,
  Sparkles,
  CheckCircle2,
  DownloadCloud,
  Star,
  X,
  PanelRight,
  Sun,
  Moon,
  Palette,
} from "lucide-react";

export function MemberOutline() {
  const app = useApp();
  const [isHovered, setIsHovered] = React.useState(false);
  const [hoveredTabId, setHoveredTabId] = React.useState<string | null>(null);
  const leaveTimer = React.useRef<number | null>(null);

  const active = app.activeTab;
  const isReader = active != null && active.siteId !== "home";
  const brand = active?.siteId ? getBrand(active.siteId) : null;
  const entry = active?.siteId ? app.entries.find((e) => e.id === active.siteId) : null;
  const webTabs = app.tabs.filter((t) => t.siteId !== "home");

  const docBookmarks = React.useMemo(() => {
    if (!active?.siteId) return [];
    return app.bookmarks.filter((b) => b.siteId === active.siteId);
  }, [app.bookmarks, active?.siteId]);

  const handleMouseEnter = () => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
    }
    leaveTimer.current = window.setTimeout(() => {
      setIsHovered(false);
    }, 120);
  };

  React.useEffect(() => {
    return () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, []);

  if (!app.memberOutlineOpen) return null;

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={
        "hidden lg:flex flex-col h-full shrink-0 border-l border-border bg-surface select-none overflow-hidden discord-vertical-tabs-transition z-20 " +
        (isHovered ? "w-[260px] shadow-lift" : "w-[52px]")
      }
    >
      {/* 1. Header with Fixed 52px icon slot + smoothly revealed title */}
      <div className="h-12 border-b border-border flex items-center shrink-0 overflow-hidden relative w-full">
        {/* Centered PanelRight icon in the 52px zone */}
        <div className="w-[52px] h-12 flex items-center justify-center shrink-0">
          <PanelRight className="h-4 w-4 text-muted-foreground" />
        </div>
        {/* Title and tabs count revealed as width expands */}
        <div
          className={
            "flex items-center justify-between flex-1 pr-3 min-w-0 transition-opacity duration-200 " +
            (isHovered ? "opacity-100" : "opacity-0 pointer-events-none")
          }
        >
          <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground truncate">
            {isReader ? "Doc Navigation" : "Workspace Hub"}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
            {webTabs.length > 0 ? `${webTabs.length} tabs` : "overview"}
          </span>
        </div>
      </div>

      {/* 2. Scrollable Body: Full-width items with indicator pinned to right edge */}
      <div className="flex-1 overflow-y-auto no-scrollbar w-full py-2">
        {/* Open Tabs List */}
        <div className="space-y-1 w-full">
          {webTabs.map((tab) => {
            const b = getBrand(tab.siteId);
            const isTabActive = app.activeTabId === tab.id;
            const adaptiveColor = getAdaptiveBrandColor(b.color, app.isDark);
            const adaptiveSvg = getAdaptiveSiteSvg(b, app.isDark);
            const isHoveredTab = hoveredTabId === tab.id;

            return (
              <div
                key={tab.id}
                onClick={() => app.activateTab(tab.id)}
                onMouseEnter={() => setHoveredTabId(tab.id)}
                onMouseLeave={() => setHoveredTabId(null)}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    app.closeTab(tab.id);
                  }
                }}
                className="group relative flex items-center h-10 w-full cursor-pointer select-none"
              >
                {/* Active Indicator on the RIGHT Edge (Always visible & glides smoothly with rail width!) */}
                <span
                  className={
                    "vertical-tab-pill " +
                    (isTabActive
                      ? "discord-pill-active"
                      : isHoveredTab
                      ? "discord-pill-hover"
                      : "discord-pill-idle")
                  }
                />

                {/* Inner Tab Card Container */}
                <div
                  className={
                    "flex items-center h-10 flex-1 mx-1.5 rounded-lg transition-colors overflow-hidden " +
                    (isTabActive
                      ? "bg-accent/80 text-foreground shadow-xs"
                      : "hover:bg-accent/40 text-muted-foreground hover:text-foreground")
                  }
                >
                  {/* Fixed Icon Slot (Centered at x=26px in the 52px rail) */}
                  <div className="w-[41px] h-10 flex items-center justify-center shrink-0">
                    <Tooltip label={tab.title ?? b.name} side="left" disabled={isHovered}>
                      <div
                        className={
                          "w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105 " +
                          (isTabActive ? "bg-surface shadow-xs" : "bg-transparent")
                        }
                      >
                        <div
                          className="w-4 h-4 flex items-center justify-center [&_svg]:w-4 [&_svg]:h-4"
                          style={{ color: adaptiveColor }}
                          dangerouslySetInnerHTML={{ __html: adaptiveSvg }}
                        />
                      </div>
                    </Tooltip>
                  </div>

                  {/* Tab Title & Close Button (Revealed smoothly as width expands) */}
                  <div
                    className={
                      "flex-1 min-w-0 flex items-center justify-between pr-2 overflow-hidden whitespace-nowrap transition-opacity duration-200 " +
                      (isHovered ? "opacity-100" : "opacity-0 pointer-events-none")
                    }
                  >
                    <span className="truncate text-xs font-semibold">{tab.title ?? b.name}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        app.closeTab(tab.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:bg-surface-deep p-1 rounded transition-opacity"
                      title="Close tab (Ctrl+W)"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Expanded Details Pane (Doc Identity Card, Sections, Bookmarks) */}
        <div
          className={
            "w-[244px] mx-2 mt-3 space-y-3 transition-all duration-300 " +
            (isHovered
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-2 pointer-events-none")
          }
        >
          {isReader && brand ? (
            <>
              {/* Doc Identity Card */}
              <div className="rounded-lg border border-border bg-background p-3 shadow-xs space-y-2">
                <div className="flex items-center gap-2">
                  <div
                    className="h-8 w-8 rounded-md flex items-center justify-center p-1.5 shrink-0"
                    style={{ backgroundColor: brand.bgTint || "var(--accent)" }}
                    dangerouslySetInnerHTML={{ __html: getAdaptiveSiteSvg(brand, app.isDark) }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-foreground truncate">{brand.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{brand.category}</div>
                  </div>
                </div>

                {brand.description && (
                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
                    {brand.description}
                  </p>
                )}

                <div className="flex items-center gap-1.5 pt-1 text-[10px]">
                  {entry?.installed ? (
                    <span className="flex items-center gap-1 text-success font-semibold">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Downloaded offline</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <DownloadCloud className="h-3 w-3" />
                      <span>Online package</span>
                    </span>
                  )}
                </div>

                {/* Choose Doc Theme */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px]">
                  <span className="text-muted-foreground font-medium flex items-center gap-1">
                    <Palette className="h-3 w-3 text-brand" />
                    <span>Doc Theme:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => app.toggleSiteDark(brand.id)}
                    className="flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-foreground hover:bg-surface-deep transition-colors cursor-pointer"
                  >
                    {app.effectiveSiteDark(brand.id) ? (
                      <>
                        <Moon className="h-2.5 w-2.5 text-brand" />
                        <span>Dark</span>
                      </>
                    ) : (
                      <>
                        <Sun className="h-2.5 w-2.5 text-warning" />
                        <span>Light</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Quick section routes */}
              {brand.defaultRoutes && brand.defaultRoutes.length > 0 && (
                <div className="space-y-1">
                  <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Quick Sections
                  </div>
                  <div className="space-y-0.5">
                    {brand.defaultRoutes.map((route) => {
                      const isSelected = active.pathOrUrl === route.path;
                      return (
                        <button
                          key={route.path}
                          type="button"
                          onClick={() => app.openSite(brand.id, route.path)}
                          className={
                            "flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-left transition-colors cursor-pointer " +
                            (isSelected
                              ? "bg-accent text-foreground font-semibold"
                              : "text-muted-foreground hover:bg-accent/40 hover:text-foreground")
                          }
                        >
                          <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{route.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Bookmarks for this doc */}
              {docBookmarks.length > 0 && (
                <div className="space-y-1">
                  <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>Pinned in this Doc</span>
                    <span className="text-[9px] font-normal">{docBookmarks.length}</span>
                  </div>
                  <div className="space-y-0.5">
                    {docBookmarks.map((bm) => (
                      <button
                        key={bm.id}
                        type="button"
                        onClick={() => app.openSite(brand.id, bm.pathOrUrl)}
                        className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground truncate transition-colors text-left cursor-pointer"
                      >
                        <Star className="h-3 w-3 text-warning fill-current shrink-0" />
                        <span className="truncate">{bm.title || bm.pathOrUrl}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Hub view state */
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-background p-3 shadow-xs space-y-2">
                <div className="font-bold text-xs text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-brand" />
                  <span>Docx Library</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Only your installed docs appear on the left rail. Hover here to inspect open tabs.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
