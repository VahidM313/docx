import * as React from "react";
import { useApp } from "../lib/store";
import { SITE_MAP, EMBEDDED_SITE_IDS, getAdaptiveBrandColor, getAdaptiveSiteSvg, type SiteBrand } from "../lib/catalog";
import { Tooltip } from "../ui";
import {
  Sun,
  Moon,
  Bookmark,
  Search,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
} from "lucide-react";

export function DomainRail({ onNavigate }: { onNavigate?: () => void }) {
  const app = useApp();
  const [hoveredItem, setHoveredItem] = React.useState<string | null>(null);

  // Only show installed documentation packs on the domain rail
  const installedDocs = React.useMemo(() => {
    const list = app.entries.filter((e) => e.installed).map((e) => e.brand);
    // If no packs are marked installed yet, fall back to embedded packs as default starting icons
    if (list.length === 0) {
      return EMBEDDED_SITE_IDS.map((id) => SITE_MAP[id]).filter(Boolean);
    }
    return list;
  }, [app.entries]);

  const isHomeActive = app.activeTabId === "home" && app.selectedCategory === "home";

  return (
    <aside
      className="relative flex h-full w-[72px] shrink-0 flex-col items-center border-r border-border bg-rail py-3 select-none z-20"
      onMouseLeave={() => setHoveredItem(null)}
    >
      {/* 1. App Logo Button - Transparent background, pure white rosette logo */}
      <div
        className="relative flex items-center justify-center w-full"
        onMouseEnter={() => setHoveredItem("home")}
        onMouseLeave={() => setHoveredItem(null)}
      >
        <span
          className={
            "discord-pill " +
            (isHomeActive
              ? "discord-pill-active"
              : hoveredItem === "home"
              ? "discord-pill-hover"
              : "discord-pill-unread")
          }
        />
        <Tooltip label="Docx Hub / Home" side="right">
          <button
            type="button"
            onClick={() => {
              app.setSelectedCategory("home");
              app.goHome();
              onNavigate?.();
            }}
            className="discord-server-btn group bg-transparent hover:opacity-85 active:opacity-70 transition-opacity"
            aria-label="Docx Hub / Home"
          >
            <img
              src="/logo.png"
              alt="Docx Logo"
              className="h-9 w-9 object-contain logo-glyph transition-transform group-hover:scale-105"
              draggable={false}
            />
          </button>
        </Tooltip>
      </div>

      {/* 2. Server Divider */}
      <div className="my-2 h-[2px] w-8 rounded bg-border-strong/60" />

      {/* 3. Installed Docs List on Domain Rail (Only installed docs) */}
      <div className="flex-1 w-full overflow-y-auto no-scrollbar flex flex-col items-center gap-2 py-1">
        {installedDocs.map((doc) => {
          const isDocActive = app.activeTab?.siteId === doc.id;
          const hasOpenTab = app.tabs.some((t) => t.siteId === doc.id);
          const isHovered = hoveredItem === doc.id;

          return (
            <div
              key={doc.id}
              className="relative flex items-center justify-center w-full"
              onMouseEnter={() => setHoveredItem(doc.id)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <span
                className={
                  "discord-pill " +
                  (isDocActive
                    ? "discord-pill-active"
                    : isHovered
                    ? "discord-pill-hover"
                    : hasOpenTab
                    ? "discord-pill-open"
                    : "discord-pill-unread")
                }
              />

              <Tooltip
                label={`${doc.name}${doc.version ? ` (${doc.version})` : ""} • Installed`}
                side="right"
              >
                <button
                  type="button"
                  onClick={() => {
                    app.openSite(doc.id);
                    app.setSelectedCategory(doc.category);
                    onNavigate?.();
                  }}
                  className="discord-server-btn group relative bg-surface hover:bg-surface-deep text-foreground shadow-sm"
                  aria-label={doc.name}
                >
                  <div
                    className="w-6 h-6 transition-transform duration-150 group-hover:scale-110 flex items-center justify-center [&_svg]:w-6 [&_svg]:h-6"
                    style={{ color: getAdaptiveBrandColor(doc.color, app.isDark) }}
                    dangerouslySetInnerHTML={{ __html: getAdaptiveSiteSvg(doc, app.isDark) }}
                  />
                </button>
              </Tooltip>
            </div>
          );
        })}

        {/* Explore & Install More Docs Button */}
        <div
          className="relative flex items-center justify-center w-full mt-1"
          onMouseEnter={() => setHoveredItem("explore")}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <Tooltip label="Explore & Install More Docs" side="right">
            <button
              type="button"
              onClick={() => {
                app.setSelectedCategory("home");
                app.goHome();
                onNavigate?.();
              }}
              className="discord-server-btn group relative border-2 border-dashed border-border-strong/70 hover:border-brand bg-transparent hover:bg-surface text-muted-foreground hover:text-brand transition-all"
              aria-label="Explore and Install Docs"
            >
              <Plus className="w-5 h-5 transition-transform duration-150 group-hover:scale-110" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* 4. Bottom Divider */}
      <div className="my-2 h-[2px] w-8 rounded bg-border-strong/60" />

      {/* 5. Compact Control Buttons at the Bottom (All global tools in one place, zero duplication) */}
      <div className="flex flex-col items-center gap-1.5 w-full px-2">
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-surface/70 border border-border/60 shadow-xs">
          {/* 1. Sidebar Toggle */}
          <Tooltip label={app.sidebarOpen ? "Hide Docs Sidebar" : "Show Docs Sidebar"} side="right">
            <button
              type="button"
              onClick={() => app.toggleSidebarOpen()}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-surface-deep hover:text-foreground transition-colors cursor-pointer"
              aria-label="Toggle Docs Sidebar"
            >
              {app.sidebarOpen ? (
                <PanelLeftClose className="w-3.5 h-3.5" />
              ) : (
                <PanelLeftOpen className="w-3.5 h-3.5 text-brand" />
              )}
            </button>
          </Tooltip>

          {/* 2. Zen Fullscreen */}
          <Tooltip label={app.zenMode ? "Exit Fullscreen (Esc or F11)" : "Zen Fullscreen Mode (F11)"} side="right">
            <button
              type="button"
              onClick={() => app.toggleZenMode()}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-surface-deep hover:text-foreground transition-colors cursor-pointer"
              aria-label="Zen Mode"
            >
              {app.zenMode ? <Minimize2 className="w-3.5 h-3.5 text-brand" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </Tooltip>

          {/* 3. Search Docs (Ctrl+K) */}
          <Tooltip label="Search Docs (Ctrl+K)" side="right">
            <button
              type="button"
              onClick={() => app.setPaletteOpen(true)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-surface-deep hover:text-success transition-colors cursor-pointer"
              aria-label="Search docs"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </Tooltip>

          {/* 4. Bookmarks */}
          <Tooltip label={`Bookmarks (${app.bookmarks.length})`} side="right">
            <button
              type="button"
              onClick={() => app.setBookmarksOpen(true)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-surface-deep hover:text-warning transition-colors cursor-pointer"
              aria-label="Bookmarks"
            >
              <Bookmark className="w-3.5 h-3.5" />
            </button>
          </Tooltip>

          {/* 5. User & Doc Settings */}
          <Tooltip label="Settings & Doc Preferences" side="right">
            <button
              type="button"
              onClick={() => app.setSettingsOpen(true)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-surface-deep hover:text-brand transition-colors cursor-pointer"
              aria-label="Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </Tooltip>

          {/* 6. Theme Switcher */}
          <Tooltip label={app.isDark ? "Switch to Pure White Light Theme" : "Switch to Onyx Dark Theme"} side="right">
            <button
              type="button"
              onClick={() => app.setThemeMode(app.isDark ? "light" : "dark")}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-surface-deep hover:text-foreground transition-colors cursor-pointer"
              aria-label="Switch Theme"
            >
              {app.isDark ? <Sun className="w-3.5 h-3.5 text-warning" /> : <Moon className="w-3.5 h-3.5 text-brand" />}
            </button>
          </Tooltip>
        </div>
      </div>
    </aside>
  );
}
