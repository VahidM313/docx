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

  // Drag-and-drop state via pointer events (works universally across WebView2, desktop & touch)
  const [dragState, setDragState] = React.useState<{
    docId: string;
    isPinned: boolean;
    x: number;
    y: number;
    targetPinnedIndex: number | null;
    isUnpinnedTarget: boolean;
  } | null>(null);

  const dragRef = React.useRef<{
    docId: string;
    isPinned: boolean;
    startX: number;
    startY: number;
    moved: boolean;
    pointerId: number;
    targetEl: HTMLElement | null;
  } | null>(null);

  const pinnedListRef = React.useRef<HTMLDivElement>(null);
  const dividerRef = React.useRef<HTMLDivElement>(null);

  const [contextMenu, setContextMenu] = React.useState<{
    x: number;
    y: number;
    doc: SiteBrand;
    isPinned: boolean;
  } | null>(null);

  // Close context menu & abort drag on outside click or escape
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (dragRef.current?.targetEl) {
          try {
            dragRef.current.targetEl.releasePointerCapture(dragRef.current.pointerId);
          } catch {}
        }
        dragRef.current = null;
        setDragState(null);
        setContextMenu(null);
      }
    };
    const handleCloseMenu = () => setContextMenu(null);

    window.addEventListener("click", handleCloseMenu);
    window.addEventListener("contextmenu", handleCloseMenu);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleCloseMenu);
      window.removeEventListener("contextmenu", handleCloseMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // All installed docs
  const allInstalledBrands = React.useMemo(() => {
    const list = app.entries.filter((e) => e.installed).map((e) => e.brand);
    // If no packs are marked installed yet, fall back to embedded packs as default starting icons
    if (list.length === 0) {
      return EMBEDDED_SITE_IDS.map((id) => SITE_MAP[id]).filter(Boolean);
    }
    return list;
  }, [app.entries]);

  // 1. Pinned Docs (Top) - in the exact order of app.pinned
  const pinnedDocs = React.useMemo(() => {
    return app.pinned
      .map((id) => SITE_MAP[id])
      .filter((b): b is SiteBrand => !!b);
  }, [app.pinned]);

  // 2. Other installed unpinned docs (Underneath) - sorted alphabetically by name
  const unpinnedDocs = React.useMemo(() => {
    const pinnedSet = new Set(app.pinned);
    const unpinned = allInstalledBrands.filter((b) => !pinnedSet.has(b.id));
    return unpinned.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [allInstalledBrands, app.pinned]);

  // Pointer drag handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, docId: string, isPinned: boolean) => {
    if (e.button !== 0) return; // Only primary button
    dragRef.current = {
      docId,
      isPinned,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      pointerId: e.pointerId,
      targetEl: e.currentTarget,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const current = dragRef.current;
    if (!current) return;

    const dist = Math.hypot(e.clientX - current.startX, e.clientY - current.startY);
    if (!current.moved) {
      if (dist >= 6) {
        current.moved = true;
        try {
          current.targetEl?.setPointerCapture(current.pointerId);
        } catch {}
      } else {
        return;
      }
    }

    const clientY = e.clientY;
    const dividerEl = dividerRef.current;
    const dividerRect = dividerEl?.getBoundingClientRect();
    const isUnpinnedTarget = dividerRect ? clientY > dividerRect.bottom : false;

    let targetPinnedIndex: number | null = null;
    if (!isUnpinnedTarget) {
      const pinnedContainer = pinnedListRef.current;
      if (pinnedContainer) {
        const itemEls = Array.from(pinnedContainer.querySelectorAll<HTMLElement>("[data-doc-item]"));
        targetPinnedIndex = itemEls.length;
        for (let i = 0; i < itemEls.length; i++) {
          const rect = itemEls[i].getBoundingClientRect();
          if (clientY < rect.top + rect.height / 2) {
            targetPinnedIndex = i;
            break;
          }
        }
      } else {
        targetPinnedIndex = 0;
      }
    }

    setDragState({
      docId: current.docId,
      isPinned: current.isPinned,
      x: e.clientX,
      y: e.clientY,
      targetPinnedIndex,
      isUnpinnedTarget,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>, doc: SiteBrand) => {
    const current = dragRef.current;
    dragRef.current = null;

    if (!current) return;

    if (current.moved && dragState) {
      try {
        current.targetEl?.releasePointerCapture(current.pointerId);
      } catch {}

      const draggedId = current.docId;
      const targetIdx = dragState.targetPinnedIndex;
      const isUnpinned = dragState.isUnpinnedTarget;

      if (current.isPinned) {
        if (isUnpinned) {
          // Dragged pinned doc down below divider into unpinned section -> unpin it
          app.togglePin(draggedId);
        } else if (targetIdx !== null) {
          // Reorder within pinned docs
          const fromIdx = app.pinned.indexOf(draggedId);
          if (fromIdx !== -1) {
            let toIdx = targetIdx;
            if (toIdx > fromIdx) toIdx = Math.max(0, toIdx - 1);
            if (fromIdx !== toIdx) {
              app.reorderPinned(fromIdx, toIdx);
            }
          }
        }
      } else {
        // Dragged unpinned doc
        if (!isUnpinned && targetIdx !== null) {
          // Pin it at targetIdx
          const nextPinned = [...app.pinned.filter((id) => id !== draggedId)];
          const insertIdx = Math.min(targetIdx, nextPinned.length);
          nextPinned.splice(insertIdx, 0, draggedId);
          app.setPinned(nextPinned);
        }
      }

      setDragState(null);
    } else {
      // Normal click without drag movement!
      setDragState(null);
      app.openSite(doc.id);
      app.setSelectedCategory(doc.category);
      onNavigate?.();
    }
  };

  const handlePointerCancel = () => {
    if (dragRef.current?.targetEl) {
      try {
        dragRef.current.targetEl.releasePointerCapture(dragRef.current.pointerId);
      } catch {}
    }
    dragRef.current = null;
    setDragState(null);
  };

  const isHomeActive = app.activeTabId === "home" && app.selectedCategory === "home";
  const draggedBrand = dragState ? SITE_MAP[dragState.docId] : null;

  const renderDocButton = (doc: SiteBrand, isPinned: boolean, index: number) => {
    const isDocActive = app.activeTab?.siteId === doc.id;
    const hasOpenTab = app.tabs.some((t) => t.siteId === doc.id);
    const isHovered = hoveredItem === doc.id;
    const isDragging = dragState?.docId === doc.id;

    // Drop insertion line indicator above or below this pinned item
    const showIndicatorAbove =
      isPinned &&
      dragState &&
      !dragState.isUnpinnedTarget &&
      dragState.targetPinnedIndex === index &&
      dragState.docId !== doc.id;

    const showIndicatorBelow =
      isPinned &&
      dragState &&
      !dragState.isUnpinnedTarget &&
      index === pinnedDocs.length - 1 &&
      dragState.targetPinnedIndex === pinnedDocs.length &&
      dragState.docId !== doc.id;

    return (
      <div
        key={doc.id}
        data-doc-item={doc.id}
        onPointerDown={(e) => handlePointerDown(e, doc.id, isPinned)}
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => handlePointerUp(e, doc)}
        onPointerCancel={handlePointerCancel}
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
          "relative flex items-center justify-center w-full transition-all duration-150 touch-none select-none " +
          (isDragging ? "opacity-30 scale-90" : "")
        }
        onMouseEnter={() => setHoveredItem(doc.id)}
        onMouseLeave={() => setHoveredItem(null)}
      >
        {/* Drop insertion line indicator above item */}
        {showIndicatorAbove && (
          <span className="absolute -top-1.5 inset-x-2 h-1 rounded-full bg-brand shadow-md shadow-brand animate-pulse pointer-events-none z-30" />
        )}

        {/* Drop insertion line indicator below last pinned item */}
        {showIndicatorBelow && (
          <span className="absolute -bottom-1.5 inset-x-2 h-1 rounded-full bg-brand shadow-md shadow-brand animate-pulse pointer-events-none z-30" />
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
            dragState
              ? ""
              : isPinned
              ? `${doc.name}${doc.version ? ` (${doc.version})` : ""} • Pinned (Drag to reorder)`
              : `${doc.name}${doc.version ? ` (${doc.version})` : ""} • Installed (Drag up to pin)`
          }
          side="right"
        >
          <button
            type="button"
            className={
              "discord-server-btn group relative bg-surface hover:bg-surface-deep text-foreground shadow-sm " +
              (isPinned ? "cursor-grab active:cursor-grabbing" : "cursor-pointer")
            }
            aria-label={doc.name}
          >
            <div
              className="w-6 h-6 transition-transform duration-150 group-hover:scale-110 flex items-center justify-center pointer-events-none [&_svg]:w-6 [&_svg]:h-6"
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
              className="h-9 w-9 object-contain logo-glyph transition-transform group-hover:scale-105 pointer-events-none"
              draggable={false}
            />
          </button>
        </Tooltip>
      </div>

      {/* 2. Top Server Divider */}
      <div className="my-2 h-[2px] w-8 rounded bg-border-strong/60" />

      {/* 3. Installed Docs List on Domain Rail */}
      <div className="flex-1 w-full overflow-y-auto no-scrollbar flex flex-col items-center gap-2 py-1">
        {/* Pinned Docs Section (Top) */}
        <div ref={pinnedListRef} className="w-full flex flex-col items-center gap-2">
          {pinnedDocs.map((doc, idx) => renderDocButton(doc, true, idx))}

          {/* Empty pinned drop target when 0 docs are pinned */}
          {pinnedDocs.length === 0 && (
            <div
              className={
                "w-11 h-11 rounded-2xl border-2 border-dashed flex items-center justify-center transition-all " +
                (dragState && !dragState.isUnpinnedTarget
                  ? "border-brand bg-brand/10 scale-105"
                  : "border-border-strong/40 bg-surface/30")
              }
              title="Drag doc here to pin"
            >
              <Pin
                className={
                  "w-4 h-4 " +
                  (dragState && !dragState.isUnpinnedTarget ? "text-brand" : "text-muted-foreground/40")
                }
              />
            </div>
          )}
        </div>

        {/* Divider between Pinned Docs and Unpinned Docs */}
        <div
          ref={dividerRef}
          className="my-1.5 h-[1.5px] w-6 rounded-full bg-border-strong/50 shrink-0"
          title="Other Installed Docs"
        />

        {/* Unpinned Docs Section (Underneath, sorted alphabetically by name) */}
        <div className="w-full flex flex-col items-center gap-2">
          {unpinnedDocs.map((doc, idx) => renderDocButton(doc, false, idx))}
        </div>

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

      {/* Floating Drag Avatar Ghost Following Pointer */}
      {dragState && draggedBrand && (
        <div
          className="fixed pointer-events-none z-[9999] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface p-2 shadow-2xl border-2 border-brand scale-110 opacity-90 flex items-center justify-center pointer-events-none"
          style={{
            left: dragState.x,
            top: dragState.y,
            width: 48,
            height: 48,
          }}
        >
          <div
            className="w-6 h-6 flex items-center justify-center [&_svg]:w-6 [&_svg]:h-6"
            style={{ color: getAdaptiveBrandColor(draggedBrand.color, app.isDark) }}
            dangerouslySetInnerHTML={{ __html: getAdaptiveSiteSvg(draggedBrand, app.isDark) }}
          />
        </div>
      )}

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
