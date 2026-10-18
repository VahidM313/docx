import * as React from "react";
import { useApp } from "../lib/store";
import { Tauri } from "../lib/tauri";
import { getBrand, EMBEDDED_SITE_IDS } from "../lib/catalog";
import { Button, Switch, Tooltip, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem } from "../ui";
import {
  Minus,
  PanelLeft,
  LayoutDashboard,
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
  const darkOn = isReader ? (app.siteDark[active!.siteId] ?? false) : app.isDark;
  const isBookmarked =
    isReader && !!app.bookmarks.find((b) => b.siteId === active!.siteId && b.pathOrUrl === active!.pathOrUrl);

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
        <span className="grad-bg flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-black text-white shadow-soft">
          D
        </span>
        <span className="hidden text-[13px] font-semibold tracking-tight sm:inline">Docx</span>
      </button>

      <div
        className="mx-auto hidden max-w-[42%] truncate rounded-md px-2 text-[12px] font-medium text-muted-foreground md:block"
        title={title}
      >
        {title}
      </div>

      {/* update pill */}
      <Chip headline={app.outdatedCount > 0} count={app.outdatedCount} />

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

          <Tooltip label={darkOn ? "Light page" : "Dark page"}>
            <Button
              variant="ghost"
              size="sm"
              className="no-drag h-8 gap-1.5 px-2"
              onClick={() => {
                if (EMBEDDED_SITE_IDS.includes(active!.siteId) || !props.readerApi.current) {
                  app.toggleSiteDark(active!.siteId);
                } else {
                  props.readerApi.current.toggleDark(active!.siteId);
                }
              }}
            >
              <MoonStar size={14} className={darkOn ? "text-amber-400" : ""} />
              <span className="hidden text-xs md:inline">{darkOn ? "Dark" : "Light"}</span>
            </Button>
          </Tooltip>

          <Tooltip label={isBookmarked ? "Remove bookmark" : "Bookmark page"}>
            <Button
              variant="ghost"
              size="sm"
              className={"no-drag h-8 gap-1.5 px-2 " + (isBookmarked ? "text-[var(--grad-b)]" : "")}
              onClick={() =>
                props.readerApi.current?.bookmarkToggle(active!)
              }
            >
              <Bookmark size={14} fill={isBookmarked ? "currentColor" : "none"} />
              <span className="hidden text-xs lg:inline">{isBookmarked ? "Saved" : "Save"}</span>
            </Button>
          </Tooltip>
        </>
      )}

      <Tooltip label="Search (Ctrl+K)">
        <Button variant="ghost" size="iconSm" className="no-drag" onClick={() => app.setPaletteOpen(true)}>
          <Search size={15} />
        </Button>
      </Tooltip>

      <FeaturesMenu />

      <Tooltip label="Boardless mode">
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

  function Chip({ headline, count }: { headline: boolean; count: number }) {
    return (
      <AnimatePresence>
        {headline && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={() => app.batchUpdateOutdated()}
            className="no-drag flex items-center gap-1.5 rounded-full border border-[var(--grad-b)]/40 bg-[var(--grad-b)]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[var(--grad-b)] transition-colors hover:bg-[var(--grad-b)]/20"
            title="Update all outdated packs"
          >
            <Download size={12} />
            {count} updates
          </motion.button>
        )}
      </AnimatePresence>
    );
  }

  function FeaturesMenu() {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="iconSm" className="no-drag">
            <Settings2 size={15} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 p-2">
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
          <DropdownMenuItem className="mt-1 justify-between" onClick={() => app.checkAppUpdate()}>
            <span className="flex items-center gap-2">
              <Sparkles size={14} /> Check app update
            </span>
            {app.appUpdate?.update_available && (
              <Badgeish>v{app.appUpdate.target_version}</Badgeish>
            )}
          </DropdownMenuItem>
          {app.appUpdate?.update_available && (
            <DropdownMenuItem
              danger
              onClick={() => app.selfUpdateApp()}
              className="justify-between"
            >
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
