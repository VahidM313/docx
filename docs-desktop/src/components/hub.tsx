import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useApp, type SiteEntry } from "../lib/store";
import { SITE_CATEGORIES, getSiteIconHtml } from "../lib/catalog";
import { Button, Badge, Input } from "../ui";
import {
  ArrowDownToLine,
  ArrowUpCircle,
  HardDrive,
  HardDriveDownload,
  Pin,
  PinOff,
  Search as SearchIcon,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";

export default function HomeHub() {
  const app = useApp();
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState<string>("all");

  const entries = app.entries;
  const installed = entries.filter((e) => e.installed);
  const outdated = entries.filter((e) => e.updateAvailable && e.installed);
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
  const installedPercent = entries.length ? (installed.length / entries.length) * 100 : 0;

  const filtered = React.useMemo(() => {
    const ql = q.toLowerCase();
    return entries.filter(
      (e) =>
        (cat === "all" || e.brand.category === cat) &&
        (!ql || `${e.brand.name} ${e.id} ${e.brand.category}`.toLowerCase().includes(ql)),
    );
  }, [entries, q, cat]);

  return (
    <div className="relative h-full overflow-y-auto">
      {/* ---------------- Hero ---------------- */}
      <div className="relative overflow-hidden border-b border-border px-6 pb-8 pt-6 md:px-10">
        <Aurora />
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Sparkles size={13} className="grad-text" />
            Offline documentation hub
          </div>
          <h1 className="text-3xl font-black tracking-tight md:text-[40px] md:leading-[1.1]">
            Your entire staircase of{" "}
            <span className="grad-text">developer docs</span>
            <br className="hidden md:block" /> — fast, offline, always current.
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.45 }}
          className="mt-5 flex flex-wrap items-center gap-3"
        >
          <StatCard label="Installed" value={installed.length} suffix={`/ ${entries.length}`}>
            <HardDriveDownload size={15} />
          </StatCard>
          <StatCard
            label="Updates ready"
            value={outdated.length}
            suffix={outdatedSizeMb > 0 ? `· ${outdatedSizeMb.toFixed(0)} MB` : undefined}
            highlight={outdated.length > 0}
          >
            <ArrowUpCircle size={15} />
          </StatCard>
          <StatCard label="Installed size" value={Math.round(installedSizeMb)} suffix="MB" subtle>
            <HardDrive size={15} />
          </StatCard>
          <StatCard label="Full library" value={Math.round(totalMb)} suffix="MB" subtle>
            <Zap size={15} />
          </StatCard>

          <div className="ml-auto flex gap-2">
            {outdated.length > 0 && (
              <Button
                variant="gradient"
                size="sm"
                className="gap-2"
                title={`Delta-downloads only changed chunks where possible`}
                onClick={() => app.batchUpdateOutdated()}
              >
                <ArrowUpCircle size={14} /> Update all ({outdated.length} · {outdatedSizeMb.toFixed(0)} MB)
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                const missing = entries.filter((e) => !e.installed && !e.activeDownload).map((e) => e.id);
                if (!missing.length) return app.toast({ kind: "info", message: "Every pack is already installed 🎉" });
                Promise.allSettled(missing.map((id) => app.installSite(id)));
              }}
            >
              <ArrowDownToLine size={14} /> Get missing
            </Button>
          </div>
        </motion.div>
      </div>

      {/* ---------------- Filter bar ---------------- */}
      <div className="sticky top-0 z-20 flex items-center gap-2 overflow-x-auto border-b border-border bg-[var(--surface-translucent)] px-6 py-2.5 backdrop-blur-md md:px-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <CatChip label="All" value="all" active={cat} setActive={setCat} />
        {SITE_CATEGORIES.map((c) => (
          <CatChip key={c} label={CAT_LABEL[c] ?? c} value={c} active={cat} setActive={setCat} />
        ))}
        <div className="relative ml-auto w-44 shrink-0">
          <SearchIcon size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sites" className="h-8 pl-8 text-[13px]" />
        </div>
      </div>

      {/* ---------------- Grid ---------------- */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3.5 px-6 py-5 pb-16 md:grid-cols-[repeat(auto-fill,minmax(270px,1fr))] md:px-10">
        <AnimatePresence mode="popLayout">
          {filtered.map((e, i) => (
            <motion.div
              key={e.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: Math.min(i * 0.015, 0.35), type: "spring", stiffness: 420, damping: 32 }}
            >
              <SiteCard entry={e} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

const CAT_LABEL: Record<string, string> = {
  "Frontend & UI": "Frontend",
  "React Ecosystem": "React",
  "Vue Ecosystem": "Vue",
  "Web Frameworks & Tools": "Frameworks",
  "TanStack Suite": "TanStack",
  "Backend, Auth & APIs": "Backend",
  "Databases & SQL": "Databases",
  "AI & Machine Learning": "AI/ML",
  "Python Ecosystem": "Python",
  "Rust Ecosystem": "Rust",
  "Go (Golang)": "Go",
  "C & C++ Ecosystem": "C/C++",
  "DevOps & Cloud": "DevOps",
  "Architecture & Design": "Design",
};

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
        "relative shrink-0 rounded-full px-3 py-1 text-[12px] font-medium transition-colors " +
        (isActive ? "text-white" : "text-muted-foreground hover:text-foreground")
      }
    >
      {isActive && (
        <motion.span
          layoutId="cat-chip"
          className="absolute inset-0 rounded-full grad-bg shadow-soft"
          transition={{ type: "spring", stiffness: 500, damping: 36 }}
        />
      )}
      <span className="relative z-10">{label}</span>
    </button>
  );
}

function Aurora() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div
        className="aurora-blob h-56 w-72 animate-float"
        style={{ background: "var(--grad-a)", top: "-70px", left: "6%", animationDelay: "0s" }}
      />
      <div
        className="aurora-blob h-64 w-80 animate-float"
        style={{ background: "var(--grad-b)", top: "-40px", left: "42%", animationDelay: "1.4s" }}
      />
      <div
        className="aurora-blob h-52 w-96 animate-float"
        style={{ background: "var(--grad-c)", top: "-90px", right: "6%", animationDelay: "2.8s" }}
      />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[var(--background)]" />
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
  highlight,
  subtle,
  children,
}: {
  label: string;
  value: number;
  suffix?: string;
  highlight?: boolean;
  subtle?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={undefined}
      className={
        "group flex items-center gap-3 rounded-2xl border px-4 py-2.5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift " +
        (highlight
          ? "border-[var(--grad-b)]/40 bg-[var(--grad-b)]/10"
          : subtle
            ? "border-border bg-surface/70"
            : "border-border bg-surface shadow-soft")
      }
    >
      <span
        className={
          "grid h-8 w-8 place-items-center rounded-xl transition-transform group-hover:scale-110 " +
          (highlight ? "grad-bg text-white" : "bg-muted text-muted-foreground")
        }
      >
        {children}
      </span>
      <span>
        <span className="block text-lg font-bold leading-none tabular-nums">
          {value}
          {suffix && <span className={"text-[11px] font-medium text-muted-foreground"}> {suffix}</span>}
        </span>
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </span>
    </button>
  );
}

