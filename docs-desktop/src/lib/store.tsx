import * as React from "react";
import {
  Tauri,
  type PackStatusInfo,
  type RemoteRegistryItem,
  type DownloadProgressPayload,
  type ServerStatus,
} from "./tauri";
import { SITES, SITE_MAP, getEntryPath, getSiteOrigin, EMBEDDED_SITE_IDS, type SiteBrand } from "./catalog";
import { preloadInstalledSites } from "./search";

/* ------------------------------------------------------------------ */
/* Persistence helpers                                                 */
/* ------------------------------------------------------------------ */
function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
export interface BrowserTab {
  id: string;
  siteId: string;
  pathOrUrl?: string;
  title?: string;
}

export interface DocBookmark {
  id: string;
  siteId: string;
  title: string;
  pathOrUrl: string;
  createdAt: number;
}

export type ThemeMode = "light" | "dark" | "system";

/** Force mode overrides every site's dark setting when not "off". */
export type ForceTheme = "off" | "dark" | "light";

export interface FeatureFlags {
  siteTabs: boolean;
  themeSync: boolean;
  customFont: boolean;
}

export interface Toast {
  id: number;
  kind: "info" | "success" | "error" | "progress";
  message: string;
  percent?: number;
}

export interface AppUpdateStatus {
  update_available?: boolean;
  current_version?: string;
  target_version?: string;
  asset?: string;
}

export interface SiteEntry {
  id: string;
  brand: SiteBrand;
  installed: boolean;
  updateAvailable: boolean;
  remoteOnly: boolean;
  remote: RemoteRegistryItem | null;
  local: PackStatusInfo | null;
  activeDownload: DownloadProgressPayload | null;
}

interface AppState {
  phase: "splash" | "ready";
  splash: { percent: number; text: string };

  systemDark: boolean;
  themeMode: ThemeMode;
  forceTheme: ForceTheme;
  siteDark: Record<string, boolean>;
  flags: FeatureFlags;
  readerZoom: number;
  topbarHidden: boolean;
  sidebarHidden: boolean;

  packs: PackStatusInfo[];
  registry: RemoteRegistryItem[];
  servers: ServerStatus | null;
  appUpdate: AppUpdateStatus | null;
  bannerDismissed: boolean;

  bookmarks: DocBookmark[];
  pinned: string[];

  tabs: BrowserTab[];
  activeTabId: string | null;

  downloads: Record<string, DownloadProgressPayload>;
  toasts: Toast[];

  paletteOpen: boolean;
  drawerOpen: boolean;
  bookmarksOpen: boolean;
  settingsOpen: boolean;
}

interface AppApi extends AppState {
  /* derived */
  isDark: boolean;
  entries: SiteEntry[];
  activeTab: BrowserTab | null;
  outdatedCount: number;

  /* actions */
  setSplash: (percent: number, text: string) => void;
  dismissSplash: () => void;

  setThemeMode: (m: ThemeMode) => void;
  setForceTheme: (f: ForceTheme) => void;
  cycleForceTheme: () => void;
  setTopbarHidden: (v: boolean) => void;
  setSidebarHidden: (v: boolean) => void;
  effectiveSiteDark: (siteId: string) => boolean;
  toggleSiteDark: (siteId: string) => void;
  setFlag: (k: keyof FeatureFlags, v: boolean) => void;
  setReaderZoom: (z: number) => void;

  refreshPacks: (opts?: { withRegistry?: boolean }) => Promise<void>;
  applyDownload: (p: DownloadProgressPayload) => void;
  installSite: (siteId: string) => Promise<boolean>;
  batchUpdateOutdated: (ids?: string[]) => Promise<void>;
  deleteSite: (siteId: string) => Promise<void>;
  checkAppUpdate: () => Promise<void>;
  selfUpdateApp: () => Promise<void>;
  dismissBanner: () => void;

  openSite: (siteId: string, path?: string) => void;
  openBlankPicker: () => void;
  closeTab: (tabId: string) => void;
  activateTab: (tabId: string, path?: string) => void;
  cycleTab: (delta: number) => void;
  duplicateTab: (tabId: string) => void;
  setTabMeta: (tabId: string, meta: Partial<Pick<BrowserTab, "title" | "pathOrUrl">>) => void;
  goHome: () => void;

