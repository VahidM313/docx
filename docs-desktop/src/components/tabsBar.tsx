import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useApp } from "../lib/store";
import { getBrand, getSiteIconHtml } from "../lib/catalog";
import { X, Plus, Bookmark } from "lucide-react";

/**
 * Vertical reader tabs (left rail). Icon-only by default, expands with
 * labels on hover. The Hub stays accessible at the top.
 */
export default function VerticalTabs() {
  const app = useApp();
  const active = app.activeTabId;
  const webTabs = app.tabs.filter((t) => t.siteId !== "home");

  return (
    <div
      className="group/tabs relative z-30 flex w-[52px] shrink-0 flex-col border-r border-border bg-background-deep py-2 transition-[width] duration-200 hover:w-56"
    >
      {/* home */}
      <VTIcon
        active={active === "home"}
        onClick={app.goHome}
        label="Hub"
        icon={
          <span className="grad-bg grid h-7 w-7 place-items-center rounded-lg shadow-soft">
            <img src="/logo.png" alt="" className="h-[17px] w-[17px]" draggable={false} />
          </span>
        }
      />

      <div className="mx-2 my-2 h-px bg-border" />

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <AnimatePresence initial={false}>
          {webTabs.map((t) => {
            const brand = getBrand(t.siteId);
            const activeTab = t.id === active;
            return (
              <VTIcon
                key={t.id}
                active={activeTab}
                onClick={() => app.activateTab(t.id)}
                onAuxClick={(e) => e.button === 1 && app.closeTab(t.id)}
                label={t.title ?? brand.name}
                icon={
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center transition-transform hover:scale-105"
                    style={{ color: brand.color }}
                    dangerouslySetInnerHTML={{ __html: getSiteIconHtml(t.siteId) }}
                  />
                }
                accent={brand.color}
                onClose={() => app.closeTab(t.id)}
              />
            );
          })}
        </AnimatePresence>
      </div>

      <div className="mx-2 my-2 h-px bg-border" />
      <VTIcon
        active={false}
        onClick={() => app.setDrawerOpen(true)}
        label="All documentation"
        icon={
          <span className="grid h-7 w-7 place-items-center text-muted-foreground transition-colors group-hover/tabs:text-foreground">
            <Plus size={16} />
          </span>
        }
      />
      <VTIcon
        active={false}
        onClick={() => app.setBookmarksOpen(true)}
        label="Bookmarks"
        icon={
          <span className="grid h-7 w-7 place-items-center text-muted-foreground transition-colors group-hover/tabs:text-foreground">
            <Bookmark size={15} />
          </span>
        }
      />
    </div>
  );
}

function VTIcon({
  active,
  onClick,
  onAuxClick,
  label,
  icon,
  accent,
  onClose,
}: {
  active?: boolean;
  onClick: () => void;
  onAuxClick?: (e: React.MouseEvent) => void;
  label: string;
  icon: React.ReactNode;
  accent?: string;
  onClose?: () => void;
}) {
  return (
    <motion.button
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8, transition: { duration: 0.12 } }}
      onClick={onClick}
      onAuxClick={onAuxClick}
      title={label}
      className={
        "relative mx-2 flex h-10 shrink-0 cursor-pointer items-center gap-2.5 rounded-xl px-2.5 transition-colors " +
        (active ? "bg-surface text-foreground shadow-soft" : "text-muted-foreground hover:bg-surface/70 hover:text-foreground")
      }
    >
      {active && (
        <motion.span
          layoutId="vtab-active"
          className="absolute -left-2 h-5 w-1 rounded-full"
          style={accent ? { background: accent } : { background: "var(--grad)" }}
        />
      )}
      {icon}
      <span className="pointer-events-none w-0 overflow-hidden truncate whitespace-nowrap text-[12.5px] font-medium opacity-0 transition-all duration-150 group-hover/tabs:w-auto group-hover/tabs:opacity-100">
        {label}
      </span>
      {onClose && (
        <span
          role="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="pointer-events-none grid h-5 w-5 shrink-0 place-items-center rounded-md opacity-0 transition-all hover:bg-accent group-hover/tabs:pointer-events-auto group-hover/tabs:opacity-70"
        >
          <X size={11} />
        </span>
      )}
    </motion.button>
  );
}
