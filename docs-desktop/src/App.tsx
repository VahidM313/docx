import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppProvider, useApp } from "./lib/store";
import { Tauri } from "./lib/tauri";
import { cursorPosition, getCurrentWindow } from "@tauri-apps/api/window";
import { loadSearchIndex, preloadInstalledSites } from "./lib/search";
import Titlebar from "./components/titlebar";
import VerticalTabs from "./components/tabsBar";
import HomeHub from "./components/hub";
import { SidebarRail, ChannelDrawer } from "./components/sidebar";
import { ReaderPanels, type ReaderPanelsApi } from "./components/readerPanels";
import CommandPalette from "./components/palette";
import BookmarksDialog from "./components/bookmarks";
import { ToastHost, DownloadHud } from "./components/toasts";
import { Splash } from "./components/splash";
import { TooltipProvider } from "./ui";

function Shell() {
  const app = useApp();
  const readerApi = React.useRef<ReaderPanelsApi | null>(null);

  /* ---------- theme (9.1): light = white-based, dark = near-black ---------- */
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", app.isDark);
  }, [app.isDark]);

  /* ---------- boot ---------- */
  React.useEffect(() => {
    (async () => {
      const th = await Tauri.getSystemTheme().catch(() => "light" as const);
      app.setSplash(24, "Reading local packs");
      await app.refreshPacks();
      app.setSplash(58, "Syncing with releases");
      await Tauri.themeChanged((t) => {
        // payload is the new system theme; only meaningful in system mode
        document.documentElement.classList.toggle("dark", app.themeMode === "system" ? t === "dark" : app.isDark);
      });
      await Tauri.downloadProgress((p) => {
        app.applyDownload(p);
      });
      app.setSplash(82, "Warming up UI");
      try {
        const st = await Tauri.checkServers();
        window.document.dispatchEvent(new CustomEvent("docx:servers", { detail: st }));
      } catch {}
      app.setSplash(100, "Ready");
      await app.checkAppUpdate();
      app.dismissSplash();
      Tauri.windowShowReady();
      loadSearchIndex().catch(() => {});

      /* keep systemDark responsive to OS */
      try {
        Tauri.themeChanged;
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        const sync = () => {
          const dark = app.themeMode === "system" ? mq.matches : app.isDark;
          document.documentElement.classList.toggle("dark", dark);
        };
        mq.addEventListener("change", () => {
          sync();
          if (app.themeMode === "system") window.location.reload();
        });
      } catch {}

      /* interim: keep systemDark state via conv poll */
      const iv = window.setInterval(async () => {
        const t = await Tauri.getSystemTheme().catch(() => null);
        if (t) document.documentElement.classList.toggle("dark", app.themeMode === "system" ? t === "dark" : app.isDark);
      }, 10000);
      (window as unknown as { __docxThemePoll?: number }).__docxThemePoll = iv;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* re-sync theme when mode changes */
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", app.isDark);
  }, [app.themeMode, app.systemDark, app.isDark]);

  /* ---------- global shortcuts ---------- */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        app.setPaletteOpen(true);
      } else if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        app.cycleTab(e.shiftKey ? -1 : 1);
      } else if (e.key === "Escape") {
        if (app.paletteOpen) app.setPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [app]);

  /* ---------- view ---------- */
  const isHome = app.activeTab?.siteId === "home";
  const isHomeRef = React.useRef(isHome);
  isHomeRef.current = isHome;

  /* While a Radix dropdown (portaled outside the transient panels) is open,
     its parent panel must not collapse under the cursor. */
  const [overlayLocked, setOverlayLocked] = React.useState(false);
  React.useEffect(() => {
    const check = () => setOverlayLocked(!!document.querySelector("[data-radix-popper-content-wrapper]"));
    const mo = new MutationObserver(check);
    mo.observe(document.body, { childList: true, subtree: true });
    check();
    return () => mo.disconnect();
  }, []);

  /* WebKit clears CSS :hover reliably for plain DOM, but the reader doc sits in
     a cross-origin iframe: Chrome drops the boundary events when the cursor
     crosses into it, so hover-pinned panels would stay open while reading.
     Poll the real OS cursor (works across iframes) and reveal each transient
     surface only while the cursor is genuinely at its strip or on its panel. */
  const [openZones, setOpenZones] = React.useState<string[]>([]);
  React.useEffect(() => {
    if (app.pins.topbar && app.pins.sidebar && app.pins.tabs) return;
    if (overlayLocked) return; // keep panels while a menu is open
    const win = getCurrentWindow();
    const prev = { topbar: false, sidebar: false, tabs: false };
    const tick = async () => {
      try {
        const [cur, origin] = await Promise.all([cursorPosition(), win.innerPosition()]);
        const dpr = window.devicePixelRatio || 1;
        const cx = (cur.x - origin.x) / dpr;
        const cy = (cur.y - origin.y) / dpr;
        const w = window.innerWidth;
        const h = window.innerHeight;
        const z: string[] = [];
        if (!app.pins.topbar) {
          const onStrip = cy > -2 && cy < 6;
          const onPanel = prev.topbar && cy < 48;
          if (onStrip || onPanel) z.push("topbar");
          prev.topbar = onStrip || onPanel;
        }
        if (!app.pins.sidebar) {
          const onStrip = cx > -2 && cx < 6;
          const onPanel = prev.sidebar && cx < 248;
          if (onStrip || onPanel) z.push("sidebar");
          prev.sidebar = onStrip || onPanel;
        }
        if (!app.pins.tabs && !isHomeRef.current) {
          const onStrip = cx > w - 54 && cx <= w;
          const onPanel = prev.tabs && cx > w - 262 && cx <= w;
          if (onStrip || onPanel) z.push("tabs");
          prev.tabs = onStrip || onPanel;
        }
        setOpenZones(z);
      } catch {
        /* window gone or query failed — leave state as is */
      }
    };
    const iv = setInterval(tick, 120);
    tick();
    return () => clearInterval(iv);
  }, [app.pins, overlayLocked]);

  const topbarOpen = app.pins.topbar || overlayLocked || openZones.includes("topbar");
  const sidebarOpen = app.pins.sidebar || overlayLocked || openZones.includes("sidebar");
  const tabsOpen =
    (app.pins.tabs || overlayLocked || openZones.includes("tabs")) && !isHome;

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col overflow-hidden bg-background">
        {/* ---- top bar: pinned = fixed, else slides in from the top edge ---- */}
        {app.pins.topbar ? (
          <div className="relative z-40 shrink-0">
            <Titlebar readerApi={readerApi} />
          </div>
        ) : (
          <div
            className={
              "pointer-events-none fixed inset-x-0 top-0 z-[60] -translate-y-[46px] opacity-0 transition-all duration-200 ease-out " +
              (topbarOpen ? "pointer-events-auto translate-y-0 opacity-100" : "")
            }
          >
            <Titlebar readerApi={readerApi} />
          </div>
        )}

        {/* ---- main row ---- */}
        <div className="flex min-h-0 flex-1">
          {/* ---- sidebar: pinned = fixed, else hidden until left-edge hover ---- */}
          {app.pins.sidebar ? (
            <div className="z-40 shrink-0">
              <SidebarRail pinned />
            </div>
          ) : (
            <div
              className={
                "pointer-events-none fixed bottom-0 left-0 z-[55] w-60 -translate-x-64 opacity-0 transition-all duration-200 ease-out " +
                (sidebarOpen ? "pointer-events-auto translate-x-0 opacity-100 shadow-lift" : "")
              }
              style={{ top: app.pins.topbar ? 44 : 0 }}
            >
              <SidebarRail />
            </div>
          )}

          <div className="relative min-w-0 flex-1">
            {isHome && (
              <motion.div
                key="hub"
                initial={{ opacity: 0, scale: 0.995 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="absolute inset-0 z-10 bg-background"
              >
                <HomeHub />
              </motion.div>
            )}
            <ReaderPanels apiRef={readerApi} />
          </div>

          {!isHome && app.flags.siteTabs && <VerticalTabs open={tabsOpen} />}
        </div>

        <ChannelDrawer />
        <CommandPalette />
        <BookmarksDialog />
        <ToastHost />
        <DownloadHud />
      </div>
    </TooltipProvider>
  );
}

export function Boot() {
  return (
    <React.StrictMode>
      <AppProvider>
        <Splash />
        <Shell />
      </AppProvider>
    </React.StrictMode>
  );
}
