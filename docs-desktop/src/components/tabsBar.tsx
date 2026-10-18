import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useApp } from "../lib/store";
import { getBrand, getSiteIconHtml } from "../lib/catalog";
import { X, Plus, Bookmark, Pin, PinOff } from "lucide-react";

/**
 * Vertical reader tabs, docked right.
 *
 * Unpinned (default): the rail is a constant 52px icon strip — hovering it
 * opens a labelled panel that overlays the content and closes when the
 * cursor leaves. The panel carries a pin button to fix it open.
 * Pinned: the labelled panel is always open and takes layout width.
 * The Hub button is intentionally not part of the rail.
 */
export default function VerticalTabs({ open }: { open?: boolean }) {
  const app = useApp();
  const webTabs = app.tabs.filter((t) => t.siteId !== "home");
  const active = app.activeTabId;

  const actions = (
    <>
      <PanelRow
        icon={<Plus size={15} />}
        label="All documentation"
        onClick={() => app.setDrawerOpen(true)}
        muted
      />
      <PanelRow
        icon={<Bookmark size={14} />}
        label="Bookmarks"
        onClick={() => app.setBookmarksOpen(true)}
        muted
      />
    </>
  );

  const panel = (
    <div className="flex h-full flex-col gap-0.5 px-2 py-2.5">
      <div className="mb-1 flex items-center justify-between px-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tabs</span>
        <button
          onClick={() => app.setTabsPin()}
          title={app.pins.tabs ? "Unpin — collapse to icons" : "Pin — keep open on screen"}
          className={
            "grid h-6 w-6 place-items-center rounded-md transition-colors hover:bg-accent " +
            (app.pins.tabs ? "grad-text" : "text-muted-foreground")
          }
        >
          {app.pins.tabs ? <PinOff size={13} /> : <Pin size={13} />}
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <AnimatePresence initial={false}>
          {webTabs.map((t) => {
            const brand = getBrand(t.siteId);
            const activeTab = t.id === active;
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8, transition: { duration: 0.12 } }}
              >
                <PanelRow
                  icon={
                    <span
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-lg"
                      style={{ background: brand.bgTint, color: brand.color }}
                      dangerouslySetInnerHTML={{ __html: getSiteIconHtml(t.siteId) }}
                    />
                  }
                  label={t.title ?? brand.name}
                  active={activeTab}
                  onClick={() => app.activateTab(t.id)}
                  onClose={() => app.closeTab(t.id)}
                  onAux={(e) => e.button === 1 && app.closeTab(t.id)}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <div className="mx-0.5 my-1 h-px bg-border" />
      {actions}
    </div>
  );

  /* pinned: fixed open, occupying width */
  if (app.pins.tabs) {
    return (
      <div className="z-30 h-full w-64 shrink-0 border-l border-border bg-background-deep">
        {panel}
      </div>
    );
  }

  /* unpinned: constant icon rail; the overlay panel opens while the cursor is
     at the rail or on the panel (driven by the shell's cursor poll) */
  return (
    <div className="relative z-30 h-full w-[52px] shrink-0 border-l border-border bg-background-deep">
      {/* icon strip */}
      <div className="absolute inset-0 flex flex-col items-center gap-1 py-2">
        {webTabs.map((t) => {
          const brand = getBrand(t.siteId);
          const activeTab = t.id === active;
          return (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              onClick={() => app.activateTab(t.id)}
              onAuxClick={(e) => e.button === 1 && app.closeTab(t.id)}
              title={t.title ?? brand.name}
              className={
                "relative grid h-9 w-9 place-items-center rounded-xl transition-all hover:scale-105 " +
                (activeTab ? "bg-surface shadow-soft ring-1 ring-border" : "hover:bg-surface/60")
              }
            >
              <span
                className="grid h-5 w-5 place-items-center"
                style={{ color: brand.color }}
                dangerouslySetInnerHTML={{ __html: getSiteIconHtml(t.siteId) }}
              />
              {activeTab && <span className="absolute -right-1 h-4 w-0.5 rounded-full" style={{ background: brand.color }} />}
            </motion.button>
          );
        })}
        <div className="mt-auto flex flex-col items-center gap-1">
          <button
            onClick={() => app.setDrawerOpen(true)}
            title="All documentation"
            className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-surface/60 hover:text-foreground"
          >
            <Plus size={15} />
          </button>
          <button
            onClick={() => app.setBookmarksOpen(true)}
            title="Bookmarks"
            className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-surface/60 hover:text-foreground"
          >
            <Bookmark size={14} />
          </button>
        </div>
      </div>

      {/* expanding overlay panel (over the content; never resizes the rail) */}
      <aside
        className={
          "pointer-events-none absolute right-0 top-0 z-40 h-full w-64 translate-x-6 border-l border-border bg-popover/95 opacity-0 shadow-lift backdrop-blur transition-all duration-200 ease-out " +
          (open ? "pointer-events-auto translate-x-0 opacity-100" : "")
        }
      >
        {panel}
      </aside>
    </div>
  );
}

function PanelRow({
  icon,
  label,
  active,
  onClick,
  onClose,
  onAux,
  muted,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  onClose?: () => void;
  onAux?: (e: React.MouseEvent) => void;
  muted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      onAuxClick={onAux}
      title={label}
      className={
        "flex h-9 w-full shrink-0 items-center gap-2.5 rounded-xl px-2 transition-colors " +
        (active
          ? "bg-surface text-foreground shadow-soft"
          : (muted ? "text-muted-foreground" : "text-muted-foreground hover:text-foreground") +
            " hover:bg-accent hover:text-foreground")
      }
    >
      <span className="grid h-6 w-6 shrink-0 place-items-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-left text-[12.5px] font-medium">{label}</span>
      {onClose && (
        <span
          role="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="grid h-5 w-5 shrink-0 place-items-center rounded-md opacity-60 transition-all hover:bg-accent hover:opacity-100"
        >
          <X size={11} />
        </span>
      )}
    </button>
  );
}
