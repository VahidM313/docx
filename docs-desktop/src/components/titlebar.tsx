import * as React from "react";
import { useApp } from "../lib/store";
import { Tauri } from "../lib/tauri";
import { getBrand, EMBEDDED_SITE_IDS } from "../lib/catalog";
import {
  Button,
  Switch,
  Tooltip,
} from "../ui";
import {
  Minus,
  X,
  Square,
  MoonStar,
  Bookmark,
  Search,
  Settings2,
  Download,
  Sparkles,
  Menu,
  Compass,
  Hash,
  Pin,
  Check,
} from "lucide-react";
import { type ReaderPanelsApi } from "./readerPanels";

function WinBtn({
  onClick,
  children,
  danger,
  className,
}: {
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "no-drag flex h-full w-11 items-center justify-center text-muted-foreground transition-colors " +
        (danger ? "hover:bg-danger hover:text-white " : "hover:bg-accent hover:text-foreground ") +
        (className ?? "")
      }
    >
      {children}
    </button>
  );
}

export default function Titlebar(props: {
  readerApi: React.RefObject<ReaderPanelsApi | null>;
  onMobileMenu?: () => void;
}) {
  const app = useApp();
  const active = app.activeTab;
  const isReader = active != null && active.siteId !== "home";
  const brand = active?.siteId ? getBrand(active.siteId) : null;

  const title = isReader ? brand!.name : "Home";
  const darkOn = isReader ? app.effectiveSiteDark(active!.siteId) : app.isDark;
  const forced = app.forceTheme;
  const forcedOn = forced === "dark" || forced === "light";
  const isBookmarked =
    isReader && !!app.bookmarks.find((b) => b.siteId === active!.siteId && b.pathOrUrl === active!.pathOrUrl);

  const outdatedSizeMb = app.entries
    .filter((e) => e.updateAvailable && e.installed)
    .reduce((a, e) => a + (e.remote?.sizeBytes ?? 0) / (1024 * 1024), 0);

  return (
    <header className="drag-region relative z-40 flex h-12 w-full shrink-0 items-center gap-1 border-b border-border bg-background-deep px-1.5">
      {/* mobile navigation */}
      <button
        onClick={props.onMobileMenu}
        className="no-drag grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
        title="Menu"
      >
        <Menu size={18} />
      </button>

      <Tooltip label="Browse all documentation">
        <button
          onClick={() => app.setDrawerOpen(true)}
          className="no-drag hidden h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:grid"
        >
          <Compass size={17} />
        </button>
      </Tooltip>

      <button
        onClick={app.goHome}
        className="no-drag flex shrink-0 items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-accent"
        title="Home"
      >
        <img src="/logo.png" alt="Docx" className="logo-glyph h-6 w-6" draggable={false} />
        <span className="hidden text-[13.5px] font-semibold tracking-tight sm:inline">Docx</span>
      </button>

      <span className="mx-1 h-5 w-px shrink-0 bg-border-strong" />

      <div className="flex min-w-0 items-center gap-1.5">
        <Hash size={16} className="shrink-0 text-muted-foreground" />
        <span className="truncate text-[13.5px] font-semibold text-foreground">{title}</span>
        {isReader && brand && (
          <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">{brand.version}</span>
        )}
      </div>

      {/* search */}
      <button
        onClick={() => app.setPaletteOpen(true)}
        className="no-drag mx-auto hidden h-7 min-w-0 max-w-[420px] flex-1 items-center gap-2 rounded-md bg-input px-2.5 text-left text-[12.5px] text-muted-foreground transition-colors hover:bg-accent sm:flex"
        title="Search docs (Ctrl+K)"
      >
        <Search size={13} />
        <span className="truncate">Search documentation</span>
        <kbd className="ml-auto hidden shrink-0 rounded border border-border-strong px-1 text-[10px] md:inline">
          Ctrl K
        </kbd>
      </button>

      <div className="flex-1 sm:hidden" />

      <button
        onClick={() => app.setPaletteOpen(true)}
        className="no-drag grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:hidden"
        title="Search (Ctrl+K)"
      >
        <Search size={16} />
      </button>

      {/* update pill */}
      {app.outdatedCount > 0 && (
        <Tooltip label={`Update ${app.outdatedCount} packs (${outdatedSizeMb.toFixed(0)} MB)`}>
          <button
            onClick={() => app.batchUpdateOutdated()}
            className="no-drag hidden items-center gap-1.5 rounded-md bg-brand/15 px-2 py-1 text-[11px] font-semibold text-brand transition-colors hover:bg-brand/25 lg:flex"
          >
            <Download size={12} />
            {app.outdatedCount} · {outdatedSizeMb.toFixed(0)} MB
          </button>
        </Tooltip>
      )}

      {/* reader actions */}
      {isReader && (
        <>
          <Tooltip
            label={
              forced === "dark"
                ? "Force dark is on — click to use per-site themes"
                : forced === "light"
                  ? "Force light is on — click to use per-site themes"
                  : darkOn
                    ? "Make this page light"
                    : "Make this page dark"
            }
          >
            <Button
              variant="ghost"
              size="sm"
              className={"no-drag h-8 gap-1.5 px-2 " + (forcedOn ? "text-brand" : "")}
              onClick={() => {
                if (forcedOn) {
                  app.setForceTheme("off");
                  app.toast({ kind: "info", message: "Back to per-site themes" });
                } else if (EMBEDDED_SITE_IDS.includes(active!.siteId) || !props.readerApi.current) {
                  app.toggleSiteDark(active!.siteId);
                } else {
                  props.readerApi.current.toggleDark(active!.siteId);
                }
              }}
            >
              <MoonStar size={15} className={forced === "dark" || (forced === "off" && darkOn) ? "text-amber-400" : ""} />
              <span className="hidden text-xs lg:inline">
                {forced === "dark" ? "Force dark" : forced === "light" ? "Force light" : darkOn ? "Dark" : "Light"}
              </span>
            </Button>
          </Tooltip>

          {(isBookmarked || forced === "off") && (
            <Tooltip label={isBookmarked ? "Remove bookmark" : "Bookmark page"}>
              <Button
                variant="ghost"
                size="sm"
                className={"no-drag h-8 gap-1.5 px-2 " + (isBookmarked ? "text-brand" : "")}
                onClick={() => props.readerApi.current?.bookmarkToggle(active!)}
              >
                <Bookmark size={15} fill={isBookmarked ? "currentColor" : "none"} />
                <span className="hidden text-xs lg:inline">{isBookmarked ? "Saved" : "Save"}</span>
              </Button>
            </Tooltip>
          )}
        </>
      )}

      <FeaturesMenu />

      <div className="no-drag ml-1 hidden h-full items-center border-l border-border md:flex">
        <WinBtn onClick={() => Tauri.windowMinimize()}>
          <Minus size={14} />
        </WinBtn>
        <WinBtn onClick={() => Tauri.windowToggleMaximize()}>
          <Square size={11} />
        </WinBtn>
        <WinBtn onClick={() => Tauri.windowClose()} danger>
          <X size={15} />
        </WinBtn>
      </div>
    </header>
  );
}