/* ---------------- Site card ---------------- */
function SiteCard({ entry }: { entry: SiteEntry }) {
  const app = useApp();
  const b = entry.brand;
  const pinned = app.pinned.includes(entry.id);
  const [menuOpen, setMenuOpen] = React.useState<ContextPosition | null>(null);
  const dl = entry.activeDownload;

  return (
    <div
      className="grad-border group relative flex h-[164px] cursor-pointer flex-col rounded-2xl border border-border bg-card p-4 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
      onClick={() => {
        if (entry.installed) app.openSite(entry.id);
        else app.installSite(entry.id);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenuOpen({ x: e.clientX, y: e.clientY });
      }}
    >
      {/* floating pin */}
      <button
        onClick={(ev) => {
          ev.stopPropagation();
          app.togglePin(entry.id);
        }}
        className={
          "absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-lg text-[11px] transition-all " +
          (pinned
            ? "grad-bg text-white opacity-100 shadow-soft"
            : "bg-muted text-muted-foreground opacity-0 group-hover:opacity-100 hover:scale-110")
        }
        title={pinned ? "Unpin" : "Pin to sidebar"}
      >
        {pinned ? <PinOff size={11} /> : <Pin size={11} />}
      </button>

      <div className="flex items-start gap-3">
        <motion.span
          whileHover={{ rotate: [0, -6, 6, 0], scale: 1.1 }}
          transition={{ duration: 0.45 }}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
          style={{ background: b.bgTint, color: b.color, boxShadow: `0 6px 18px -8px ${b.color}55` }}
          dangerouslySetInnerHTML={{ __html: getSiteIconHtml(entry.id, entry.remote?.iconFile, entry.remote?.iconETag) }}
        />
        <div className="min-w-0 flex-1 pr-6">
          <div className="flex items-baseline gap-1.5">
            <span className="truncate text-[14.5px] font-semibold leading-tight">{b.name}</span>
          </div>
          <div className="mt-0 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="font-medium" style={{ color: b.color }}>
              {b.version}
            </span>
            <span className="flex items-center gap-1">
              •
              {entry.activeDownload
                ? "downloading…"
                : entry.installed
                  ? `${entry.local!.size_mb} MB`
                  : entry.remote
                    ? `${Math.round(entry.remote.sizeBytes / (1024 * 1024))} MB`
                    : "remote only"}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-2 line-clamp-2 flex-1 text-[12px] leading-relaxed text-muted-foreground">{b.description}</p>

      {/* action row */}
      <div className="mt-3 flex items-center gap-2">
        {entry.activeDownload && entry.activeDownload.percent < 100 ? (
          <div className="flex-1">
            <div className="mb-1 flex justify-between text-[10px] font-medium text-muted-foreground">
              <span>{entry.activeDownload.phase}</span>
              <span className="tabular-nums">{Math.round(entry.activeDownload.percent)}%</span>
            </div>
            <ProgressShine percent={entry.activeDownload.percent} />
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
              className="ml-auto shrink-0 transition-colors hover:bg-red-500/10 hover:text-red-500"
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
                {Math.round(entry.remote.sizeBytes / (1024 * 1024))} MB
              </Badge>
            )}
          </>
        )}
      </div>

      {dl && dl.percent >= 100 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute inset-x-4 bottom-2 text-center text-[10px] font-semibold text-emerald-500"
        >
          ✓ Indexed — opening…
        </motion.div>
      )}

      {menuOpen && (
        <SiteContextMenu pos={menuOpen} entry={entry} pinned={pinned} onClose={() => setMenuOpen(null)} />
      )}
    </div>
  );
}

function OpenChip() {
  return (
    <Button variant="soft" size="sm" className="h-7 flex-1 gap-1.5 text-[11.5px]">
      Open
    </Button>
  );
}

function ProgressShine({ percent }: { percent: number }) {
  return (
    <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
      <motion.div
        className="grad-bg h-full rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(4, percent))}%` }}
        transition={{ ease: "easeOut", duration: 0.4 }}
      />
      <div
        className="absolute inset-0 rounded-full opacity-60"
        style={{
          background:
            "linear-gradient(110deg, transparent 30%, rgba(255,255,255,.55) 50%, transparent 70%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 2.2s linear infinite",
        }}
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

  const top = Math.min(pos.y, window.innerHeight - 150);
  const left = Math.min(pos.x, window.innerWidth - 190);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed z-[80] w-44 overflow-visible rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lift"
      style={{ top, left }}
    >
      <MenuItem
        icon={<Pin size={13} className={pinned ? "grad-text" : ""} />}
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
    </motion.div>
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
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition-colors " +
        (danger ? "text-red-500 hover:bg-red-500/10" : "hover:bg-accent")
      }
    >
      {icon}
      {children}
    </button>
  );
}
