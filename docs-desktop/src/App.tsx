import * as React from "react";
import { AppProvider, useApp } from "./lib/store";
import { Tauri } from "./lib/tauri";
import { DomainRail } from "./components/domainRail";
import { ChannelSidebar } from "./components/channelSidebar";
import { DiscordHeader } from "./components/discordHeader";
import { MemberOutline } from "./components/memberOutline";
import { MobileDiscordDrawer, MobileDiscordBottomBar } from "./components/mobileDiscordNav";
import { MobileTabSwitcher } from "./components/mobileTabSwitcher";
import { MobileReaderHeader, MobileNavBottomBar, type MobileRootScreen } from "./components/mobileHeader";
import { SettingsModal } from "./components/settingsModal";
import HomeHub from "./components/hub";
import { ReaderPanels, type ReaderPanelsApi } from "./components/readerPanels";
import CommandPalette from "./components/palette";
import BookmarksDialog from "./components/bookmarks";
import { ToastHost, DownloadHud } from "./components/toasts";
import { Splash } from "./components/splash";
import { TooltipProvider } from "./ui";
import { Minimize2 } from "lucide-react";
import { subscribeModelStatus } from "./lib/translator/engine";

type MobileScreen = MobileRootScreen | "reader" | "tabs";

/** Phone screens as history entries. Android's back button walks WebView history, so
 *  this makes it step back through screens and, inside the reader, through visited pages
 *  (iframe navigation adds to the same history), instead of closing the app. */
