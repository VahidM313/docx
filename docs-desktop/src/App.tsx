import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { AppProvider, useApp } from "./lib/store";
import { Tauri } from "./lib/tauri";
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

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col overflow-hidden bg-background">
        {/* top edge sensor reveals a hidden topbar */}
        <div
          className="fixed left-0 right-0 top-0 z-[45] h-1.5"
          onMouseEnter={() => app.topbarHidden && app.setTopbarHidden(false)}
          style={{ pointerEvents: app.topbarHidden ? "auto" : "none" }}
        />
        <motion.div
          animate={{ height: app.topbarHidden ? 0 : 44, opacity: app.topbarHidden ? 0 : 1 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="relative z-40 shrink-0 overflow-visible"
        >
          <Titlebar readerApi={readerApi} />
        </motion.div>

        <div className="flex min-h-0 flex-1">
          {/* left edge sensor reveals a hidden sidebar */}
          <div
            className="fixed bottom-0 left-0 top-11 z-[45] w-2"
            onMouseEnter={() => app.sidebarHidden && app.setSidebarHidden(false)}
            style={{ pointerEvents: app.sidebarHidden ? "auto" : "none" }}
          />
          <motion.div
            animate={{ width: app.sidebarHidden ? 0 : 48 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="shrink-0 overflow-hidden"
          >
            <SidebarRail />
          </motion.div>

          {!isHome && app.flags.siteTabs && <VerticalTabs />}

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
        </div>

        {/* floating reveal buttons when bars are hidden */}
        <AnimatePresence>
          {app.topbarHidden && (
            <motion.button
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 0.55, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              onMouseEnter={() => app.setTopbarHidden(false)}
              className="fixed left-1/2 top-1 z-[46] -translate-x-1/2 rounded-b-lg border border-t-0 border-border bg-popover/90 px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur"
            >
              <ChevronDown size={11} className="mx-auto" />
            </motion.button>
          )}
        </AnimatePresence>

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
