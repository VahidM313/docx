import * as React from "react";
import { useApp } from "../lib/store";
import { Tauri } from "../lib/tauri";
import { getBrand, getAdaptiveBrandColor, getAdaptiveSiteSvg } from "../lib/catalog";
import { Tooltip } from "../ui";
import {
  Hash,
  Menu,
  ExternalLink,
  RotateCw,
  Minus,
  Square,
  X,
  Compass,
  PanelLeftOpen,
  PanelRight,
  Plus,
  Type,
  Sun,
  Moon,
  Sparkles,
} from "lucide-react";
import { type ReaderPanelsApi } from "./readerPanels";

export function DiscordHeader({
  readerApi,
  onMobileMenu,
}: {
  readerApi: React.RefObject<ReaderPanelsApi | null>;
  onMobileMenu?: () => void;
}) {
  const app = useApp();
  const active = app.activeTab;
  const isReader = active != null && active.siteId !== "home";
  const brand = active?.siteId ? getBrand(active.siteId) : null;
  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  const title = isReader ? brand!.name : "Home Hub";
  const channelName = isReader ? title.toLowerCase().replace(/\s+/g, "-") : "welcome";
  const webTabs = app.tabs.filter((t) => t.siteId !== "home");

  return (
    <header className="drag-region relative z-30 flex h-12 w-full shrink-0 items-center justify-between border-b border-border bg-background px-3 select-none shadow-sm">
      {/* Left: Mobile Menu + Channel Header Info */}
      <div className="no-drag flex items-center gap-2 min-w-0">
        {/* Mobile Hamburger Menu (visible on < md) */}
        <button
          type="button"
          onClick={onMobileMenu}
          className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground md:hidden transition-colors"
          aria-label="Open Discord menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Desktop Sidebar Toggle when closed */}
        {!app.sidebarOpen && (
          <Tooltip label="Open Docs Sidebar" side="bottom">
            <button
              type="button"
              onClick={() => app.setSidebarOpen(true)}
              className="hidden md:flex p-1.5 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              aria-label="Open Docs Sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </Tooltip>
        )}

        {/* Tabs / Channel Header Info:
            If Doc Navigation (vertical tabs) is open, show clean single doc title;
            If Doc Navigation is closed, show Horizontal Tabs bar ("only one at a time horizontal or vertical") */}
        {app.memberOutlineOpen ? (
          <div className="flex items-center gap-1.5 text-foreground font-semibold text-sm min-w-0">
            {isReader ? (
              <Hash className="h-4 w-4 text-muted-foreground/80 shrink-0" />
            ) : (
              <Compass className="h-4 w-4 text-brand shrink-0" />
            )}
            <span className="truncate">{channelName}</span>
            {isReader && brand?.description && (
              <>
                <span className="h-4 w-[1px] bg-border mx-1 hidden sm:block shrink-0" />
                <span className="text-xs text-muted-foreground truncate max-w-[280px] lg:max-w-[420px] hidden sm:block font-normal">
                  {brand.description}
                </span>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-[55vw] lg:max-w-[65vw] py-0.5">
            {/* Welcome / Hub Tab */}
            <button
              type="button"
              onClick={() => {
                app.setSelectedCategory("home");
                app.goHome();
              }}
              className={
                "group relative flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs transition-colors shrink-0 cursor-pointer " +
                (app.activeTabId === "home"
                  ? "bg-accent text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:bg-accent/40 hover:text-foreground")
              }
            >
              <Compass className="h-3.5 w-3.5 text-brand shrink-0" />
              <span>Welcome</span>
            </button>

            {/* Open Documentation Tabs */}
            {webTabs.map((tab) => {
              const b = getBrand(tab.siteId);
              const isTabActive = app.activeTabId === tab.id;
              const adaptiveColor = getAdaptiveBrandColor(b.color, app.isDark);
              const adaptiveSvg = getAdaptiveSiteSvg(b, app.isDark);

              return (
                <div
                  key={tab.id}
                  onClick={() => app.activateTab(tab.id)}
                  onAuxClick={(e) => {
                    if (e.button === 1) {
                      e.preventDefault();
                      app.closeTab(tab.id);
                    }
                  }}
                  className={
                    "group relative flex items-center gap-2 h-8 px-2.5 rounded-md text-xs transition-colors shrink-0 cursor-pointer max-w-[190px] " +
                    (isTabActive
                      ? "bg-accent text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:bg-accent/40 hover:text-foreground")
                  }
                  title={tab.title ?? b.name}
                >
                  {/* Brand SVG icon */}
                  <div
                    className="h-3.5 w-3.5 shrink-0 flex items-center justify-center [&_svg]:h-3.5 [&_svg]:w-3.5"
                    style={{ color: adaptiveColor }}
                    dangerouslySetInnerHTML={{ __html: adaptiveSvg }}
                  />

                  <span className="truncate">
                    {tab.title ?? b.name}
                  </span>

                  {/* Close Button X */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      app.closeTab(tab.id);
                    }}
                    className="opacity-40 group-hover:opacity-100 hover:bg-surface-deep p-0.5 rounded transition-opacity"
                    title="Close tab (Ctrl+W)"
                    aria-label={`Close ${tab.title ?? b.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}

            {/* Plus button to open search / quick open */}
            <Tooltip label="Open new doc (Ctrl+K)" side="bottom">
              <button
                type="button"
                onClick={() => app.setPaletteOpen(true)}
                className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0 cursor-pointer"
                aria-label="Open doc"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          </div>
        )}
      </div>

      {/* Right: Quick Action Controls + Window Buttons */}
      <div className="no-drag flex items-center gap-1.5 shrink-0 text-muted-foreground">
        {/* Document Font Size Stepper Control */}
        {isReader && active?.siteId && (
          <div className="no-drag flex items-center rounded-lg border border-border bg-surface/90 p-0.5 text-xs text-foreground shadow-xs mr-1">
            <Tooltip label="Decrease Doc Font Size (-1px)" side="bottom">
              <button
                type="button"
                onClick={() => app.stepDocFontSize(active.siteId, -1)}
                className="no-drag flex h-6 w-6 items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Decrease Font Size"
              >
                <span className="font-bold text-[11px]">A-</span>
              </button>
            </Tooltip>

            <Tooltip label={`Doc Font Size: ${app.getDocPrefs(active.siteId).fontSize}px (Click for Preferences)`} side="bottom">
              <button
                type="button"
                onClick={() => app.setSettingsOpen(true)}
                className="no-drag px-1.5 h-6 flex items-center justify-center text-[11px] font-mono font-bold text-foreground hover:bg-accent rounded transition-colors cursor-pointer"
              >
                {app.getDocPrefs(active.siteId).fontSize}px
              </button>
            </Tooltip>

            <Tooltip label="Increase Doc Font Size (+1px)" side="bottom">
              <button
                type="button"
                onClick={() => app.stepDocFontSize(active.siteId, 1)}
                className="no-drag flex h-6 w-6 items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Increase Font Size"
              >
                <span className="font-bold text-[13px]">A+</span>
              </button>
            </Tooltip>
          </div>
        )}

        {/* Override Doc Theme / Match App Theme Toggle */}
        {isReader && active?.siteId && (
          <Tooltip
            label={
              app.overrideDocTheme
                ? `Doc Theme: Matching App Theme (${app.isDark ? "Dark" : "Light"}) • Click to allow individual doc themes`
                : "Doc Theme: Custom • Click to override and match App Theme"
            }
            side="bottom"
          >
            <button
              type="button"
              onClick={() => app.toggleOverrideDocTheme()}
              className={
                "no-drag flex items-center gap-1.5 px-2 h-7 rounded-lg border text-xs font-semibold transition-all cursor-pointer shadow-xs mr-1 " +
                (app.overrideDocTheme
                  ? "border-brand/70 bg-brand/15 text-brand hover:bg-brand/25"
                  : "border-border bg-surface/90 hover:bg-accent text-muted-foreground hover:text-foreground")
              }
              aria-label="Override Doc Theme to Match App"
            >
              <Sparkles className={"h-3.5 w-3.5 " + (app.overrideDocTheme ? "text-brand" : "text-muted-foreground")} />
              <span className="hidden sm:inline text-[11px]">
                {app.overrideDocTheme ? "Match App" : "Match App"}
              </span>
            </button>
          </Tooltip>
        )}

        {/* Document Theme Toggle (Light vs Dark for active document) */}
        {isReader && active?.siteId && (
          <Tooltip
            label={
              app.overrideDocTheme
                ? `Active Doc Theme: ${app.effectiveSiteDark(active.siteId) ? "Dark" : "Light"} (controlled by Match App • Click to switch both)`
                : `Active Doc Theme: ${app.effectiveSiteDark(active.siteId) ? "Dark" : "Light"} (Click to switch)`
            }
            side="bottom"
          >
            <button
              type="button"
              onClick={() => {
                if (app.overrideDocTheme) {
                  app.setThemeMode(app.isDark ? "light" : "dark");
                } else {
                  app.toggleSiteDark(active.siteId);
                  readerApi.current?.toggleDark(active.siteId);
                }
              }}
              className="no-drag flex items-center gap-1.5 px-2 h-7 rounded-lg border border-border bg-surface/90 hover:bg-accent text-foreground transition-colors cursor-pointer text-xs font-semibold shadow-xs mr-1"
              aria-label="Toggle Doc Theme"
            >
              {app.effectiveSiteDark(active.siteId) ? (
                <>
                  <Moon className="h-3.5 w-3.5 text-brand" />
                  <span className="hidden sm:inline text-[11px]">Dark</span>
                </>
              ) : (
                <>
                  <Sun className="h-3.5 w-3.5 text-warning" />
                  <span className="hidden sm:inline text-[11px]">Light</span>
                </>
              )}
            </button>
          </Tooltip>
        )}

        {/* Toggle Right Doc Navigation (Vertical Tabs & Outline) */}
        <Tooltip
          label={app.memberOutlineOpen ? "Hide Doc Navigation (Vertical Tabs)" : "Show Doc Navigation (Vertical Tabs)"}
          side="bottom"
        >
          <button
            type="button"
            onClick={() => app.setMemberOutlineOpen((v) => !v)}
            className={
              "no-drag p-1.5 rounded hover:bg-accent hover:text-foreground transition-colors cursor-pointer " +
              (app.memberOutlineOpen ? "bg-accent text-foreground" : "")
            }
            aria-label="Toggle Doc Navigation"
          >
            <PanelRight className="h-4 w-4" />
          </button>
        </Tooltip>

        {/* External Web Origin Link */}
        {isReader && brand?.origin && (
          <Tooltip label={`Open Online Site (${brand.name})`} side="bottom">
            <button
              type="button"
              onClick={() => {
                let targetUrl = brand.origin!;
                if (active?.pathOrUrl) {
                  try {
                    if (active.pathOrUrl.startsWith("http")) {
                      const u = new URL(active.pathOrUrl);
                      targetUrl = `${brand.origin}${u.pathname}${u.search}${u.hash}`;
                    } else {
                      const cleanPath = active.pathOrUrl.startsWith("/")
                        ? active.pathOrUrl
                        : `/${active.pathOrUrl}`;
                      targetUrl = `${brand.origin}${cleanPath}`;
                    }
                  } catch {}
                }
                Tauri.openBrowser(targetUrl);
              }}
              className="no-drag p-1.5 rounded hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
              aria-label="Open Online Site"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
          </Tooltip>
        )}

        {/* Refresh Active Page */}
        {isReader && (
          <Tooltip label="Reload Page" side="bottom">
            <button
              type="button"
              onClick={() => readerApi.current?.reload()}
              className="no-drag p-1.5 rounded hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
              aria-label="Reload Doc"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          </Tooltip>
        )}

        {/* Native Tauri Window Controls */}
        {isTauri && (
          <div className="no-drag flex items-center h-full ml-1 border-l border-border pl-1">
            <button
              type="button"
              onClick={() => Tauri.windowMinimize()}
              className="no-drag flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
              aria-label="Minimize"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => Tauri.windowToggleMaximize()}
              className="no-drag flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
              aria-label="Maximize"
            >
              <Square className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => Tauri.windowClose()}
              className="no-drag flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-danger hover:text-white transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
