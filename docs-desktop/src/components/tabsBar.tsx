import * as React from "react";
import { useApp } from "../lib/store";
import { getBrand, getSiteIconHtml } from "../lib/catalog";
import { X, Plus, Bookmark, PanelRight, PanelRightClose } from "lucide-react";

/**
 * Vertical reader tabs, docked right.
 *
 * The rail is always on screen in its minimized icon form. Hovering it opens
 * the labelled panel as an overlay; there is intentionally no "pinned open"
 * state. On touch devices the small toggle at the top of the rail expands it.
 * The Home button is intentionally not part of this rail.
 */
export default function VerticalTabs({ expanded }: { expanded?: boolean }) {
  const app = useApp();
  const webTabs = app.tabs.filter((t) => t.siteId !== "home");
  const active = app.activeTabId;
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [hoverCapable, setHoverCapable] = React.useState(false);
  const [desktop, setDesktop] = React.useState(() => window.innerWidth >= 768);
  React.useEffect(() => {
    const hover = window.matchMedia("(hover: hover)");
    const wide = window.matchMedia("(min-width: 768px)");
    const sync = () => {
      setHoverCapable(hover.matches);
      setDesktop(wide.matches);
    };
    sync();
    hover.addEventListener("change", sync);
    wide.addEventListener("change", sync);
    return () => {
      hover.removeEventListener("change", sync);
      wide.removeEventListener("change", sync);
    };
  }, []);
  // The hover panel is a desktop-only affordance; on narrow layouts the rail
  // button toggles the panel instead.
  const open = mobileOpen || (desktop && hoverCapable && !!expanded);

  const panel = (
    <div className="flex h-full flex-col bg-background-deep">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Open tabs</span>
        <button
          onClick={() => setMobileOpen(false)}
          className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
          title="Close"
        >
          <X size={13} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-px overflow-y-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {!webTabs.length && (
          <p className="px-2 py-3 text-[12px] leading-relaxed text-muted-foreground">
            No open documents. Use <span className="font-semibold text-foreground">Browse docs</span> to open one.
          </p>
        )}
        {webTabs.map((t) => {
          const brand = getBrand(t.siteId);
          const activeTab = t.id === active;
          return (
            <div
              key={t.id}
              className={
                "group flex h-9 w-full items-center gap-2.5 rounded px-2 transition-colors " +
                (activeTab ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground")
              }
            >
              <button
                onClick={() => {
                  app.activateTab(t.id);
                  setMobileOpen(false);
                }}
                onAuxClick={(e) => e.button === 1 && app.closeTab(t.id)}
                title={t.title ?? brand.name}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
              >
                <span
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-muted"
                  dangerouslySetInnerHTML={{ __html: getSiteIconHtml(t.siteId) }}
                />
                <span className="truncate text-[12.5px] font-medium">{t.title ?? brand.name}</span>
              </button>
              <button
                onClick={() => app.closeTab(t.id)}
                title="Close tab"
                className="grid h-5 w-5 shrink-0 place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground group-hover:opacity-100"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-border p-2">
        <PanelAction
          icon={<Plus size={15} />}
          label="Browse docs"
          onClick={() => {
            app.setDrawerOpen(true);
            setMobileOpen(false);
          }}
        />
        <PanelAction
          icon={<Bookmark size={14} />}
          label="Bookmarks"
          onClick={() => {
            app.setBookmarksOpen(true);
            setMobileOpen(false);
          }}
        />
      </div>
    </div>
  );

  return (
    <div className="relative z-30 h-full w-12 shrink-0 border-l border-border bg-rail md:w-14">
      <div className="absolute inset-0 flex flex-col items-center gap-1 overflow-y-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
          title={mobileOpen ? "Close tab list" : "Open tab list"}
        >
          {mobileOpen ? <PanelRightClose size={16} /> : <PanelRight size={16} />}
        </button>

        {webTabs.map((t) => {
          const brand = getBrand(t.siteId);
          const activeTab = t.id === active;
          return (
            <button
              key={t.id}
              onClick={() => app.activateTab(t.id)}
              onAuxClick={(e) => e.button === 1 && app.closeTab(t.id)}
              title={t.title ?? brand.name}
              className={
                "relative grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted transition-colors hover:bg-accent " +
                (activeTab ? "ring-1 ring-brand" : "")
              }
            >
              {activeTab && <span className="absolute -right-2 h-5 w-1 rounded-l-full bg-foreground" />}
              <span
                className="grid h-5 w-5 place-items-center"
                dangerouslySetInnerHTML={{ __html: getSiteIconHtml(t.siteId) }}
              />
            </button>
          );
        })}

        <div className="mt-auto flex flex-col items-center gap-1">
          <button
            onClick={() => app.setDrawerOpen(true)}
            title="Browse docs"
            className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={() => app.setBookmarksOpen(true)}
            title="Bookmarks"
            className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Bookmark size={14} />
          </button>
        </div>
      </div>

      {/* expanding overlay (never resizes the rail) */}
      <aside
        className={
          "absolute right-full top-0 z-40 h-full w-[268px] border-r border-border shadow-lift transition-all duration-150 ease-out " +
          (open
            ? "pointer-events-auto translate-x-0 opacity-100"
            : "pointer-events-none translate-x-2 opacity-0")
        }
      >
        {panel}
      </aside>
    </div>
  );
}

function PanelAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-8 w-full items-center gap-2 rounded px-2 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <span className="grid h-5 w-5 place-items-center">{icon}</span>
      {label}
    </button>
  );
}
