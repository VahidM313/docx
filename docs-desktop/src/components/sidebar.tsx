import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useApp } from "../lib/store";
import { SITES, SITE_CATEGORIES, getBrand, getSiteIconHtml } from "../lib/catalog";
import { Dialog, DialogContent } from "../ui";
import { Input, Badge } from "../ui";
import { Home, Bookmark as BookmarkIcon, Puzzle, X, Search as SearchIcon, Pin, PinOff } from "lucide-react";

/* ---------------- Rail (left, hidden until edge-hover unless pinned) ---------------- */
export function SidebarRail({ pinned }: { pinned?: boolean }) {
  return pinned ? (
    /* pinned: fixed open, occupies layout width */
    <div className="h-full w-60 border-r border-border bg-background-deep">
      <RailMenu pinned />
    </div>
  ) : (
    /* hover overlay: floats over the content, closes on leave */
    <div className="h-full w-60 border-r border-border bg-background-deep shadow-lift">
      <RailMenu />
    </div>
  );
}

/** Content shared by the slim rail's hover panel and the pinned sidebar. */
function RailMenu({ pinned, scrollRows }: { pinned?: boolean; scrollRows?: boolean }) {
  const app = useApp();
  return (
    <div className="flex h-full flex-col gap-0.5 px-2 py-3">
      <div className="mb-1 flex items-center justify-between px-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {pinned ? "Sidebar" : "Library"}
        </span>
        <button
          onClick={() => app.setSidebarPin()}
          title={pinned ? "Unpin — hide until you hover the left edge" : "Pin — keep open on screen"}
          className={
            "grid h-6 w-6 place-items-center rounded-md transition-colors hover:bg-accent " +
            (pinned ? "grad-text" : "text-muted-foreground")
          }
        >
          {pinned ? <PinOff size={13} /> : <Pin size={13} />}
        </button>
      </div>
      <RailRow
        icon={<Home size={16} />}
        label="Home hub"
        active={app.activeTabId === "home" && !app.bookmarksOpen}
        onClick={app.goHome}
      />
      <RailRow
        icon={<BookmarkIcon size={15} />}
        label="Bookmarks"
        active={app.bookmarksOpen}
        onClick={() => app.setBookmarksOpen(true)}
        badge={app.bookmarks.length || undefined}
      />
      <div className="mx-0.5 my-1.5 h-px bg-border" />
      {scrollRows ? (
        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <PinnedRows app={app} />
        </div>
      ) : (
        <PinnedRows app={app} />
      )}
      <div className="mt-auto">
        <RailRow
          icon={<Puzzle size={15} />}
          label="All documentation"
          active={app.drawerOpen}
          onClick={() => app.setDrawerOpen(true)}
        />
      </div>
    </div>
  );
}

/** Colorful labeled list of pinned sites. */
function PinnedRows({ app }: { app: ReturnType<typeof useApp> }) {
  const pinned = app.pinned.filter((id) => SITES.some((s) => s.id === id));
  return (
    <>
      {pinned.length > 0 && (
        <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Pinned
        </p>
      )}
      {pinned.map((id) => {
        const b = getBrand(id);
        return (
          <button
            key={id}
            onClick={() => app.openSite(id)}
            onDoubleClick={() => app.togglePin(id)}
            title={`📌 ${b.name} — double-click to unpin`}
            className={
              "flex h-9 w-full shrink-0 items-center gap-2.5 rounded-xl px-2 transition-colors " +
              (app.activeTab?.siteId === id ? "bg-surface shadow-soft" : "hover:bg-accent")
            }
          >
            <span
              className="grid h-6 w-6 shrink-0 place-items-center rounded-lg"
              style={{ background: b.bgTint, color: b.color }}
              dangerouslySetInnerHTML={{ __html: getSiteIconHtml(id) }}
            />
            <span className="min-w-0 flex-1 truncate text-left text-[12.5px] font-medium">{b.name}</span>
          </button>
        );
      })}
    </>
  );
}