function useMobileScreens(isMobile: boolean) {
  const app = useApp();
  const [screen, setScreen] = React.useState<MobileScreen>("nav");
  const current = React.useRef<MobileScreen>("nav");

  const show = React.useCallback((next: MobileScreen) => {
    if (current.current === next) return;
    current.current = next;
    setScreen(next);
    window.history.pushState({ screen: next }, "");
  }, []);

  const overlayOpen = isMobile && (app.paletteOpen || app.settingsOpen || app.bookmarksOpen);
  const overlays = React.useRef({ open: false, close: () => {} });
  React.useEffect(() => {
    overlays.current = {
      open: overlayOpen,
      close: () => {
        app.setPaletteOpen(false);
        app.setSettingsOpen(false);
        app.setBookmarksOpen(false);
      },
    };
  });

  React.useEffect(() => {
    if (!isMobile) return;
    window.history.replaceState({ screen: current.current }, "");
    const onPop = (e: PopStateEvent) => {
      const next: MobileScreen = e.state?.screen ?? "nav";
      const changed = next !== current.current;
      current.current = next;
      setScreen(next);
      if (overlays.current.open) overlays.current.close();
      // An overlay closed from its own UI leaves an entry that looks like the current screen.
      else if (!changed) window.history.back();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [isMobile]);

  React.useEffect(() => {
    if (overlayOpen) {
      window.history.pushState({ screen: current.current, overlay: true }, "");
    } else if (window.history.state?.overlay) {
      // Not history.back(): it is asynchronous and would race a push from the same render.
      window.history.replaceState({ screen: current.current }, "");
    }
  }, [overlayOpen]);

  return { screen, show, current };
}

function Shell() {
  const app = useApp();
  const readerApi = React.useRef<ReaderPanelsApi | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = React.useState(false);

  // Responsive mobile state and mobile view mode
  const [isMobile, setIsMobile] = React.useState(
    () => typeof window !== "undefined" && window.innerWidth < 768
  );
  const { screen, show: showScreen, current: currentScreen } = useMobileScreens(isMobile);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Global subscription to offline translation model status
  // Subscribing reports the status at once, so re-subscribing per render would loop forever.
  const setModelStatus = React.useRef(app.setModelStatus);
  React.useEffect(() => {
    setModelStatus.current = app.setModelStatus;
  });
  React.useEffect(() => subscribeModelStatus((p) => setModelStatus.current(p.status, p.percent)), []);

  // When active tab changes to a doc on mobile, switch to reader view automatically,
  // except while managing tabs: closing one there must not leave the switcher.
  const activeSiteId = app.activeTab?.siteId;
  React.useEffect(() => {
    if (isMobile && activeSiteId && activeSiteId !== "home" && currentScreen.current !== "tabs") {
      showScreen("reader");
    }
  }, [isMobile, activeSiteId, currentScreen, showScreen]);

  // Zen / Fullscreen edge-hover tracking
  const [zenTopHovered, setZenTopHovered] = React.useState(false);
  const [zenLeftHovered, setZenLeftHovered] = React.useState(false);

  /* ---------- theme ---------- */
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", app.isDark);
  }, [app.isDark]);

  /* ---------- boot ---------- */
  React.useEffect(() => {
    (async () => {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      app.setSystemDark(mq.matches);

      // Only local work happens before the UI appears: an offline or slow network
      // must never delay reading what is already on the device.
      app.setSplash(24, "Reading local packs");
      await app.refreshPacks({ withRegistry: false });
      app.setSplash(58, "Connecting");
      try {
        await Tauri.themeChanged((t) => app.setSystemDark(t === "dark"));
        await Tauri.downloadProgress((p) => {
          app.applyDownload(p);
        });
      } catch {}
      app.setSplash(82, "Warming up UI");
      try {
        const st = await Tauri.checkServers();
        window.document.dispatchEvent(new CustomEvent("docx:servers", { detail: st }));
      } catch {}
      app.setSplash(100, "Ready");
      app.dismissSplash();
      try {
        Tauri.windowShowReady();
      } catch {}
      void app.refreshPacks();
      void app.checkAppUpdate();

      /* keep system theme in sync without polling the backend */
      const onScheme = () => app.setSystemDark(mq.matches);
      try {
        mq.addEventListener("change", onScheme);
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- global shortcuts ---------- */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        app.setPaletteOpen(true);
      } else if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        app.cycleTab(e.shiftKey ? -1 : 1);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "w") {
        if (app.activeTabId && app.activeTabId !== "home") {
          e.preventDefault();
          app.closeTab(app.activeTabId);
        }
      } else if (e.key === "F11") {
        e.preventDefault();
        app.toggleZenMode();
      } else if (e.key === "Escape") {
        if (app.zenMode) app.setZenMode(false);
        if (app.paletteOpen) app.setPaletteOpen(false);
        if (app.settingsOpen) app.setSettingsOpen(false);
        if (app.bookmarksOpen) app.setBookmarksOpen(false);
        if (mobileDrawerOpen) setMobileDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [app, mobileDrawerOpen]);

  // =========================================================
  // DEDICATED MOBILE VIEWPORT EXPERIENCE (< 768px)
  // =========================================================
  if (isMobile) {
    const hasOpenDoc = !!app.activeTabId && app.activeTabId !== "home";
    const view = screen === "reader" && !hasOpenDoc ? "nav" : screen;
    const bottomBar = (active: MobileRootScreen) => (
      <MobileNavBottomBar
        active={active}
        onShowDocs={() => showScreen("nav")}
        onShowLibrary={() => showScreen("library")}
        onOpenTabs={() => showScreen("tabs")}
      />
    );

    return (
      <TooltipProvider>
        <div className="relative flex h-full w-full overflow-hidden bg-background text-foreground font-sans select-none">
          {/* The reader stays mounted under every other screen: remounting would reload
              each document and lose its scroll position. */}
          <div
            className={
              "absolute inset-0 flex flex-col overflow-hidden bg-background " +
              (view === "reader" ? "" : "invisible pointer-events-none")
            }
          >
            {hasOpenDoc && (
              <MobileReaderHeader
                readerApi={readerApi}
                onOpenNav={() => showScreen("nav")}
                onOpenTabs={() => showScreen("tabs")}
              />
            )}
            <main className="relative flex-1 min-w-0 min-h-0 overflow-hidden bg-background">
              <ReaderPanels apiRef={readerApi} />
            </main>
          </div>

          {/* Domain rail and channel list side by side */}
          {view === "nav" && (
            <div className="relative flex flex-col flex-1 h-full w-full overflow-hidden bg-background pt-[env(safe-area-inset-top,0px)]">
              <div className="flex flex-1 min-h-0 w-full overflow-hidden">
                <div className="w-[72px] shrink-0 h-full border-r border-border bg-rail z-20">
                  <DomainRail onNavigate={() => showScreen("reader")} />
                </div>
                <div className="flex-1 min-w-0 h-full overflow-hidden bg-surface z-10">
                  <ChannelSidebar onNavigate={() => showScreen("reader")} />
                </div>
              </div>
              {bottomBar("nav")}
            </div>
          )}

          {/* Library: installing, updating and removing packs */}
          {view === "library" && (
            <div className="relative flex flex-col flex-1 h-full w-full overflow-hidden bg-background pt-[env(safe-area-inset-top,0px)]">
              <div className="flex-1 min-h-0">
                <HomeHub />
              </div>
              {bottomBar("library")}
            </div>
          )}

          {view === "tabs" && (
            <MobileTabSwitcher
              onSelectTab={(id) => {
                app.activateTab(id);
                showScreen("reader");
              }}
              onNewTab={() => showScreen("nav")}
              onClose={() => showScreen(hasOpenDoc ? "reader" : "nav")}
            />
          )}

          {/* Modals & Overlays */}
          <SettingsModal />
          <CommandPalette />
          <BookmarksDialog />
          <ToastHost />
          <DownloadHud />
        </div>
      </TooltipProvider>
    );
  }

  // =========================================================
  // DESKTOP DISCORD CLONE EXPERIENCE (>= 768px)
  // =========================================================
  return (
    <TooltipProvider>
      <div className="relative flex h-full w-full overflow-hidden bg-background text-foreground font-sans select-none">
        {/* ========================================================= */}
        {/* ZEN FULLSCREEN MODE EDGE HOVER ZONES                      */}
        {/* ========================================================= */}
        {app.zenMode && (
          <>
            {/* Top edge hover sensor */}
            <div
              className="fixed top-0 left-0 right-0 h-3 z-[60]"
              onMouseEnter={() => setZenTopHovered(true)}
            />

            {/* Left edge hover sensor */}
            <div
              className="fixed top-0 left-0 bottom-0 w-3 z-[60]"
              onMouseEnter={() => setZenLeftHovered(true)}
            />

            {/* Quick Exit Floating Pill */}
            <button
              type="button"
              onClick={() => app.setZenMode(false)}
              className="fixed top-3 right-3 z-[70] flex items-center gap-1.5 rounded-full border border-border bg-popover/90 px-3 py-1 text-xs font-semibold text-foreground shadow-lift backdrop-blur-md opacity-30 hover:opacity-100 transition-opacity"
              title="Exit Fullscreen (Esc or F11)"
            >
              <Minimize2 className="h-3.5 w-3.5" />
              <span>Exit Zen (Esc)</span>
            </button>

            {/* Revealing Header on Top Edge Hover */}
            <div
              className={
                "fixed top-0 left-0 right-0 z-[65] shadow-lift transition-transform duration-200 ease-out " +
                (zenTopHovered ? "translate-y-0" : "-translate-y-full")
              }
              onMouseLeave={() => setZenTopHovered(false)}
            >
              <DiscordHeader
                readerApi={readerApi}
                onMobileMenu={() => setMobileDrawerOpen(true)}
              />
            </div>

            {/* Revealing Navigation on Left Edge Hover */}
            <div
              className={
                "fixed top-0 left-0 bottom-0 z-[65] flex shadow-lift transition-transform duration-200 ease-out " +
                (zenLeftHovered ? "translate-x-0" : "-translate-x-full")
              }
              onMouseLeave={() => {
                setZenLeftHovered(false);
                app.setSidebarHovered(false);
              }}
            >
              <div className="h-full shrink-0 z-30">
                <DomainRail />
              </div>
              <div
                className={
                  "h-full shrink-0 z-20 overflow-hidden discord-sidebar-transition " +
                  (app.sidebarOpen ? "w-[240px] opacity-100" : "w-0 opacity-0 pointer-events-none")
                }
              >
                <div
                  className={
                    "w-[240px] h-full shrink-0 transition-transform duration-[320ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] " +
                    (app.sidebarOpen ? "translate-x-0" : "-translate-x-full")
                  }
                >
                  <ChannelSidebar />
                </div>
              </div>
            </div>
          </>
        )}

        {/* ========================================================= */}
        {/* NORMAL MODE NAVIGATION                                    */}
        {/* ========================================================= */}
        {!app.zenMode && (
          <>
            {/* 1. Desktop Domain Rail (Always visible on desktop) */}
            <div className="hidden md:flex h-full shrink-0 z-30">
              <DomainRail />
            </div>

            {/* 2. Desktop Channel Sidebar (Smooth expanding / collapsing with sliding drawer effect) */}
            <div
              className={
                "hidden md:flex h-full shrink-0 z-20 overflow-hidden discord-sidebar-transition " +
                (app.sidebarOpen ? "w-[240px] opacity-100" : "w-0 opacity-0 pointer-events-none")
              }
            >
              <div
                className={
                  "w-[240px] h-full shrink-0 transition-transform duration-[320ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] " +
                  (app.sidebarOpen ? "translate-x-0" : "-translate-x-full")
                }
              >
                <ChannelSidebar />
              </div>
            </div>
          </>
        )}

        {/* ========================================================= */}
        {/* MAIN READER / CONTENT PANE                                */}
        {/* ========================================================= */}
        <div className="flex flex-1 flex-col min-w-0 h-full overflow-hidden bg-background">
          {/* Normal Header (hidden in Zen mode) */}
          {!app.zenMode && (
            <DiscordHeader
              readerApi={readerApi}
              onMobileMenu={() => setMobileDrawerOpen(true)}
            />
          )}

          {/* Reader / Home Content */}
          <main className="relative min-w-0 flex-1 h-full overflow-hidden bg-background">
            {app.activeTab?.siteId === "home" && (
              <div className="absolute inset-0 z-10 bg-background overflow-y-auto">
                <HomeHub />
              </div>
            )}
            <ReaderPanels apiRef={readerApi} />
          </main>

          {/* Discord Mobile Bottom Navigation Bar (< md, hidden in Zen) */}
          {!app.zenMode && (
            <MobileDiscordBottomBar onOpenDrawer={() => setMobileDrawerOpen(true)} />
          )}
        </div>

        {/* 3. Discord Right Outline / Member List Sidebar */}
        {!app.zenMode && <MemberOutline />}

        {/* 4. Mobile Slide-out Drawer */}
        <MobileDiscordDrawer
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
        />

        {/* 5. Modals & Overlays */}
        <SettingsModal />
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
