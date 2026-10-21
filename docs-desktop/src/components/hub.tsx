import * as React from "react";
import { useApp, type SiteEntry } from "../lib/store";
import { Tauri } from "../lib/tauri";
import { SITE_CATEGORIES, CAT_LABEL, getSiteIconHtml } from "../lib/catalog";
import { Button, Badge, Input } from "../ui";
import {
  ArrowDownToLine,
  ArrowUpCircle,
  HardDrive,
  HardDriveDownload,
  Pin,
  PinOff,
  RefreshCw,
  Search as SearchIcon,
  Trash2,
  Zap,
  Compass,
} from "lucide-react";

export default function HomeHub() {
  const app = useApp();
  const [q, setQ] = React.useState("");
  const [checkingUpdates, setCheckingUpdates] = React.useState(false);

  // Remember active category tab across document switches and returns to Home
  const [cat, setCatState] = React.useState<string>(() => {
    try {
      return localStorage.getItem("docx_hub_selected_category") || "all";
    } catch {
      return "all";
    }
  });

  const setCat = React.useCallback((nextCat: string) => {
    try {
      localStorage.setItem("docx_hub_selected_category", nextCat);
    } catch {}
    setCatState(nextCat);
  }, []);

  const entries = app.entries;
  const installed = React.useMemo(() => entries.filter((e) => e.installed), [entries]);
  const outdated = React.useMemo(() => entries.filter((e) => e.updateAvailable && e.installed), [entries]);
  const totalMb = React.useMemo(
    () => entries.reduce((a, e) => a + (e.remote?.sizeBytes ?? 0) / (1024 * 1024), 0),
    [entries],
  );
  const installedSizeMb = React.useMemo(
    () => installed.reduce((a, e) => a + (e.local?.size_mb ?? 0), 0),
    [installed],
  );
  const outdatedSizeMb = React.useMemo(
    () => outdated.reduce((a, e) => a + (e.remote?.sizeBytes ?? 0) / (1024 * 1024), 0),
    [outdated],
  );

  const filtered = React.useMemo(() => {
    const ql = q.toLowerCase();
    return entries.filter(
      (e) =>
        (cat === "all" || e.brand.category === cat) &&
        (!ql || `${e.brand.name} ${e.id} ${e.brand.category}`.toLowerCase().includes(ql)),
    );
  }, [entries, q, cat]);

  // Current category stats & actions
  const categoryEntries = React.useMemo(() => {
    return cat === "all" ? entries : entries.filter((e) => e.brand.category === cat);
  }, [entries, cat]);

  const categoryInstalled = React.useMemo(() => {
    return categoryEntries.filter((e) => e.installed);
  }, [categoryEntries]);

  const categoryMissing = React.useMemo(() => {
    return categoryEntries.filter((e) => !e.installed && !e.activeDownload);
  }, [categoryEntries]);

  // 1. Check for app & docpack updates
  const handleCheckForUpdates = async () => {
    setCheckingUpdates(true);
    app.toast({ kind: "progress", message: "Checking for updates…", percent: 0 });
    try {
      await app.refreshPacks({ withRegistry: true });
      let appUpdated = false;
      try {
        const res = await Tauri.checkAppUpdate();
        if (res && res.update_available) {
          appUpdated = true;
          app.toast({
            kind: "info",
            message: `New Docx version available: v${res.target_version} (current: v${res.current_version})`,
          });
        }
      } catch {}

      const freshRegistry = await Tauri.getRemoteRegistry().catch(() => []);
      const freshInstalled = await Tauri.getInstalledPacks().catch(() => []);
      const installedIds = freshInstalled.map((p) => p.id);
      const availableUpdates = freshRegistry.filter(
        (r) => installedIds.includes(r.id) && r.update_available
      );

      if (availableUpdates.length > 0) {
        app.toast({
          kind: "info",
          message: `Found ${availableUpdates.length} docpack update${availableUpdates.length > 1 ? "s" : ""}!`,
        });
      } else if (!appUpdated) {
        app.toast({
          kind: "success",
          message: "Docx and all installed documentation packs are up to date! ✨",
        });
      }
    } catch (e) {
      app.toast({ kind: "error", message: `Update check failed: ${String(e).slice(0, 100)}` });
    } finally {
      setCheckingUpdates(false);
    }
  };

  // 2. Global Delete All Docs
  const handleDeleteAllDocs = async () => {
    if (installed.length === 0) {
      return app.toast({ kind: "info", message: "No documentation packs are currently installed." });
    }
    const confirmed = window.confirm(
      `Are you sure you want to delete all ${installed.length} installed documentation packs? This will delete local files and free up disk space.`
    );
    if (!confirmed) return;

    app.toast({ kind: "progress", message: `Deleting all ${installed.length} documentation packs…`, percent: 0 });
    const results = await Promise.allSettled(installed.map((e) => app.deleteSite(e.id)));
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      app.toast({ kind: "error", message: `Deleted ${installed.length - failed} packs (${failed} failed)` });
    } else {
      app.toast({ kind: "success", message: `All ${installed.length} documentation packs deleted successfully.` });
    }
  };

  // 3. Category Download All
  const handleDownloadCategory = async (categoryName: string) => {
    const missing = entries.filter(
      (e) => e.brand.category === categoryName && !e.installed && !e.activeDownload
    );
    if (missing.length === 0) {
      return app.toast({ kind: "info", message: `All packs in ${categoryName} are already installed.` });
    }
    app.toast({ kind: "progress", message: `Downloading ${missing.length} packs in ${categoryName}…`, percent: 0 });
    Promise.allSettled(missing.map((e) => app.installSite(e.id)));
  };

  // 4. Category Delete All
  const handleDeleteCategory = async (categoryName: string) => {
    const toDelete = entries.filter((e) => e.brand.category === categoryName && e.installed);
    if (toDelete.length === 0) {
      return app.toast({ kind: "info", message: `No installed packs in ${categoryName}.` });
    }
    const confirmed = window.confirm(
      `Delete all ${toDelete.length} installed packs in "${categoryName}"?`
    );
    if (!confirmed) return;

    app.toast({ kind: "progress", message: `Deleting ${toDelete.length} packs in ${categoryName}…`, percent: 0 });
    await Promise.allSettled(toDelete.map((e) => app.deleteSite(e.id)));
    app.toast({ kind: "success", message: `Deleted ${toDelete.length} packs in ${categoryName}.` });
  };

  return (
    <div className="h-full overflow-y-auto">
      {/* header */}
      <div className="border-b border-border px-4 py-5 md:px-8 md:py-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              <Compass size={13} className="text-brand" />
              Offline documentation
            </div>
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">Home</h1>
            <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">
              {entries.length} documentation ecosystems, cached locally. Everything below works without a connection.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {outdated.length > 0 && (
              <Button
                variant="gradient"
                size="sm"
                className="gap-1.5"
                onClick={() => app.batchUpdateOutdated()}
              >
                <ArrowUpCircle size={14} /> Update all · {outdated.length}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={checkingUpdates}
              onClick={handleCheckForUpdates}
              title="Check for desktop updates and docpack releases"
            >
              <RefreshCw size={13} className={checkingUpdates ? "animate-spin text-brand" : ""} /> Check for updates
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                const missing = entries.filter((e) => !e.installed && !e.activeDownload).map((e) => e.id);
                if (!missing.length) return app.toast({ kind: "info", message: "Every pack is already installed." });
                Promise.allSettled(missing.map((id) => app.installSite(id)));
              }}
              title="Download all missing offline documentation packs across the library"
            >
              <ArrowDownToLine size={14} /> Get missing
            </Button>

            {installed.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-danger hover:bg-danger/10 hover:text-danger hover:border-danger/40"
                onClick={handleDeleteAllDocs}
                title="Delete all installed offline packs across all categories"
              >
                <Trash2 size={13} /> Delete all docs
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <StatChip icon={<HardDriveDownload size={13} />} label="Installed" value={`${installed.length}/${entries.length}`} />
          <StatChip
            icon={<ArrowUpCircle size={13} />}
            label="Updates"
            value={outdated.length ? `${outdated.length} · ${outdatedSizeMb.toFixed(0)} MB` : "none"}
            highlight={outdated.length > 0}
          />
          <StatChip icon={<HardDrive size={13} />} label="On disk" value={`${Math.round(installedSizeMb)} MB`} />
          <StatChip icon={<Zap size={13} />} label="Full library" value={`${Math.round(totalMb)} MB`} />
        </div>
      </div>

      {/* filter bar */}
      <div className="sticky top-0 z-20 flex items-center gap-1.5 overflow-x-auto border-b border-border bg-background px-4 py-2 md:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <CatChip label="All" value="all" active={cat} setActive={setCat} />
        {SITE_CATEGORIES.map((c) => (
          <CatChip key={c} label={CAT_LABEL[c] ?? c} value={c} active={cat} setActive={setCat} />
        ))}
        <div className="relative ml-auto w-44 shrink-0 md:w-56">
          <SearchIcon size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter sites" className="h-8 pl-8 text-[13px]" />
        </div>
      </div>

      {/* Category Action Strip (when viewing a specific category) */}
      {cat !== "all" && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/60 px-4 py-2.5 md:px-8">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category:</span>
            <span className="text-xs font-bold text-foreground">{cat}</span>
            <Badge className="text-[10.5px]">
              {categoryInstalled.length}/{categoryEntries.length} installed
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {categoryMissing.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => handleDownloadCategory(cat)}
              >
                <ArrowDownToLine size={12} /> Download all in category ({categoryMissing.length})
              </Button>
            )}
            {categoryInstalled.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 text-danger hover:bg-danger/10 hover:text-danger hover:border-danger/40"
                onClick={() => handleDeleteCategory(cat)}
              >
                <Trash2 size={12} /> Delete all in category ({categoryInstalled.length})
              </Button>
            )}
          </div>
        </div>
      )}

      {/* grid */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3 px-4 py-4 pb-16 md:px-8">
        {filtered.map((e) => (
          <SiteCard key={e.id} entry={e} />
        ))}
      </div>
    </div>
  );
}

