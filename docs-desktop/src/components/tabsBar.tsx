import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useApp } from "../lib/store";
import { getBrand, getEntryPath } from "../lib/catalog";
import { getSiteIconHtml } from "../lib/catalog";
import { Tooltip } from "../ui";
import { X, Plus, Home } from "lucide-react";

export default function TabsBar() {
  const app = useApp();
  const active = app.activeTabId;
  const isHomeActive = active === "home";

  const Icon = ({ siteId }: { siteId: string }) => {
    const html = getSiteIconHtml(siteId);
    return (
      <span
        className="grid h-4 w-4 shrink-0 place-items-center text-[var(--tab-color)]"
        style={{ color: getBrand(siteId).color }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  };

  return (
    <div className="relative z-30 flex h-10 shrink-0 items-end gap-1 overflow-x-auto border-b border-border bg-background-deep px-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* home tab */}
      <motion.button
        layout
        onClick={app.goHome}
        className={
          "group flex h-9 shrink-0 items-center gap-1.5 rounded-t-xl px-3 text-[12px] font-medium transition-colors " +
          (isHomeActive
            ? "bg-surface text-foreground shadow-soft"
            : "text-muted-foreground hover:bg-surface/60")
        }
      >
        <Home size={13} className={isHomeActive ? "grad-text" : ""} />
        Hub
      </motion.button>

      <AnimatePresence initial={false}>
        {app.tabs
          .filter((t) => t.siteId !== "home")
          .map((t) => {
            const brand = getBrand(t.siteId);
            const activeTab = t.id === active;
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 8, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 480, damping: 34 }}
                className={
                  "group relative flex h-9 shrink-0 max-w-[190px] cursor-pointer select-none items-center gap-2 rounded-t-xl px-3 text-[12px] " +
                  (activeTab
                    ? "bg-surface font-medium text-foreground shadow-soft"
                    : "text-muted-foreground hover:bg-surface/60 hover:text-foreground")
                }
                style={activeTab ? { ["--tab-color" as string]: brand.color } : undefined}
                onClick={() => app.activateTab(t.id)}
                onAuxClick={(e) => {
                  if (e.button === 1) app.closeTab(t.id);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  app.duplicateTab(t.id);
                }}
                title={`${brand.name} — ${t.pathOrUrl ?? getEntryPath(t.siteId)}`}
              >
                <Icon siteId={t.siteId} />
                <span className="truncate">{t.title ?? tabTitleFromPath(t)}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    app.closeTab(t.id);
                  }}
                  className={
                    "grid h-5 w-5 place-items-center rounded-md transition-all hover:bg-accent " +
                    (activeTab ? "opacity-70 hover:opacity-100" : "opacity-0 group-hover:opacity-60")
                  }
                >
                  <X size={11} />
                </button>
                {activeTab && (
                  <motion.span
                    layoutId="tab-underline"
                    className="absolute inset-x-2 -bottom-px h-0.5 rounded-full"
                    style={{ background: `linear-gradient(90deg, ${brand.color}, var(--grad-b))` }}
                  />
                )}
              </motion.div>
            );
          })}
      </AnimatePresence>

      <Tooltip label="All documentation">
        <motion.button
          layout
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => app.setDrawerOpen(true)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
        >
          <Plus size={14} />
        </motion.button>
      </Tooltip>
    </div>
  );
}

function tabTitleFromPath(t: { siteId: string; pathOrUrl?: string; title?: string }) {
  if (t.title) return t.title;
  const seg = (t.pathOrUrl ?? getEntryPath(t.siteId)).split("/").filter(Boolean).pop() ?? "";
  return seg.replace(/[-_]+/g, " ").replace(/\.html?$/, "") || getBrand(t.siteId).name;
}
