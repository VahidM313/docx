import * as React from "react";
import { useApp } from "../lib/store";
import { SITES, SITE_CATEGORIES, getBrand, getSiteIconHtml } from "../lib/catalog";
import { Dialog, DialogContent, Input, Badge } from "../ui";
import { Home, Bookmark as BookmarkIcon, X, Search as SearchIcon, Pin, PinOff } from "lucide-react";

/* ---------------- Main sidebar ----------------
   Only three things live here: Home, Bookmarks, and pinned docs.
   Unpinned: a 64px icon rail; hovering reveals a labelled panel.
   Pinned: a fixed 240px labelled sidebar.
   On mobile it becomes an off-canvas drawer opened from the titlebar. */

export function SidebarRail({
  pinned,
  open,
  mobileOpen,
  onMobileClose,
}: {
  pinned?: boolean;
  open?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const app = useApp();
  const homeActive = app.activeTabId === "home" && !app.bookmarksOpen;

  return (
    <>
      {/* mobile drawer */}
      <div
        className={
          "fixed inset-0 z-[70] md:hidden " + (mobileOpen ? "pointer-events-auto" : "pointer-events-none")
        }
        aria-hidden={!mobileOpen}
      >
        <div
          onClick={onMobileClose}
          className={
            "absolute inset-0 bg-black/60 transition-opacity duration-150 " +
            (mobileOpen ? "opacity-100" : "opacity-0")
          }
        />
        <aside
          className={
            "absolute inset-y-0 left-0 w-[280px] max-w-[86vw] border-r border-border bg-background-deep shadow-lift transition-transform duration-150 ease-out " +
            (mobileOpen ? "translate-x-0" : "-translate-x-full")
          }
        >
          <RailMenu pinned onNavigate={onMobileClose} onClose={onMobileClose} />
        </aside>
      </div>

      {/* desktop rail */}
      <div className="relative z-30 hidden h-full shrink-0 md:block">
        {pinned ? (
          <div className="h-full w-60 border-r border-border bg-background-deep">
            <RailMenu pinned />
          </div>
        ) : (
          <div className="relative h-full w-16 border-r border-border bg-rail">
            <div className="absolute inset-0 flex flex-col items-center gap-2 overflow-y-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <RailBtn
                icon={<img src="/logo.png" alt="Docx" className="logo-glyph h-6 w-6" draggable={false} />}
                label="Home"
                active={homeActive}
                accent
                onClick={app.goHome}
              />
              <RailBtn
                icon={<BookmarkIcon size={17} />}
                label="Bookmarks"
                active={app.bookmarksOpen}
                badge={app.bookmarks.length || undefined}
                onClick={() => app.setBookmarksOpen(true)}
              />
              <div className="my-1 h-px w-8 shrink-0 bg-border" />
              <IconPinRail app={app} />
            </div>

            {/* hover-revealed labels; overlays the content, never resizes the rail */}
            <div
              className={
                "absolute left-full top-0 z-40 h-full w-60 border-r border-border bg-background-deep shadow-lift transition-all duration-150 ease-out " +
                (open ? "pointer-events-auto translate-x-0 opacity-100" : "pointer-events-none -translate-x-2 opacity-0")
              }
            >
              <RailMenu />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function RailBtn({
  icon,
  label,
  active,
  onClick,
  badge,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  badge?: number;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={
        "relative grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors " +
        (active
          ? "bg-brand text-white"
          : accent
            ? "bg-muted text-foreground hover:bg-accent"
            : "text-muted-foreground hover:bg-accent hover:text-foreground")
      }
    >
      {active && <span className="absolute -left-3 h-6 w-1 rounded-r-full bg-foreground" />}
      {icon}
      {!!badge && (
        <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

/** Colorful pinned-site icon column. */
function IconPinRail({ app }: { app: ReturnType<typeof useApp> }) {
  const pinned = app.pinned.filter((id) => SITES.some((s) => s.id === id));
  return (
    <div className="flex min-h-0 flex-col items-center gap-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {pinned.map((id) => {
        const b = getBrand(id);
        const active = app.activeTab?.siteId === id;
        return (
          <button
            key={id}
            onClick={() => app.openSite(id)}
            title={b.name}
            className={
              "relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-[var(--c)] transition-colors hover:bg-accent " +
              (active ? "ring-2 ring-brand" : "")
            }
            style={{ ["--c" as string]: b.color }}
            dangerouslySetInnerHTML={{ __html: getSiteIconHtml(id) }}
          />
        );
      })}
    </div>
  );
}

/** Content shared by the slim rail's hover panel and the pinned sidebar. */
function RailMenu({
  pinned,
  onNavigate,
  onClose,
  scrollRows,
}: {
  pinned?: boolean;
  onNavigate?: () => void;
  onClose?: () => void;
  scrollRows?: boolean;
}) {
  const app = useApp();
  const nav = (fn: () => void) => () => {
    fn();
    onNavigate?.();
  };
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="truncate text-[13px] font-bold tracking-wide">{pinned ? "Docx" : "Library"}</span>
        {onClose ? (
          <button
            onClick={onClose}
            title="Close menu"
            className="grid h-7 w-7 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X size={15} />
          </button>
        ) : (
          <button
            onClick={() => app.setSidebarPin()}
            title={pinned ? "Unpin sidebar" : "Pin sidebar open"}
            className={
              "grid h-7 w-7 place-items-center rounded transition-colors hover:bg-accent " +
              (pinned ? "text-brand" : "text-muted-foreground")
            }
          >
            {pinned ? <PinOff size={14} /> : <Pin size={14} />}
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2">
        <RailRow
          icon={<Home size={17} />}
          label="Home"
          active={app.activeTabId === "home" && !app.bookmarksOpen}
          onClick={nav(app.goHome)}
        />
        <RailRow
          icon={<BookmarkIcon size={16} />}
          label="Bookmarks"
          active={app.bookmarksOpen}
          onClick={nav(() => app.setBookmarksOpen(true))}
          badge={app.bookmarks.length || undefined}
        />

        <div className="mx-1 my-2 h-px bg-border" />
        <p className="px-2 pb-1 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
          Pinned docs
        </p>

        {scrollRows ? (
          <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <PinnedRows app={app} onNavigate={onNavigate} />
          </div>
        ) : (
          <PinnedRows app={app} onNavigate={onNavigate} />
        )}
      </div>
    </div>
  );
}

/** Colorful labeled list of pinned sites. */
function PinnedRows({ app, onNavigate }: { app: ReturnType<typeof useApp>; onNavigate?: () => void }) {
  const pinned = app.pinned.filter((id) => SITES.some((s) => s.id === id));
  if (!pinned.length) {
    return (
      <p className="px-2 py-3 text-[11.5px] leading-relaxed text-muted-foreground">
        Pin a documentation site from Home to keep it here.
      </p>
    );
  }
  return (
    <>
      {pinned.map((id) => {
        const b = getBrand(id);
        return (
          <button
            key={id}
            onClick={() => {
              app.openSite(id);
              onNavigate?.();
            }}
            onDoubleClick={() => app.togglePin(id)}
            title={`${b.name} — double-click to unpin`}
            className={
              "flex h-9 w-full shrink-0 items-center gap-2.5 rounded px-2 transition-colors " +
              (app.activeTab?.siteId === id ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground")
            }
          >
            <span
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-muted text-[var(--c)]"
              style={{ ["--c" as string]: b.color }}
              dangerouslySetInnerHTML={{ __html: getSiteIconHtml(id) }}
            />
            <span className="min-w-0 flex-1 truncate text-left text-[13px] font-medium">{b.name}</span>
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
        "flex h-9 shrink-0 items-center gap-2.5 rounded px-2 transition-colors " +
        (active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground")
      }
    >
      <span className="grid h-6 w-6 shrink-0 place-items-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-left text-[13px] font-medium">{label}</span>
      {!!badge && (
        <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
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
  const entries = app.entries;
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
      <DialogContent side="left" className="p-0">
        <div className="flex h-full flex-col bg-background-deep">
          <div className="border-b border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
                Browse docs
                <Badge className="border-0 bg-muted text-foreground">{SITES.length}</Badge>
              </span>
              <button
                onClick={() => app.setDrawerOpen(false)}
                className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X size={15} />
              </button>
            </div>
            <div className="relative">
              <SearchIcon size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Find a documentation site"
                className="h-8 pl-8"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2">
            {app.pinned.length > 0 && (
              <DrawerGroup
                key="_pinned"
                label="Pinned"
                list={entries.filter((e) => app.pinned.includes(e.id))}
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
    <div className="mb-2">
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {count}/{list.length}
        </span>
      </div>
      <div className="space-y-px">
        {list.map((e) => (
          <button
            key={e.id}
            onClick={() => (e.installed ? app.openSite(e.id) : app.installSite(e.id))}
            className="group flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left transition-colors hover:bg-accent"
          >
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-muted"
              dangerouslySetInnerHTML={{ __html: getSiteIconHtml(e.id, e.remote?.iconFile, e.remote?.iconETag) }}
            />
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate text-[13px] font-medium">{e.brand.name}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground">{e.brand.version}</span>
            </span>
            <Dot state={e.activeDownload ? "downloading" : e.installed ? (e.updateAvailable ? "update" : "ok") : "none"} />
          </button>
        ))}
      </div>
    </div>
  );
}

export const useAppExport = useApp;

function Dot({ state }: { state: "ok" | "update" | "downloading" | "none" }) {
  if (state === "none") return null;
  if (state === "downloading")
    return (
      <span className="grid h-2 w-2 place-items-center">
        <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
      </span>
    );
  return <span className={"h-2 w-2 rounded-full " + (state === "ok" ? "bg-success" : "bg-warning")} />;
}