  togglePin: (siteId: string) => void;

  toggleBookmark: (b: { siteId: string; title: string; pathOrUrl: string }) => void;
  removeBookmark: (id: string) => void;

  setPaletteOpen: (v: boolean) => void;
  setDrawerOpen: (v: boolean) => void;
  setBookmarksOpen: (v: boolean) => void;
  setSettingsOpen: (v: boolean) => void;

  toast: (t: Omit<Toast, "id">) => void;
  dropToast: (id: number) => void;
}

const Ctx = React.createContext<AppApi | null>(null);

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useReducer(
    (s: AppState, patch: Partial<AppState> | ((prev: AppState) => Partial<AppState>)): AppState => ({
      ...s,
      ...(typeof patch === "function" ? patch(s) : patch),
    }),
    {
      phase: "splash",
      splash: { percent: 8, text: "Initializing offline engine…" },
      systemDark: true,
      themeMode: load<ThemeMode>("docx_theme_mode", "system"),
      forceTheme: load<ForceTheme>("docx_force_theme", "off"),
      siteDark: load<Record<string, boolean>>("docx_site_dark", {}),
      flags: load<FeatureFlags>("docx_feature_flags_v1", {
        siteTabs: true,
        themeSync: true,
        customFont: true,
      }),
      readerZoom: load<number>("docx_reader_zoom", 100),
      topbarHidden: false,
      sidebarHidden: false,

      packs: [],
      registry: [],
      servers: null,
      appUpdate: null,
      bannerDismissed: false,

      bookmarks: load<DocBookmark[]>("docx_bookmarks_v1", []).filter(
        (b) => b && typeof b.siteId === "string" && typeof b.pathOrUrl === "string",
      ),
      pinned: load<string[]>("docx_pinned_sites_v1", []),

      tabs: [{ id: "home", siteId: "home" }],
      activeTabId: "home",

      downloads: {},
      toasts: [],

      paletteOpen: false,
      drawerOpen: false,
      bookmarksOpen: false,
      settingsOpen: false,
    },
  );

  const toastId = React.useRef(1);

  /* ------- actions ------- */
  const api = React.useMemo<AppApi>(() => {
    const persist = { ...state } as AppState;

    const setThemeMode = (m: ThemeMode) => {
      save("docx_theme_mode", m);
      setState({ themeMode: m });
    };

    const setForceTheme = (f: ForceTheme) => {
      save("docx_force_theme", f);
      setState({ forceTheme: f });
    };

    const cycleForceTheme = () => {
      const next: ForceTheme =
        state.forceTheme === "off" ? "dark" : state.forceTheme === "dark" ? "light" : "off";
      setForceTheme(next);
      toast({
        kind: "info",
        message:
          next === "dark"
            ? "Force dark: every site renders dark"
            : next === "light"
              ? "Force light: every site renders light"
              : "Force off: per-site theme respected",
      });
    };

    const setTopbarHidden = (v: boolean) => setState({ topbarHidden: v });
    const setSidebarHidden = (v: boolean) => setState({ sidebarHidden: v });

    /** Is the app chrome dark right now (no force involvement). */
    const appDark = (s: AppState) => s.themeMode === "dark" || (s.themeMode === "system" && s.systemDark);

    /** Effective per-site dark, honoring the force override. */
    const effectiveSiteDark = (siteId: string) => {
      if (state.forceTheme === "dark") return true;
      if (state.forceTheme === "light") return false;
      return state.siteDark[siteId] ?? appDark(state);
    };

    const toggleSiteDark = (siteId: string) =>
      setState((s) => {
        const next = { ...s.siteDark, [siteId]: !(s.siteDark[siteId] ?? appDark(s)) };
        save("docx_site_dark", next);
        return { siteDark: next };
      });

    const setFlag = (k: keyof FeatureFlags, v: boolean) =>
      setState((s) => {
        const next = { ...s.flags, [k]: v };
        save("docx_feature_flags_v1", next);
        return { flags: next };
      });

    const setReaderZoom = (z: number) => {
      const clamped = Math.max(60, Math.min(190, Math.round(z)));
      save("docx_reader_zoom", clamped);
      setState({ readerZoom: clamped });
    };

    const refreshPacks = async (opts?: { withRegistry?: boolean }) => {
      try {
        const packs = await Tauri.getInstalledPacks();
        setState({ packs });
        if (packs.length) void preloadInstalledSites(packs);
      } catch {}
      if (opts?.withRegistry !== false) {
        try {
          const registry = await Tauri.getRemoteRegistry();
          setState({ registry });
        } catch {}
      }
    };

    const applyDownload = (p: DownloadProgressPayload) =>
      setState((s) => ({
        downloads: { ...s.downloads, [p.site_id]: p },
      }));

    const toast = (t: Omit<Toast, "id">) => {
      const id = toastId.current++;
      setState((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
      if (t.kind !== "progress") {
        window.setTimeout(() => {
          setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
        }, 4200);
      }
      return id;
    };
    const dropToast = (id: number) =>
      setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));

    const installSite = async (siteId: string) => {
      const tid = toast({ kind: "progress", message: `Installing ${SITE_MAP[siteId]?.name ?? siteId}…`, percent: 0 });
      try {
        await Tauri.installOrUpdate({ siteId });
        await refreshPacks({ withRegistry: false });
        const name = SITE_MAP[siteId]?.name ?? siteId;
        toast({ kind: "success", message: `${name} ready — packed & indexed` });
        return true;
      } catch (e) {
        toast({ kind: "error", message: `${siteId}: ${String(e).slice(0, 160)}` });
        return false;
      } finally {
        dropToast(tid);
        setState((s) => {
          const next = { ...s.downloads };
          delete next[siteId];
          return { downloads: next };
        });
      }
    };

    const batchUpdateOutdated = async (ids?: string[]) => {
      const entriesList = state.packs.map((p) => p.id);
      const targets =
        ids ??
        state.registry
          .filter((r) => entriesList.includes(r.id) && r.update_available)
          .map((r) => r.id);
      if (!targets.length) {
        toast({ kind: "info", message: "Everything is already up to date ✨" });
        return;
      }
      toast({ kind: "progress", message: `Updating ${targets.length} packs…`, percent: 0 });
      const results = await Promise.allSettled(targets.map((id) => Tauri.installOrUpdate({ siteId: id })));
      await refreshPacks({ withRegistry: false });
      const ok = results.filter((r) => r.status === "fulfilled").length;
      toast({
        kind: ok === targets.length ? "success" : "error",
        message: `Updated ${ok}/${targets.length} packs`,
      });
      setState((s) => ({
        downloads: Object.fromEntries(
          Object.entries(s.downloads).filter(([k]) => !targets.includes(k)),
        ),
      }));
    };

    const deleteSite = async (siteId: string) => {
      try {
        await Tauri.deleteDocpack(siteId);
        await refreshPacks({ withRegistry: false });
        toast({ kind: "success", message: `${SITE_MAP[siteId]?.name ?? siteId} removed` });
      } catch (e) {
        toast({ kind: "error", message: `Delete failed: ${String(e).slice(0, 120)}` });
      }
    };

    const checkAppUpdate = async () => {
      try {
        const res = await Tauri.checkAppUpdate();
        if (res && res.update_available) setState({ appUpdate: res });
      } catch {}
    };

    const selfUpdateApp = async () => {
      try {
        toast({ kind: "progress", message: "Downloading app update…", percent: 0 });
        await Tauri.selfUpdateApp();
      } catch (e) {
        toast({ kind: "info", message: `Self-update: ${String(e).slice(0, 140)}` });
      }
    };

    /* ---------- tabs ---------- */
    let portCache: Record<string, number> = { ...state.servers?.site_ports };

    const resolveTabUrl = async (siteId: string, path?: string): Promise<string> => {
      if (EMBEDDED_SITE_IDS.includes(siteId)) {
        let st = state.servers;
        if (!st) {
          try {
            st = await Tauri.checkServers();
            setState({ servers: st });
            portCache = { ...portCache, ...st.site_ports };
          } catch {}
        }
        const p = siteId === "tailwind" ? st?.tailwind_port : st?.shadcn_port;
        return `http://localhost:${p ?? 3001}${path ?? getEntryPath(siteId)}`;
      }
      try {
        if (!portCache[siteId]) portCache[siteId] = await Tauri.ensureSiteServer(siteId);
        return `http://localhost:${portCache[siteId]}${path ?? getEntryPath(siteId)}`;
      } catch {
        return "about:blank";
      }
    };

    const openSite = (siteId: string, path?: string) => {
      if (!SITE_MAP[siteId]) return;
      setState((s) => {
        const existing = s.tabs.find((t) => t.siteId === siteId);
        if (existing && !path) {
          return { activeTabId: existing.id, drawerOpen: false };
        }
        if (existing && path) {
          return {
            tabs: s.tabs.map((t) => (t.id === existing.id ? { ...t, pathOrUrl: path } : t)),
            activeTabId: existing.id,
            drawerOpen: false,
          };
        }
        const title = SITE_MAP[siteId]?.name ?? siteId;
        if (!s.flags.siteTabs && activeWebTab(s.tabs, s.activeTabId)) {
          // single-tab mode: replace active content tab
          const active = activeWebTab(s.tabs, s.activeTabId)!;
          return {
            tabs: s.tabs.map((t) => (t.id === active.id ? { ...t, siteId, pathOrUrl: path, title } : t)),
            activeTabId: active.id,
            drawerOpen: false,
          };
        }
        const id = `tab-${siteId}-${Date.now()}`;
        return {
          tabs: [...s.tabs, { id, siteId, pathOrUrl: path, title }],
          activeTabId: id,
          drawerOpen: false,
          bookmarksOpen: false,
        };
      });
    };

    const openBlankPicker = () => setState({ drawerOpen: true });

    const goHome = () => setState({ activeTabId: "home" });

    const activateTab = (tabId: string, path?: string) =>
      setState((s) => ({
        activeTabId: tabId,
        tabs: path ? s.tabs.map((t) => (t.id === tabId ? { ...t, pathOrUrl: path } : t)) : s.tabs,
      }));

    const closeTab = (tabId: string) =>
      setState((s) => {
        const wasActive = s.activeTabId === tabId;
        const wasHome = tabId === "home";
        let tabs = s.tabs.filter((t) => t.id !== tabId);
        if (wasHome) {
          // closing home resets reader tabs to a fresh hub
          tabs = [{ id: "home", siteId: "home" }];
          return { tabs, activeTabId: "home" };
        }
        const activeTabId =
          wasActive ? (tabs.length ? tabs[tabs.length - 1].id : "home") : s.activeTabId;
        if (!tabs.length) tabs = [{ id: "home", siteId: "home" }];
        return { tabs, activeTabId };
      });

    const cycleTab = (delta: number) =>
      setState((s) => {
        const web = s.tabs.filter((t) => t.siteId !== "home");
        if (web.length < 2) return {};
        const idx = web.findIndex((t) => t.id === s.activeTabId);
        const next = web[(idx + delta + web.length * 2) % web.length];
        return { activeTabId: next.id };
      });

    const duplicateTab = (tabId: string) =>
      setState((s) => {
        const t = s.tabs.find((x) => x.id === tabId);
        if (!t || t.siteId === "home") return {};
        const id = `tab-${t.siteId}-${Date.now()}`;
        return { tabs: [...s.tabs, { id, siteId: t.siteId, pathOrUrl: t.pathOrUrl }], activeTabId: id };
      });

    const setTabMeta = (tabId: string, meta: Partial<Pick<BrowserTab, "title" | "pathOrUrl">>) =>
      setState((s) => ({ tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, ...meta } : t)) }));

    const togglePin = (siteId: string) =>
      setState((s) => {
        const next = s.pinned.includes(siteId)
          ? s.pinned.filter((p) => p !== siteId)
          : [...s.pinned, siteId];
        save("docx_pinned_sites_v1", next);
        return { pinned: next };
      });

    const toggleBookmark = (b: { siteId: string; title: string; pathOrUrl: string }) =>
      setState((s) => {
        const key = `${b.siteId}|${b.pathOrUrl}`;
        const existing = s.bookmarks.find(
          (x) => `${x.siteId}|${x.pathOrUrl}` === key,
        );
        let next: DocBookmark[];
        if (existing) next = s.bookmarks.filter((x) => x.id !== existing.id);
        else
          next = [
            ...s.bookmarks,
            { id: `bm-${Date.now()}`, siteId: b.siteId, title: b.title, pathOrUrl: b.pathOrUrl, createdAt: Date.now() },
          ];
        save("docx_bookmarks_v1", next);
        return { bookmarks: next };
      });

    const removeBookmark = (id: string) =>
      setState((s) => {
        const next = s.bookmarks.filter((b) => b.id !== id);
        save("docx_bookmarks_v1", next);
        return { bookmarks: next };
      });

    return {
      ...state,
      get isDark() {
        return state.themeMode === "dark" || (state.themeMode === "system" && state.systemDark);
      },
      get entries(): SiteEntry[] {
        return SITES.map((brand) => buildEntry(brand, state.packs, state.registry, state.downloads));
      },
      get activeTab() {
        return state.tabs.find((t) => t.id === state.activeTabId) ?? null;
      },
      get outdatedCount() {
        return SITES.filter((brand) => {
          const local = state.packs.find((p) => p.id === brand.id);
          const remote = state.registry.find((r) => r.id === brand.id);
          return !!local && !!remote && remote.commit !== local.commit;
        }).length;
      },
      toast,
      dropToast,
      setSplash: (percent: number, text: string) => setState({ splash: { percent, text } }),
      dismissSplash: () => setState({ phase: "ready" }),
      setThemeMode,
      setForceTheme,
      cycleForceTheme,
      setTopbarHidden,
      setSidebarHidden,
      effectiveSiteDark,
      toggleSiteDark,
      setFlag,
      setReaderZoom,
      refreshPacks,
      applyDownload,
      installSite,
      batchUpdateOutdated,
      deleteSite,
      checkAppUpdate,
      selfUpdateApp,
      dismissBanner: () => setState({ bannerDismissed: true }),
      openSite,
      openBlankPicker,
      goHome,
      activateTab,
      closeTab,
      cycleTab,
      duplicateTab,
      setTabMeta,
      togglePin,
      toggleBookmark,
      removeBookmark,
      setPaletteOpen: (v) => setState({ paletteOpen: v }),
      setDrawerOpen: (v) => setState({ drawerOpen: v }),
      setBookmarksOpen: (v) => setState({ bookmarksOpen: v }),
      setSettingsOpen: (v) => setState({ settingsOpen: v }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

function activeWebTab(tabs: BrowserTab[], activeTabId: string | null) {
  const t = tabs.find((x) => x.id === activeTabId);
  return t && t.siteId !== "home" ? t : null;
}

function buildEntry(
  brand: SiteBrand,
  packs: PackStatusInfo[],
  registry: RemoteRegistryItem[],
  downloads: Record<string, DownloadProgressPayload>,
): SiteEntry {
  // installed packs come keyed by id (mdn names may carry legacy prefixes "tw:"/"js:")
  const lowerId = (s: string) => s.toLowerCase();
  const local =
    packs.find((p) => lowerId(p.id) === lowerId(`${brand.id}`)) ??
    packs.find((p) => lowerId(p.id).startsWith(`${lowerId(brand.id)}:`)) ??
    null;
  const remote = registry.find((r) => lowerId(r.id) === lowerId(brand.id)) ?? null;
  const installed = !!local;
  const updateAvailable = !!(remote && installed && remote.commit !== local!.commit);
  return {
    id: brand.id,
    brand,
    installed,
    updateAvailable,
    remoteOnly: !remote && !installed,
    remote,
    local,
    activeDownload: downloads[brand.id] ?? null,
  };
}

export function useApp(): AppApi {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export const getSiteHome = (siteId: string) => `${getSiteOrigin(siteId)}${getEntryPath(siteId)}`;
