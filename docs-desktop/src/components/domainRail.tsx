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
  Pin,
  PinOff,
  ExternalLink,
} from "lucide-react";

export function DomainRail({ onNavigate }: { onNavigate?: () => void }) {
  const app = useApp();
  const [hoveredItem, setHoveredItem] = React.useState<string | null>(null);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [dragOverId, setDragOverId] = React.useState<string | null>(null);
  const [contextMenu, setContextMenu] = React.useState<{
    x: number;
    y: number;
    doc: SiteBrand;
    isPinned: boolean;
  } | null>(null);

  // Close context menu on outside click or escape
  React.useEffect(() => {
    if (!contextMenu) return;
    const handleClose = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("click", handleClose);
    window.addEventListener("contextmenu", handleClose);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleClose);
      window.removeEventListener("contextmenu", handleClose);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  // All installed docs
  const allInstalledBrands = React.useMemo(() => {
    const list = app.entries.filter((e) => e.installed).map((e) => e.brand);
    // If no packs are marked installed yet, fall back to embedded packs as default starting icons
    if (list.length === 0) {
      return EMBEDDED_SITE_IDS.map((id) => SITE_MAP[id]).filter(Boolean);
    }
    return list;
  }, [app.entries]);

  const installedMap = React.useMemo(() => {
    const map = new Map<string, SiteBrand>();
    allInstalledBrands.forEach((b) => map.set(b.id, b));
    return map;
  }, [allInstalledBrands]);

  // 1. Pinned Docs (Top) - in the exact order of app.pinned
  const pinnedDocs = React.useMemo(() => {
    return app.pinned
      .map((id) => installedMap.get(id))
      .filter((b): b is SiteBrand => !!b);
  }, [app.pinned, installedMap]);

  // 2. Other installed unpinned docs (Underneath) - sorted alphabetically by name
  const unpinnedDocs = React.useMemo(() => {
    const pinnedSet = new Set(app.pinned);
    const unpinned = allInstalledBrands.filter((b) => !pinnedSet.has(b.id));
    return unpinned.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [allInstalledBrands, app.pinned]);

  // Drag and drop reordering for pinned docs
  const handleDropPinned = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const currentPinned = [...app.pinned];
    const fromIdx = currentPinned.indexOf(draggedId);
    const toIdx = currentPinned.indexOf(targetId);

    if (fromIdx !== -1 && toIdx !== -1) {
      const [moved] = currentPinned.splice(fromIdx, 1);
      currentPinned.splice(toIdx, 0, moved);
      app.setPinned(currentPinned);
    } else if (fromIdx === -1 && toIdx !== -1) {
      // Dropped an unpinned doc onto a pinned doc slot -> pin it at that position!
      currentPinned.splice(toIdx, 0, draggedId);
      app.setPinned(currentPinned);
    }
  };

  const isHomeActive = app.activeTabId === "home" && app.selectedCategory === "home";

  const renderDocButton = (doc: SiteBrand, isPinned: boolean) => {
    const isDocActive = app.activeTab?.siteId === doc.id;
    const hasOpenTab = app.tabs.some((t) => t.siteId === doc.id);
    const isHovered = hoveredItem === doc.id;
    const isDragging = draggingId === doc.id;
    const isDragOver = dragOverId === doc.id;

    return (
      <div
        key={doc.id}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", doc.id);
          e.dataTransfer.effectAllowed = "move";
          setDraggingId(doc.id);
        }}
        onDragOver={(e) => {
          if (isPinned) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (dragOverId !== doc.id) setDragOverId(doc.id);
          }
        }}
        onDragLeave={() => {
          if (dragOverId === doc.id) setDragOverId(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          const droppedId = e.dataTransfer.getData("text/plain") || draggingId;
          if (droppedId && droppedId !== doc.id && isPinned) {
            handleDropPinned(droppedId, doc.id);
          }
          setDraggingId(null);
          setDragOverId(null);
        }}
        onDragEnd={() => {
          setDraggingId(null);
          setDragOverId(null);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setContextMenu({
            x: Math.min(e.clientX, window.innerWidth - 180),
            y: Math.min(e.clientY, window.innerHeight - 150),
            doc,
            isPinned,
          });
        }}
        className={
          "relative flex items-center justify-center w-full transition-all duration-150 " +
          (isDragging ? "opacity-30 scale-90" : "") +
          (isDragOver ? "scale-105" : "")
        }
        onMouseEnter={() => setHoveredItem(doc.id)}
        onMouseLeave={() => setHoveredItem(null)}
      >
        {/* Drop target indicator bar above item */}
        {isDragOver && !isDragging && (
          <span className="absolute -top-1 inset-x-2 h-0.5 rounded-full bg-brand shadow-sm shadow-brand animate-pulse pointer-events-none z-30" />
        )}

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
          label={
            isPinned
              ? `${doc.name}${doc.version ? ` (${doc.version})` : ""} • Pinned (Drag to reorder)`
              : `${doc.name}${doc.version ? ` (${doc.version})` : ""} • Installed`
          }
          side="right"
        >
          <button
            type="button"
            onClick={() => {
              app.openSite(doc.id);
              app.setSelectedCategory(doc.category);
              onNavigate?.();
            }}
            className={
              "discord-server-btn group relative bg-surface hover:bg-surface-deep text-foreground shadow-sm " +
              (isPinned ? "cursor-grab active:cursor-grabbing" : "cursor-pointer")
            }
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
  };

  return (
    <aside
      className="relative flex h-full w-[72px] shrink-0 flex-col items-center border-r border-border bg-rail py-3 select-none z-20"
      onMouseLeave={() => {
        setHoveredItem(null);
      }}
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

      {/* 2. Top Server Divider */}
      <div className="my-2 h-[2px] w-8 rounded bg-border-strong/60" />

      {/* 3. Installed Docs List on Domain Rail */}
      <div className="flex-1 w-full overflow-y-auto no-scrollbar flex flex-col items-center gap-2 py-1">
        {/* Top: Pinned Docs (Drag & Drop Reorderable) */}
        {pinnedDocs.map((doc) => renderDocButton(doc, true))}

        {/* Divider between Pinned Docs and Unpinned Docs (if both exist) */}
        {pinnedDocs.length > 0 && unpinnedDocs.length > 0 && (
          <div
            className="my-1.5 h-[1.5px] w-6 rounded-full bg-border-strong/50 shrink-0"
            title="Other Installed Docs"
          />
        )}

        {/* Bottom: Unpinned Docs (Sorted by name) */}
        {unpinnedDocs.map((doc) => renderDocButton(doc, false))}

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
              className="discord-server-btn group relative border-2 border-dashed border-border-strong/70 hover:border-brand bg-transparent hover:bg-surface text-muted-foreground hover:text-brand transition-all cursor-pointer"
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

      {/* Context Menu on Right Click */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[170px] rounded-xl border border-border bg-surface p-1 shadow-lift text-xs font-medium text-foreground backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground border-b border-border/60 truncate">
            {contextMenu.doc.name}
          </div>
          <button
            type="button"
            className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg hover:bg-surface-deep hover:text-foreground text-left cursor-pointer transition-colors"
            onClick={() => {
              app.togglePin(contextMenu.doc.id);
              setContextMenu(null);
            }}
          >
            {contextMenu.isPinned ? (
              <>
                <PinOff className="w-3.5 h-3.5 text-brand" />
                <span>Unpin from rail</span>
              </>
            ) : (
              <>
                <Pin className="w-3.5 h-3.5 text-brand" />
                <span>Pin to top</span>
              </>
            )}
          </button>
          <button
            type="button"
            className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg hover:bg-surface-deep hover:text-foreground text-left cursor-pointer transition-colors"
            onClick={() => {
              app.openSite(contextMenu.doc.id);
              app.setSelectedCategory(contextMenu.doc.category);
              onNavigate?.();
              setContextMenu(null);
            }}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open in Tab</span>
          </button>
        </div>
      )}
    </aside>
  );
}