function RailRow({
  icon,
  label,
  active,
  onClick,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "flex h-9 shrink-0 items-center gap-2.5 rounded-xl px-2 transition-colors " +
        (active ? "bg-surface text-foreground shadow-soft" : "text-muted-foreground hover:bg-accent hover:text-foreground")
      }
    >
      <span className="grid h-6 w-6 shrink-0 place-items-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-left text-[12.5px] font-medium">{label}</span>
      {!!badge && (
        <span className="grad-bg grid h-4 min-w-4 shrink-0 place-items-center rounded-full px-1 text-[9px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

/* ---------------- Channel drawer (all sites) ---------------- */
export function ChannelDrawer() {
  const app = useApp();
  const [q, setQ] = React.useState("");
  const entries = React.useMemo(() => app.entries, [app.entries]);
  const filtered = q
    ? entries.filter((e) =>
        `${e.brand.name} ${e.id} ${e.brand.category} ${e.brand.version}`.toLowerCase().includes(q.toLowerCase()),
      )
    : entries;

  const grouped = React.useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const cat of SITE_CATEGORIES) {
      const list = filtered.filter((e) => e.brand.category === cat);
      if (list.length) map.set(cat, list);
    }
    return map;
  }, [filtered]);

  return (
    <Dialog open={app.drawerOpen} onOpenChange={(v) => app.setDrawerOpen(v)}>
      <DialogContent side="left" className="animate-fade-in p-0">
        <div className="flex h-full flex-col">
          <div className="border-b border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">
                All documentation{" "}
                <Badge className="grad-bg border-0 text-white">{SITES.length}</Badge>
              </span>
              <button
                onClick={() => app.setDrawerOpen(false)}
                className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X size={14} />
              </button>
            </div>
            <div className="relative">
              <SearchIcon size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filter sites…"
                className="pl-8"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2">
            {app.pinned.length > 0 && (
              <DrawerGroup
                key="_pinned"
                label="📌 Pinned"
                list={app.entries.filter((e) => app.pinned.includes(e.id))}
                app={app}
              />
            )}
            {[...grouped.entries()].map(([cat, list]) => (
              <DrawerGroup key={cat} label={cat} list={list} app={app} />
            ))}
            {!filtered.length && (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">No sites match “{q}”.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DrawerGroup({
  label,
  list,
  app,
}: {
  label: string;
  list: ReturnType<typeof useApp>["entries"];
  app: ReturnType<typeof useApp>;
}) {
  const count = list.filter((e) => e.installed).length;
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {count}/{list.length}
        </span>
      </div>
      <div className="space-y-0.5">
        {list.map((e, i) => (
          <motion.button
            key={e.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.012, 0.2) }}
            onClick={() => (e.installed ? app.openSite(e.id) : app.installSite(e.id))}
            className="group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors hover:bg-accent"
          >
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[var(--c)] transition-transform group-hover:scale-110"
              style={{ ["--c" as string]: e.brand.color, background: e.brand.bgTint }}
              dangerouslySetInnerHTML={{ __html: getSiteIconHtml(e.id, e.remote?.iconFile, e.remote?.iconETag) }}
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-[13px] font-medium">{e.brand.name}</span>
                <span className="text-[10px] text-muted-foreground">{e.brand.version}</span>
              </span>
            </span>
            <Dot state={e.activeDownload ? "downloading" : e.installed ? (e.updateAvailable ? "update" : "ok") : "none"} />
          </motion.button>
        ))}
      </div>
    </div>
  );
}

export const useAppExport = useApp;

function Dot({ state }: { state: "ok" | "update" | "downloading" | "none" }) {
  if (state === "none") return null;
  if (state === "downloading")
    return <span className="relative grid h-2 w-2 place-items-center"><span className="absolute h-2 w-2 animate-pulse-ring rounded-full bg-[var(--grad-a)]" /><span className="h-2 w-2 rounded-full grad-bg" /></span>;
  return (
    <span
      className={
        "h-2 w-2 rounded-full " +
        (state === "ok" ? "bg-emerald-500" : "bg-amber-400")
      }
    />
  );
}