function FeaturesMenu() {
  const app = useApp();
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const forces: { key: "off" | "dark" | "light"; label: string }[] = [
    { key: "off", label: "Per-site" },
    { key: "dark", label: "Dark" },
    { key: "light", label: "Light" },
  ];

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative flex h-full items-center">
      <Button
        variant="ghost"
        size="iconSm"
        className="no-drag"
        title="Settings"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Settings2 size={16} />
      </Button>

      {open && (
        <div className="animate-pop absolute right-0 top-[calc(100%+4px)] z-[100] w-72 rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-lift">
          <MenuLabel>Docx settings</MenuLabel>
          <div className="flex items-center justify-between rounded px-2 py-2 text-sm">
            <span>Site tabs</span>
            <Switch checked={app.flags.siteTabs} onCheckedChange={(v) => app.setFlag("siteTabs", v)} />
          </div>
          <div className="flex items-center justify-between rounded px-2 py-2 text-sm">
            <span>Per-site theme & font</span>
            <Switch checked={app.flags.themeSync} onCheckedChange={(v) => app.setFlag("themeSync", v)} />
          </div>
          <div className="flex items-center justify-between rounded px-2 py-2 text-sm">
            <span>Custom reading font</span>
            <Switch checked={app.flags.customFont} onCheckedChange={(v) => app.setFlag("customFont", v)} />
          </div>

          <MenuLabel>Sidebar</MenuLabel>
          <button
            onClick={() => {
              app.toggleSidebarPin();
              setOpen(false);
            }}
            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
          >
            <span className="flex items-center gap-2">
              <Pin size={13} className={app.pins.sidebar ? "text-brand" : ""} /> Main sidebar
            </span>
            <span className="text-[10.5px] text-muted-foreground">
              {app.pins.sidebar ? "pinned" : "hover to reveal"}
            </span>
          </button>

          <MenuLabel>Site theme</MenuLabel>
          <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
            {forces.map((f) => (
              <button
                key={f.key}
                onClick={() => app.setForceTheme(f.key)}
                className={
                  "rounded px-2 py-1.5 text-[11.5px] font-medium transition-colors " +
                  (app.forceTheme === f.key
                    ? "bg-brand text-white"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground")
                }
              >
                {app.forceTheme === f.key ? (
                  <span className="flex items-center justify-center gap-1">
                    <Check size={11} /> {f.label}
                  </span>
                ) : (
                  f.label
                )}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              app.checkAppUpdate();
              setOpen(false);
            }}
            className="mt-1 flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
          >
            <span className="flex items-center gap-2">
              <Sparkles size={14} /> Check app update
            </span>
            {app.appUpdate?.update_available && <Badgeish>v{app.appUpdate.target_version}</Badgeish>}
          </button>
          {app.appUpdate?.update_available && (
            <button
              onClick={() => {
                app.selfUpdateApp();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-red-500 transition-colors hover:bg-accent"
            >
              <Download size={14} /> Update app now
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">{children}</p>
  );
}

function Badgeish({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">{children}</span>;
}
