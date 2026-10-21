import * as React from "react";
import { useApp } from "../lib/store";
import { getBrand, getAdaptiveBrandColor, getAdaptiveSiteSvg } from "../lib/catalog";
import { Plus, X, ArrowLeft, CheckCircle2, DownloadCloud, Moon, Sun, Layers, BookOpen } from "lucide-react";

export function MobileTabSwitcher({
  onSelectTab,
  onNewTab,
  onClose,
}: {
  onSelectTab: (tabId: string) => void;
  onNewTab: () => void;
  onClose: () => void;
}) {
  const app = useApp();
  const webTabs = app.tabs.filter((t) => t.siteId !== "home");

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground select-none safe-bottom">
      {/* 1. Chrome-Style Mobile Top Bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4 pt-[env(safe-area-inset-top,0px)] shadow-xs">
        {/* New Tab Button (+) */}
        <button
          type="button"
          onClick={onNewTab}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-deep transition-colors cursor-pointer"
          aria-label="New Tab"
        >
          <Plus className="h-4 w-4 text-brand" />
          <span>New Doc</span>
        </button>

        {/* Center: Tabs Count */}
        <div className="flex flex-col items-center">
          <span className="text-sm font-bold tracking-tight">Open Documents</span>
          <span className="text-[11px] text-muted-foreground font-mono">
            {webTabs.length} {webTabs.length === 1 ? "document" : "documents"}
          </span>
        </div>

        {/* Done / Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-hover transition-colors cursor-pointer shadow-xs"
        >
          Done
        </button>
      </header>

      {/* 2. Grid of Document Tab Cards (Chrome Mobile Style) */}
      <div className="flex-1 overflow-y-auto p-4">
        {webTabs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16 space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-surface border border-border flex items-center justify-center text-muted-foreground">
              <BookOpen className="h-8 w-8 text-brand" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">No open documents</h3>
              <p className="text-xs text-muted-foreground max-w-[260px]">
                Browse the Discord channels and select a document to read offline.
              </p>
            </div>
            <button
              type="button"
              onClick={onNewTab}
              className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-soft hover:bg-brand-hover transition-colors cursor-pointer"
            >
              <Layers className="h-4 w-4" />
              <span>Browse All Docs</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3.5">
            {webTabs.map((tab) => {
              const b = getBrand(tab.siteId);
              const isActive = app.activeTabId === tab.id;
              const adaptiveColor = getAdaptiveBrandColor(b.color, app.isDark);
              const adaptiveSvg = getAdaptiveSiteSvg(b, app.isDark);
              const entry = app.entries.find((e) => e.id === tab.siteId);
              const isDarkDoc = app.effectiveSiteDark(tab.siteId);

              return (
                <div
                  key={tab.id}
                  onClick={() => onSelectTab(tab.id)}
                  className={
                    "group relative flex flex-col justify-between h-44 rounded-2xl border p-3 transition-all cursor-pointer shadow-sm " +
                    (isActive
                      ? "border-brand bg-surface ring-2 ring-brand/30 shadow-md"
                      : "border-border bg-surface hover:border-border-strong hover:bg-surface-deep")
                  }
                >
                  {/* Card Header: Icon, Name, Close Button */}
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="h-7 w-7 rounded-lg flex items-center justify-center p-1 shrink-0 bg-background border border-border/60"
                        style={{ color: adaptiveColor }}
                        dangerouslySetInnerHTML={{ __html: adaptiveSvg }}
                      />
                      <span className="text-xs font-bold text-foreground truncate">
                        {tab.title ?? b.name}
                      </span>
                    </div>

                    {/* Close Tab Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        app.closeTab(tab.id);
                      }}
                      className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0 cursor-pointer"
                      title="Close tab"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Card Body: Info & Status */}
                  <div className="space-y-1.5 my-auto">
                    <span className="inline-block rounded-md bg-background px-2 py-0.5 text-[10px] font-semibold text-muted-foreground truncate max-w-full">
                      {b.category}
                    </span>

                    <div className="flex items-center gap-1.5 text-[10px]">
                      {entry?.installed ? (
                        <span className="flex items-center gap-1 text-success font-medium">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Offline</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <DownloadCloud className="h-3 w-3" />
                          <span>Online</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Footer: Active Badge & Theme */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[10px]">
                    {isActive ? (
                      <span className="font-bold text-brand flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
                        <span>Active</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Tap to view</span>
                    )}

                    <span className="flex items-center gap-1 text-muted-foreground">
                      {isDarkDoc ? (
                        <Moon className="h-3 w-3 text-brand" />
                      ) : (
                        <Sun className="h-3 w-3 text-warning" />
                      )}
                      <span>{isDarkDoc ? "Dark" : "Light"}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Bottom Bar: Return to Channels / Explore */}
      <footer className="border-t border-border bg-surface px-4 py-2.5 flex items-center justify-between">
        <button
          type="button"
          onClick={onNewTab}
          className="flex items-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-deep transition-colors cursor-pointer"
        >
          <Layers className="h-4 w-4 text-brand" />
          <span>All Channels & Categories</span>
        </button>

        {webTabs.length > 1 && (
          <button
            type="button"
            onClick={() => {
              for (const t of webTabs) {
                app.closeTab(t.id);
              }
            }}
            className="text-[11px] font-semibold text-muted-foreground hover:text-danger transition-colors cursor-pointer px-2 py-1"
          >
            Close all
          </button>
        )}
      </footer>
    </div>
  );
}
