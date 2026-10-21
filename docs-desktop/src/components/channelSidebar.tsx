import * as React from "react";
import { useApp } from "../lib/store";
import { SITES, SITE_MAP, SITE_CATEGORIES, getAdaptiveBrandColor, getAdaptiveSiteSvg, type SiteBrand } from "../lib/catalog";
import { Tooltip } from "../ui";
import {
  ChevronDown,
  Search,
  Settings,
  DownloadCloud,
  CheckCircle2,
  Bookmark,
  PanelLeftClose,
  BookOpen,
  X,
} from "lucide-react";

export function ChannelSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const app = useApp();
  const [categoryMenuOpen, setCategoryMenuOpen] = React.useState(false);
  const [collapsedGroups, setCollapsedGroups] = React.useState<Record<string, boolean>>({});

  // Filter docs for the selected category
  const categoryDocs = React.useMemo(() => {
    if (app.selectedCategory === "home") {
      const pinnedBrands = app.pinned.map((id) => SITE_MAP[id]).filter(Boolean);
      return pinnedBrands.length ? pinnedBrands : SITES;
    }
    return SITES.filter((s) => s.category === app.selectedCategory);
  }, [app.selectedCategory, app.pinned]);

  // Apply quick filter and search
  const filteredDocs = React.useMemo(() => {
    return categoryDocs.filter((doc) => {
      // Text search
      if (
        app.channelSearchQuery &&
        !doc.name.toLowerCase().includes(app.channelSearchQuery.toLowerCase()) &&
        !doc.id.toLowerCase().includes(app.channelSearchQuery.toLowerCase())
      ) {
        return false;
      }
      // Quick filter
      const entry = app.entries.find((e) => e.id === doc.id);
      if (app.quickFilter === "installed") {
        return entry?.installed;
      }
      if (app.quickFilter === "bookmarks") {
        return app.bookmarks.some((b) => b.siteId === doc.id);
      }
      return true;
    });
  }, [categoryDocs, app.channelSearchQuery, app.quickFilter, app.entries, app.bookmarks]);

  // Discord Channel Groups (Collapsible category sections)
  const channelGroups = React.useMemo(() => {
    if (app.selectedCategory === "home") {
      const groups: { name: string; docs: SiteBrand[] }[] = [];
      for (const cat of SITE_CATEGORIES) {
        const docs = filteredDocs.filter((d) => d.category === cat);
        if (docs.length > 0) {
          groups.push({ name: cat, docs });
        }
      }
      return groups;
    }

    const installed = filteredDocs.filter((d) => app.entries.find((e) => e.id === d.id)?.installed);
    const available = filteredDocs.filter((d) => !app.entries.find((e) => e.id === d.id)?.installed);

    const groups: { name: string; docs: SiteBrand[] }[] = [];
    if (installed.length > 0) {
      groups.push({ name: "Installed Packs", docs: installed });
    }
    if (available.length > 0) {
      groups.push({
        name: installed.length > 0 ? "Available Packs" : `${app.selectedCategory} Packs`,
        docs: available,
      });
    }
    if (groups.length === 0 && filteredDocs.length > 0) {
      groups.push({ name: "Documentation", docs: filteredDocs });
    }
    return groups;
  }, [app.selectedCategory, filteredDocs, app.entries]);

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  const activeDocId = app.activeTab?.siteId;

  return (
    <aside
      className="relative flex h-full w-full md:w-[240px] shrink-0 flex-col border-r border-border bg-surface select-none overflow-hidden"
    >
      {/* 1. Category / Server Header */}
      <div className="relative flex items-center justify-between border-b border-border px-3 h-12 shadow-sm">
        <button
          type="button"
          onClick={() => setCategoryMenuOpen((v) => !v)}
          className="flex flex-1 items-center justify-between py-1 font-bold text-sm text-foreground hover:text-brand transition-colors truncate mr-1"
          aria-expanded={categoryMenuOpen}
        >
          <span className="truncate pr-1">
            {app.selectedCategory === "home" ? "All Documentation" : app.selectedCategory}
          </span>
          <ChevronDown
            className={
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 " +
              (categoryMenuOpen ? "rotate-180" : "")
            }
          />
        </button>

        {/* Close / Collapse Sidebar button (desktop only) */}
        <div className="hidden md:flex">
          <Tooltip label="Close Sidebar" side="bottom">
            <button
              type="button"
              onClick={() => app.setSidebarOpen(false)}
              className="p-1.5 rounded transition-colors shrink-0 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Close sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>

        {/* Category Menu Dropdown */}
        {categoryMenuOpen && (
          <div className="absolute top-12 left-2 right-2 z-50 rounded-md border border-border bg-popover p-1 shadow-lift animate-pop">
            <button
              type="button"
              onClick={() => {
                app.setQuickFilter("all");
                setCategoryMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs text-foreground hover:bg-brand hover:text-white transition-colors"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Show All Docs ({categoryDocs.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                app.setQuickFilter("installed");
                setCategoryMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs text-foreground hover:bg-brand hover:text-white transition-colors"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              <span>Show Only Downloaded</span>
            </button>
            <button
              type="button"
              onClick={() => {
                app.setQuickFilter("bookmarks");
                setCategoryMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs text-foreground hover:bg-brand hover:text-white transition-colors"
            >
              <Bookmark className="h-3.5 w-3.5 text-warning" />
              <span>Show Starred Docs</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Quick Search Trigger */}
      <div className="px-2 pt-2 pb-1">
        <button
          type="button"
          onClick={() => app.setPaletteOpen(true)}
          className="flex h-7 w-full items-center justify-between rounded bg-background-deep px-2 text-xs text-muted-foreground hover:bg-accent/60 transition-colors"
        >
          <span className="flex items-center gap-1.5 truncate">
            <Search className="h-3.5 w-3.5" />
            <span>Search docs...</span>
          </span>
          <kbd className="rounded bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground border border-border">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* 3. Quick Filter Tabs */}
      <div className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-muted-foreground border-b border-border/40">
        <button
          type="button"
          onClick={() => app.setQuickFilter("all")}
          className={
            "rounded px-2 py-0.5 transition-colors " +
            (app.quickFilter === "all"
              ? "bg-accent text-foreground font-semibold"
              : "hover:bg-accent/50")
          }
        >
          All ({categoryDocs.length})
        </button>
        <button
          type="button"
          onClick={() => app.setQuickFilter("installed")}
          className={
            "rounded px-2 py-0.5 transition-colors " +
            (app.quickFilter === "installed"
              ? "bg-accent text-foreground font-semibold"
              : "hover:bg-accent/50")
          }
        >
          Installed
        </button>
        <button
          type="button"
          onClick={() => app.setQuickFilter("bookmarks")}
          className={
            "rounded px-2 py-0.5 transition-colors " +
            (app.quickFilter === "bookmarks"
              ? "bg-accent text-foreground font-semibold"
              : "hover:bg-accent/50")
          }
        >
          Starred
        </button>
      </div>

      {/* 4. Discord Channel Groups with Unopened Indicators */}
      <div className="flex-1 overflow-y-auto px-1.5 py-2 no-scrollbar space-y-2">
        {channelGroups.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            No matching docs found.
          </div>
        ) : (
          channelGroups.map((group) => {
            const isCollapsed = !!collapsedGroups[group.name];

            return (
              <div key={group.name} className="space-y-0.5">
                {/* Collapsible Discord Group Header */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.name)}
                  className="flex w-full items-center gap-1.5 px-2 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors group cursor-pointer"
                  aria-expanded={!isCollapsed}
                >
                  <ChevronDown
                    className={
                      "h-3 w-3 shrink-0 transition-transform duration-150 " +
                      (isCollapsed ? "-rotate-90 text-muted-foreground/70" : "text-muted-foreground")
                    }
                  />
                  <span className="truncate">{group.name}</span>
                  <span className="ml-auto text-[10px] font-mono text-muted-foreground font-semibold">
                    {group.docs.length}
                  </span>
                </button>

                {/* Group Channels List */}
                {!isCollapsed &&
                  group.docs.map((doc) => {
                    const isActive = activeDocId === doc.id;
                    const isOpened = app.openedDocs.includes(doc.id);
                    const entry = app.entries.find((e) => e.id === doc.id);
                    const isInstalled = !!entry?.installed;

                    return (
                      <div key={doc.id} className="space-y-0.5 relative">
                        {/* Little indicator on not opened docs (white dot / pill on left) */}
                        {!isOpened && !isActive && (
                          <span
                            className="absolute left-0 top-1/2 -translate-y-1/2 h-2 w-1 rounded-r-full bg-foreground shadow-sm z-10"
                            title="Not opened yet"
                          />
                        )}

                        {/* Main Channel Button */}
                        <button
                          type="button"
                          onClick={() => {
                            app.openSite(doc.id);
                            app.markDocOpened(doc.id);
                            onNavigate?.();
                          }}
                          className={
                            "discord-channel-item w-full text-left relative pl-3 " +
                            (isActive ? "active" : "") +
                            (!isOpened && !isActive ? " text-foreground font-semibold" : "")
                          }
                          title={doc.description}
                        >
                          {/* Curated Official Brand SVG with Adaptive Colors */}
                          <div
                            className="h-4 w-4 shrink-0 flex items-center justify-center [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:fill-current"
                            style={{ color: getAdaptiveBrandColor(doc.color, app.isDark) }}
                            dangerouslySetInnerHTML={{ __html: getAdaptiveSiteSvg(doc, app.isDark) }}
                          />

                          <span className="flex-1 truncate">
                            {doc.name.toLowerCase().replace(/\s+/g, "-")}
                          </span>

                          {/* Status Badges */}
                          <div className="flex items-center gap-1 shrink-0">
                            {isInstalled ? (
                              <span className="h-2 w-2 rounded-full bg-success" title="Installed locally" />
                            ) : (
                              <DownloadCloud className="h-3 w-3 text-muted-foreground" title="Cloud pack" />
                            )}
                            {doc.version && (
                              <span className="text-[10px] text-muted-foreground font-mono opacity-80">
                                {doc.version}
                              </span>
                            )}
                          </div>
                        </button>

                        {/* Nested Sub-routes (if channel is active) */}
                        {isActive && doc.defaultRoutes && doc.defaultRoutes.length > 0 && (
                          <div className="ml-5 pl-2 border-l border-border/60 space-y-0.5 py-0.5">
                            {doc.defaultRoutes.map((route) => {
                              const isRouteActive = app.activeTab?.pathOrUrl === route.path;
                              return (
                                <button
                                  key={route.path}
                                  type="button"
                                  onClick={() => {
                                    app.openSite(doc.id, route.path);
                                    onNavigate?.();
                                  }}
                                  className={
                                    "flex w-full items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors " +
                                    (isRouteActive
                                      ? "bg-accent text-foreground font-medium"
                                      : "text-muted-foreground hover:bg-accent/40 hover:text-foreground")
                                  }
                                >
                                  <span className="text-[10px] text-muted-foreground/60">#</span>
                                  <span className="truncate">{route.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            );
          })
        )}
      </div>

      {/* 5. Clean Offline Status Dock (No profile bar, pure black) */}
      <div className="h-11 bg-background-deep border-t border-border px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2 w-2 rounded-full bg-success ring-2 ring-background-deep shrink-0" />
          <span className="text-[11px] font-medium text-muted-foreground truncate">
            Offline Ready • {categoryDocs.length} Docs
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Tooltip label="User Settings" side="top">
            <button
              type="button"
              onClick={() => app.setSettingsOpen(true)}
              className="p-1 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              aria-label="User Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      </div>
    </aside>
  );
}
