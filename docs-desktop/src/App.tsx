import * as React from "react";
import { AppProvider, useApp } from "./lib/store";
import { Tauri } from "./lib/tauri";
import { DomainRail } from "./components/domainRail";
import { ChannelSidebar } from "./components/channelSidebar";
import { DiscordHeader } from "./components/discordHeader";
import { MemberOutline } from "./components/memberOutline";
import { MobileDiscordDrawer, MobileDiscordBottomBar } from "./components/mobileDiscordNav";
import { MobileTabSwitcher } from "./components/mobileTabSwitcher";
import { MobileReaderHeader, MobileNavBottomBar } from "./components/mobileHeader";
import { SettingsModal } from "./components/settingsModal";
import HomeHub from "./components/hub";
import { ReaderPanels, type ReaderPanelsApi } from "./components/readerPanels";
import CommandPalette from "./components/palette";
import BookmarksDialog from "./components/bookmarks";
import { ToastHost, DownloadHud } from "./components/toasts";
import { Splash } from "./components/splash";
import { TooltipProvider } from "./ui";
import { Minimize2 } from "lucide-react";

function Shell() {
  const app = useApp();
  const readerApi = React.useRef<ReaderPanelsApi | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = React.useState(false);

  // Responsive mobile state and mobile view mode
  const [isMobile, setIsMobile] = React.useState(
    () => typeof window !== "undefined" && window.innerWidth < 768
  );
  // "nav" (side-by-side domain rail + channel sidebar) | "reader" (full-screen doc) | "tabs" (Chrome-style tab switcher)
  const [mobileView, setMobileView] = React.useState<"nav" | "reader" | "tabs">("nav");

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // When active tab changes to a doc on mobile, switch to reader view automatically
  const activeSiteId = app.activeTab?.siteId;
  React.useEffect(() => {
    if (isMobile && activeSiteId && activeSiteId !== "home") {
      setMobileView("reader");
    }
  }, [isMobile, activeSiteId]);

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

      app.setSplash(24, "Reading local packs");
      try {
        await app.refreshPacks();
      } catch {}
      app.setSplash(58, "Syncing with releases");
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
      try {
        await app.checkAppUpdate();
      } catch {}
      app.dismissSplash();
      try {
        Tauri.windowShowReady();
      } catch {}

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
    return (
      <TooltipProvider>
        <div className="relative flex h-full w-full overflow-hidden bg-background text-foreground font-sans select-none">
          {/* Mobile View: 1. Chrome-Style Tabs Switcher */}
          {mobileView === "tabs" && (
            <MobileTabSwitcher
              onSelectTab={(id) => {
                app.activateTab(id);
                setMobileView("reader");
              }}
              onNewTab={() => setMobileView("nav")}
              onClose={() => setMobileView(app.activeTabId && app.activeTabId !== "home" ? "reader" : "nav")}
            />
          )}

          {/* Mobile View: 2. Full-Screen Document Reader (Distraction-free, zero sidebars) */}
          {mobileView === "reader" && app.activeTabId && app.activeTabId !== "home" && (
            <div className="flex flex-col flex-1 h-full w-full overflow-hidden bg-background">
              {/* Pure Mobile Header */}
              <MobileReaderHeader
                readerApi={readerApi}
                onOpenNav={() => setMobileView("nav")}
                onOpenTabs={() => setMobileView("tabs")}
              />

              {/* Document Reader Area */}
              <main className="relative flex-1 min-w-0 h-full overflow-hidden bg-background">
                <ReaderPanels apiRef={readerApi} />
              </main>
            </div>
          )}

          {/* Mobile View: 3. Domain Rail + Channel Sidebar Side-by-Side in ONE View! */}
          {(mobileView === "nav" || (!app.activeTabId || app.activeTabId === "home")) && (
            <div className="flex flex-col flex-1 h-full w-full overflow-hidden bg-background">
              {/* Main side-by-side view */}
              <div className="flex flex-1 min-h-0 w-full overflow-hidden">
                {/* Left: Domain Rail (Compact 72px) */}
                <div className="w-[72px] shrink-0 h-full border-r border-border bg-rail z-20">
                  <DomainRail onNavigate={() => setMobileView("reader")} />
                </div>

                {/* Right: Channel Sidebar (Fills remaining width of the screen) */}
                <div className="flex-1 min-w-0 h-full overflow-hidden bg-surface z-10">
                  <ChannelSidebar onNavigate={() => setMobileView("reader")} />
                </div>
              </div>

              {/* Bottom Dock: Search, Settings, Chrome Tabs Switcher */}
              <MobileNavBottomBar onOpenTabs={() => setMobileView("tabs")} />
            </div>
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