function CatChip({
  label,
  value,
  active,
  setActive,
}: {
  label: string;
  value: string;
  active: string;
  setActive: (v: string) => void;
}) {
  const isActive = active === value;
  return (
    <button
      onClick={() => setActive(isActive ? "all" : value)}
      className={
        "shrink-0 rounded px-2.5 py-1 text-[12px] font-medium transition-colors " +
        (isActive ? "bg-brand text-white" : "text-muted-foreground hover:bg-accent hover:text-foreground")
      }
    >
      {label}
    </button>
  );
}

function StatChip({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5">
      <span className={highlight ? "text-brand" : "text-muted-foreground"}>{icon}</span>
      <span className="text-[12px] font-semibold">{value}</span>
      <span className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

function formatDocBytes(bytes?: number, sizeMb?: number): string {
  let b = 0;
  if (bytes != null && bytes > 0) {
    b = bytes;
  } else if (sizeMb != null && sizeMb > 0) {
    b = Math.round(sizeMb * 1024 * 1024);
  }
  if (!b || b <= 0) return "0 KB";
  if (b < 1024 * 1024) {
    return `${Math.round(b / 1024)} KB`;
  }
  const mb = b / (1024 * 1024);
  return mb < 10 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`;
}

/* ---------------- Site card ---------------- */
const SiteCard = React.memo(function SiteCard({ entry }: { entry: SiteEntry }) {
  const app = useApp();
  const b = entry.brand;
  const pinned = app.pinned.includes(entry.id);
  const [menuOpen, setMenuOpen] = React.useState<ContextPosition | null>(null);
  const dl = entry.activeDownload;

  return (
    <div
      className="group relative flex min-h-[158px] cursor-pointer flex-col rounded-lg border border-border bg-card p-3.5 transition-colors hover:border-border-strong hover:bg-accent/30"
      onClick={() => {
        if (entry.installed) app.openSite(entry.id);
        else app.installSite(entry.id);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenuOpen({ x: e.clientX, y: e.clientY });
      }}
    >
      <button
        onClick={(ev) => {
          ev.stopPropagation();
          app.togglePin(entry.id);
        }}
        className={
          "absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded transition-colors " +
          (pinned
            ? "bg-brand text-white"
            : "bg-muted text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-foreground")
        }
        title={pinned ? "Unpin from sidebar" : "Pin to sidebar"}
      >
        {pinned ? <PinOff size={11} /> : <Pin size={11} />}
      </button>

      <div className="flex items-start gap-2.5">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-muted"
          dangerouslySetInnerHTML={{ __html: getSiteIconHtml(entry.id, entry.remote?.iconFile, entry.remote?.iconETag) }}
        />
        <div className="min-w-0 flex-1 pr-6">
          <div className="truncate text-[13.5px] font-semibold leading-tight">{b.name}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
            <span className="font-medium" style={{ color: b.color }}>
              {b.version}
            </span>
            <span className="text-border-strong">•</span>
            <span>
              {entry.activeDownload
                ? "downloading…"
                : entry.installed
                  ? formatDocBytes(undefined, entry.local!.size_mb)
                  : entry.remote
                    ? formatDocBytes(entry.remote.sizeBytes)
                    : "not available"}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-2 line-clamp-2 flex-1 text-[11.5px] leading-relaxed text-muted-foreground">{b.description}</p>

      <div className="mt-3 flex items-center gap-2">
        {entry.activeDownload && entry.activeDownload.percent < 100 ? (
          <div className="flex-1">
            <div className="mb-1 flex justify-between text-[10px] font-medium text-muted-foreground">
              <span>{entry.activeDownload.phase}</span>
              <span className="tabular-nums">{Math.round(entry.activeDownload.percent)}%</span>
            </div>
            <ProgressBar percent={entry.activeDownload.percent} />
          </div>
        ) : entry.updateAvailable ? (
          <>
            <Button
              variant="gradient"
              size="sm"
              className="h-7 flex-1 gap-1.5 text-[11.5px]"
              onClick={(ev) => {
                ev.stopPropagation();
                app.installSite(entry.id);
              }}
            >
              <ArrowUpCircle size={12} /> Update
            </Button>
            <OpenChip />
          </>
        ) : entry.installed ? (
          <>
            <OpenChip />
            <Button
              variant="ghost"
              size="iconSm"
              className="ml-auto shrink-0 hover:bg-danger/10 hover:text-danger"
              title="Delete pack"
              onClick={(ev) => {
                ev.stopPropagation();
                app.deleteSite(entry.id);
              }}
            >
              <Trash2 size={12} />
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-7 flex-1 gap-1.5 text-[11.5px]"
              onClick={(ev) => {
                ev.stopPropagation();
                app.installSite(entry.id);
              }}
            >
              <ArrowDownToLine size={12} /> Install
            </Button>
            {entry.remote && (
              <Badge className="text-[10px] text-muted-foreground">
                {formatDocBytes(entry.remote.sizeBytes)}
              </Badge>
            )}
          </>
        )}
      </div>

      {dl && dl.percent >= 100 && (
        <div className="absolute inset-x-4 bottom-2 text-center text-[10px] font-semibold text-success">
          Indexed — opening…
        </div>
      )}

      {menuOpen && (
        <SiteContextMenu pos={menuOpen} entry={entry} pinned={pinned} onClose={() => setMenuOpen(null)} />
      )}
    </div>
  );
});

function OpenChip() {
  return (
    <Button variant="soft" size="sm" className="h-7 flex-1 gap-1.5 text-[11.5px]">
      Open
    </Button>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-brand transition-[width] duration-300"
        style={{ width: `${Math.min(100, Math.max(4, percent))}%` }}
      />
    </div>
  );
}

type ContextPosition = { x: number; y: number };

function SiteContextMenu({
  pos,
  entry,
  pinned,
  onClose,
}: {
  pos: ContextPosition;
  entry: SiteEntry;
  pinned: boolean;
  onClose: () => void;
}) {
  const app = useApp();
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [onClose]);

  const top = Math.min(pos.y, window.innerHeight - 170);
  const left = Math.min(pos.x, window.innerWidth - 200);

  return (
    <div
      ref={ref}
      className="fixed z-[80] w-48 overflow-visible rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lift animate-pop"
      style={{ top, left }}
    >
      <MenuItem
        icon={<Pin size={13} className={pinned ? "text-brand" : ""} />}
        onClick={() => {
          app.togglePin(entry.id);
          onClose();
        }}
      >
        {pinned ? "Unpin from sidebar" : "Pin to sidebar"}
      </MenuItem>
      {entry.installed && entry.updateAvailable && (
        <MenuItem
          icon={<ArrowUpCircle size={13} />}
          onClick={() => {
            app.installSite(entry.id);
            onClose();
          }}
        >
          Update now
        </MenuItem>
      )}
      <MenuItem
        icon={<ArrowDownToLine size={13} />}
        onClick={() => {
          navigator.clipboard?.writeText(entry.id).catch(() => {});
          app.toast({ kind: "info", message: `Pack id copied: ${entry.id}` });
          onClose();
        }}
      >
        Copy pack id
      </MenuItem>
      {entry.installed && (
        <MenuItem
          danger
          icon={<Trash2 size={13} />}
          onClick={() => {
            app.deleteSite(entry.id);
            onClose();
          }}
        >
          Delete offline pack
        </MenuItem>
      )}
    </div>
  );
}

export function MenuItem({
  icon,
  onClick,
  children,
  danger,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[12.5px] transition-colors " +
        (danger ? "text-danger hover:bg-danger/10" : "hover:bg-accent")
      }
    >
      {icon}
      {children}
    </button>
  );
}
