import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppProvider, useApp } from "./lib/store";
import { Tauri } from "./lib/tauri";
import { loadSearchIndex } from "./lib/search";
import Titlebar from "./components/titlebar";
import TabsBar from "./components/tabsBar";
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
        <Titlebar readerApi={readerApi} />
        <TabsBar />

        <div className="flex min-h-0 flex-1">
          <SidebarRail />
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
