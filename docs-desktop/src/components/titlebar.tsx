import * as React from "react";
import { useApp } from "../lib/store";
import { Tauri } from "../lib/tauri";
import { getBrand, EMBEDDED_SITE_IDS } from "../lib/catalog";
import { Button, Switch, Tooltip, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem } from "../ui";
import {
  Minus,
  PanelLeft,
  X,
  Square,
  Copy,
  MoonStar,
  Bookmark,
  Maximize,
  Search,
  Settings2,
  Download,
  Sparkles,
  ChevronUp,
  EyeOff,
} from "lucide-react";
import { type ReaderPanelsApi } from "./readerPanels";
import { motion, AnimatePresence } from "framer-motion";

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
        (danger ? "hover:bg-red-500 hover:text-white " : "hover:bg-accent hover:text-foreground ") +
        (className ?? "")
      }
    >
      {children}
    </button>
  );
}

export default function Titlebar(props: { readerApi: React.RefObject<ReaderPanelsApi | null> }) {
  const app = useApp();
  const active = app.activeTab;
  const isReader = active != null && active.siteId !== "home";
  const brand = active?.siteId ? getBrand(active.siteId) : null;

  const title = isReader ? `${brand!.name} ${brand!.version}` : "123-Site Documentation Hub";
  const darkOn = isReader ? app.effectiveSiteDark(active!.siteId) : app.isDark;
  const forced = app.forceTheme;
  const forcedOn = forced === "dark" || forced === "light";
  const isBookmarked =
    isReader && !!app.bookmarks.find((b) => b.siteId === active!.siteId && b.pathOrUrl === active!.pathOrUrl);

  const outdatedSizeMb = app.entries
    .filter((e) => e.updateAvailable && e.installed)
    .reduce((a, e) => a + (e.remote?.sizeBytes ?? 0) / (1024 * 1024), 0);

  return (
    <header className="drag-region relative z-40 flex h-11 w-full shrink-0 items-center gap-1 border-b border-border bg-surface px-1.5">
      {/* left cluster */}
      {isReader && (
        <WinBtn onClick={() => app.closeTab(active!.id)}>
          <Copy size={14} className="rotate-180" />
        </WinBtn>
      )}
      <WinBtn onClick={() => app.setDrawerOpen(!app.drawerOpen)}>
        <PanelLeft size={15} />
      </WinBtn>
      <button
        onClick={app.goHome}
        className="no-drag flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-accent"
        title="Home"
      >
        <span className="grad-bg grid h-5 w-5 place-items-center rounded-md shadow-soft">
          <img src="/logo.png" alt="Docx" className="h-4 w-4" draggable={false} />
        </span>
        <span className="hidden text-[13px] font-semibold tracking-tight sm:inline">Docx</span>
      </button>

      <div
        className="mx-auto hidden max-w-[42%] truncate rounded-md px-2 text-[12px] font-medium text-muted-foreground md:block"
        title={title}
      >
        {title}
      </div>

      {/* update pill (count + size) */}
      {app.outdatedCount > 0 && (
        <Tooltip label={`Update ${app.outdatedCount} packs (${outdatedSizeMb.toFixed(0)} MB) — uses fast delta downloads when possible`}>
          <motion.button
            initial={{ opacity: 0, scale: 0.9, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            onClick={() => app.batchUpdateOutdated()}
            className="no-drag flex items-center gap-1.5 rounded-full border border-[var(--grad-a)]/40 bg-[var(--grad-a)]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[var(--grad-b)] transition-colors hover:bg-[var(--grad-a)]/20"
          >
            <Download size={12} />
            {app.outdatedCount} · {outdatedSizeMb.toFixed(0)} MB
          </motion.button>
        </Tooltip>
      )}

      <div className="flex-1" />

      {isReader && (
        <>
          <div className="no-drag hidden items-center gap-0.5 rounded-lg border border-border bg-muted/60 px-0.5 md:flex">
            <Tooltip label="Smaller text">
              <Button variant="ghost" size="iconSm" onClick={() => props.readerApi.current?.zoomBy(-10)}>
                <Minus size={13} />
              </Button>
            </Tooltip>
            <button
              onClick={() => props.readerApi.current?.zoomBy(0)}
              className="w-10 rounded-md text-[11px] font-semibold tabular-nums text-muted-foreground hover:text-foreground"
            >
              {app.readerZoom}%
            </button>
            <Tooltip label="Bigger text">
              <Button variant="ghost" size="iconSm" onClick={() => props.readerApi.current?.zoomBy(+10)}>
                <span className="text-[13px] leading-none">+</span>
              </Button>
            </Tooltip>
          </div>

          {/* theme chip: forced mode cycles off; otherwise toggles this site */}
          <Tooltip
            label={
              forced === "dark"
                ? "Force dark active — click to return to per-site themes"
                : forced === "light"
                  ? "Force light active — click to return to per-site themes"
                  : darkOn
                    ? "Make this page light"
                    : "Make this page dark"
            }
          >
            <Button
              variant="ghost"
              size="sm"
              className={"no-drag h-8 gap-1.5 px-2 " + (forcedOn ? "text-[var(--grad-a)]" : "")}
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
              <MoonStar size={14} className={forced === "dark" || (forced === "off" && darkOn) ? "text-amber-400" : ""} />
              <span className="hidden text-xs md:inline">
                {forced === "dark" ? "Force dark" : forced === "light" ? "Force light" : darkOn ? "Dark" : "Light"}
              </span>
            </Button>
          </Tooltip>

          {(isBookmarked || forced === "off") && (
            <Tooltip label={isBookmarked ? "Remove bookmark" : "Bookmark page"}>
              <Button
                variant="ghost"
                size="sm"
                className={"no-drag h-8 gap-1.5 px-2 " + (isBookmarked ? "text-[var(--grad-b)]" : "")}
                onClick={() => props.readerApi.current?.bookmarkToggle(active!)}
              >
                <Bookmark size={14} fill={isBookmarked ? "currentColor" : "none"} />
                <span className="hidden text-xs lg:inline">{isBookmarked ? "Saved" : "Save"}</span>
              </Button>
            </Tooltip>
          )}
        </>
      )}

      <Tooltip label="Search (Ctrl+K)">
        <Button variant="ghost" size="iconSm" className="no-drag" onClick={() => app.setPaletteOpen(true)}>
          <Search size={15} />
        </Button>
      </Tooltip>

      <FeaturesMenu />

      <Tooltip label="Hide top bar (hover the top edge to reveal)">
        <Button
          variant="ghost"
          size="iconSm"
          className="no-drag hidden lg:inline-flex"
          onClick={() => app.setTopbarHidden(true)}
        >
          <ChevronUp size={13} />
        </Button>
      </Tooltip>

      <Tooltip label="Borderless mode">
        <Button
          variant="ghost"
          size="iconSm"
          className="no-drag hidden lg:inline-flex"
          onClick={() => Tauri.windowToggleFullscreen()}
        >
          <Maximize size={13} />
        </Button>
      </Tooltip>

      <div className="mx-1 h-5 w-px bg-border" />

      <WinBtn onClick={() => Tauri.windowMinimize()}>
        <Minus size={14} />
      </WinBtn>
      <WinBtn onClick={() => Tauri.windowToggleMaximize()}>
        <Square size={12} />
      </WinBtn>
      <WinBtn onClick={() => Tauri.windowClose()} danger>
        <X size={15} />
      </WinBtn>
    </header>
  );

  function FeaturesMenu() {
    const forces: { key: "off" | "dark" | "light"; label: string }[] = [
      { key: "off", label: "Per-site" },
      { key: "dark", label: "Force dark" },
      { key: "light", label: "Force light" },
    ];
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="iconSm" className="no-drag">
            <Settings2 size={15} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 p-2">
          <DropdownMenuLabel>Docx features</DropdownMenuLabel>
          <div className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-accent">
            <span>Site tabs</span>
            <Switch checked={app.flags.siteTabs} onCheckedChange={(v) => app.setFlag("siteTabs", v)} />
          </div>
          <div className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-accent">
            <span>Per-site theme & font</span>
            <Switch checked={app.flags.themeSync} onCheckedChange={(v) => app.setFlag("themeSync", v)} />
          </div>
          <div className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-accent">
            <span>Custom reading font</span>
            <Switch checked={app.flags.customFont} onCheckedChange={(v) => app.setFlag("customFont", v)} />
          </div>

          <DropdownMenuLabel className="mt-1">Site theme</DropdownMenuLabel>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
            {forces.map((f) => (
              <button
                key={f.key}
                onClick={() => app.setForceTheme(f.key)}
                className={
                  "relative rounded-lg px-2 py-1.5 text-[11.5px] font-medium transition-colors " +
                  (app.forceTheme === f.key ? "text-white" : "text-muted-foreground hover:text-foreground")
                }
              >
                {app.forceTheme === f.key && (
                  <motion.span
                    layoutId="force-seg"
                    className="absolute inset-0 rounded-lg grad-bg"
                    transition={{ type: "spring", stiffness: 500, damping: 36 }}
                  />
                )}
                <span className="relative z-10">{f.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-1 flex gap-1">
            <DropdownMenuItem className="flex-1 justify-center gap-1.5" onClick={() => app.setTopbarHidden(true)}>
              <EyeOff size={13} /> Hide topbar
            </DropdownMenuItem>
            <DropdownMenuItem className="flex-1 justify-center gap-1.5" onClick={() => app.setSidebarHidden(true)}>
              <EyeOff size={13} /> Hide sidebar
            </DropdownMenuItem>
          </div>

          <DropdownMenuItem className="mt-1 justify-between" onClick={() => app.checkAppUpdate()}>
            <span className="flex items-center gap-2">
              <Sparkles size={14} /> Check app update
            </span>
            {app.appUpdate?.update_available && <Badgeish>v{app.appUpdate.target_version}</Badgeish>}
          </DropdownMenuItem>
          {app.appUpdate?.update_available && (
            <DropdownMenuItem danger onClick={() => app.selfUpdateApp()} className="justify-between">
              <span className="flex items-center gap-2 text-amber-500">
                <Download size={14} /> Update app now
              </span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
}

function Badgeish({ children }: { children: React.ReactNode }) {
  return (
    <span className="grad-bg rounded-full px-2 py-0.5 text-[10px] font-bold text-white">{children}</span>
  );
}
