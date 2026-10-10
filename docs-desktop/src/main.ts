import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { SITE_BRANDS, getSiteBrand } from "./brands";

interface SearchEntry {
  id: string;
  site: string;
  siteName: string;
  title: string;
  category: string;
  description: string;
  path: string;
  url: string;
  keywords: string[];
}

interface ServerStatus {
  tailwind: boolean;
  shadcn: boolean;
  tailwind_port: number;
  shadcn_port: number;
  site_ports?: Record<string, number>;
}

interface PackStatusInfo {
  id: string;
  name: string;
  version: string;
  commit: string;
  route_count: number;
  chunk_count: number;
  size_mb: number;
  source: string;
  port: number;
}

interface RemoteRegistryItem {
  id: string;
  name: string;
  version: string;
  commit: string;
  updatedAt?: string;
  sizeBytes: number;
  routeCount: number;
  chunkCount: number;
  installed: boolean;
  local_commit: string;
  update_available: boolean;
}

interface DeltaUpdateResult {
  site_id: string;
  old_commit: string;
  new_commit: string;
  total_chunks: number;
  reused_chunks: number;
  downloaded_chunks: number;
  reused_bytes: number;
  downloaded_bytes: number;
  saved_percent: number;
  port: number;
  message: string;
}

interface DownloadProgressPayload {
  site_id: string;
  phase: string;
  downloaded_bytes: number;
  total_bytes: number;
  percent: number;
  detail: string;
}

interface UnifiedSiteEntry {
  id: string;
  name: string;
  version: string;
  category: string;
  color: string;
  bgTint: string;
  description: string;
  svg: string;
  defaultRoutes?: { label: string; path: string }[];
  installed: boolean;
  localCommit: string;
  remoteCommit: string;
  updateAvailable: boolean;
  routeCount: number;
  chunkCount: number;
  sizeMb: string;
  port: number;
}

let tailwindPort = 49152;
let shadcnPort = 49153;
let sitePorts: Record<string, number> = {};

function getOrigin(site: string): string {
  if (site === "tailwind") return `http://localhost:${tailwindPort}`;
  if (site === "shadcn") return `http://localhost:${shadcnPort}`;
  const p = sitePorts[site];
  return p ? `http://localhost:${p}` : `http://localhost:${tailwindPort}`;
}

let baseSearchIndex: SearchEntry[] = [];
let searchIndex: SearchEntry[] = [];
let activeTab: string = "home";
let currentFilter: string = "all";
let currentResults: SearchEntry[] = [];
let selectedIndex = 0;

let sidebarPinned = false;
let drawerHidden = localStorage.getItem("docx_drawer_hidden") === "true";
let topbarHidden = false;
let sidebarCloseTimer: number | null = null;
let topbarCloseTimer: number | null = null;

let readerZoom = Math.max(
  60,
  Math.min(220, parseInt(localStorage.getItem("docx_reader_zoom") || "100", 10) || 100)
);
let readerDarkMode = localStorage.getItem("docx_reader_dark_v2") !== "0";
let readerDarkBySite: Record<string, boolean> = (() => {
  try {
    const raw = localStorage.getItem("docx_reader_dark_by_site_v2");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
})();

interface BrowserTab {
  id: string;
  siteId: string;
  title: string;
  pathOrUrl: string;
  isNewTabPicker?: boolean;
  panelEl?: HTMLElement;
  iframeEl?: HTMLIFrameElement;
  loadingEl?: HTMLElement;
  loadingTimer?: number;
}

let tabSeq = 1;
let browserTabs: BrowserTab[] = [
  {
    id: "tab-home",
    siteId: "home",
    title: "57-Site Hub",
    pathOrUrl: "/",
  },
];
let activeBrowserTabId: string = "tab-home";

let installedPacksCache: PackStatusInfo[] = [];
let remoteRegistryCache: RemoteRegistryItem[] = [];
let selectedHubCategory: string = "all";
let hubSearchQuery: string = "";
const activeDownloads = new Map<string, DownloadProgressPayload>();
let hudHideTimer: number | null = null;

// DOM Elements
const tabHome = document.getElementById("tabHome") as HTMLButtonElement;
const installedRailList = document.getElementById("installedRailList") as HTMLElement;
const drawerChannelsScroll = document.getElementById("drawerChannelsScroll") as HTMLElement;
const brandBtn = document.getElementById("brandBtn") as HTMLElement;
const titlebarBrandHome = document.getElementById("titlebarBrandHome") as HTMLElement;
const browserTabsList = document.getElementById("browserTabsList") as HTMLElement;
const btnNewBrowserTab = document.getElementById("btnNewBrowserTab") as HTMLButtonElement;
const btnDuplicateBrowserTab = document.getElementById("btnDuplicateBrowserTab") as HTMLButtonElement;
const viewportContainer = document.getElementById("viewportContainer") as HTMLElement;

const discordSidebar = document.getElementById("discordSidebar") as HTMLElement;
const leftEdgeSensor = document.getElementById("leftEdgeSensor") as HTMLElement;
const btnPinSidebar = document.getElementById("btnPinSidebar") as HTMLButtonElement;
const btnToggleDrawer = document.getElementById("btnToggleDrawer") as HTMLButtonElement;
const btnCollapseDrawer = document.getElementById("btnCollapseDrawer") as HTMLButtonElement;

const customTitlebar = document.getElementById("customTitlebar") as HTMLElement;
const topEdgeSensor = document.getElementById("topEdgeSensor") as HTMLElement;
const titlebarDrag = document.getElementById("titlebarDrag") as HTMLElement;
const titlebarCurrentView = document.getElementById("titlebarCurrentView") as HTMLElement;
const titlebarUpdatePill = document.getElementById("titlebarUpdatePill") as HTMLElement;
const titlebarUpdateCount = document.getElementById("titlebarUpdateCount") as HTMLElement;
const btnToggleTopbar = document.getElementById("btnToggleTopbar") as HTMLButtonElement;
const btnToggleFullscreen = document.getElementById("btnToggleFullscreen") as HTMLButtonElement;
const btnRailToggleTopbar = document.getElementById("btnRailToggleTopbar") as HTMLButtonElement;
const topbarToggleLabel = document.getElementById("topbarToggleLabel") as HTMLElement;

const btnZoomOut = document.getElementById("btnZoomOut") as HTMLButtonElement;
const btnZoomReset = document.getElementById("btnZoomReset") as HTMLButtonElement;
const btnZoomIn = document.getElementById("btnZoomIn") as HTMLButtonElement;
const btnToggleDarkSite = document.getElementById("btnToggleDarkSite") as HTMLButtonElement;
const darkSiteIcon = document.getElementById("darkSiteIcon") as HTMLElement;
const darkSiteLabel = document.getElementById("darkSiteLabel") as HTMLElement;

const updateAlertBanner = document.getElementById("updateAlertBanner") as HTMLElement;
const updateAlertHeadline = document.getElementById("updateAlertHeadline") as HTMLElement;
const updateAlertSub = document.getElementById("updateAlertSub") as HTMLElement;
const btnAlertUpdateAll = document.getElementById("btnAlertUpdateAll") as HTMLButtonElement;
const btnAlertDismiss = document.getElementById("btnAlertDismiss") as HTMLButtonElement;

const downloadProgressHud = document.getElementById("downloadProgressHud") as HTMLElement;
const dlHudTitle = document.getElementById("dlHudTitle") as HTMLElement;
const dlHudPhase = document.getElementById("dlHudPhase") as HTMLElement;
const dlHudDetail = document.getElementById("dlHudDetail") as HTMLElement;
const dlProgressBar = document.getElementById("dlProgressBar") as HTMLElement;

const viewHome = document.getElementById("viewHome") as HTMLElement;
const viewTailwind = document.getElementById("viewTailwind") as HTMLElement;
const viewShadcn = document.getElementById("viewShadcn") as HTMLElement;
const viewDynamic = document.getElementById("viewDynamic") as HTMLElement;

const openSearchBtn = document.getElementById("openSearchBtn") as HTMLButtonElement;
const drawerSearchBtn = document.getElementById("drawerSearchBtn") as HTMLButtonElement;
const btnQuickSearchTop = document.getElementById("btnQuickSearchTop") as HTMLButtonElement;
const heroSearchBtn = document.getElementById("heroSearchBtn") as HTMLButtonElement;
const searchModal = document.getElementById("searchModal") as HTMLElement;
const searchInput = document.getElementById("searchInput") as HTMLInputElement;
const clearSearchBtn = document.getElementById("clearSearchBtn") as HTMLButtonElement;
const searchResultsList = document.getElementById("searchResultsList") as HTMLElement;

const countAll = document.getElementById("countAll") as HTMLElement;
const countTw = document.getElementById("countTw") as HTMLElement;
const countShadcn = document.getElementById("countShadcn") as HTMLElement;

const btnBack = document.getElementById("btnBack") as HTMLButtonElement;
const btnForward = document.getElementById("btnForward") as HTMLButtonElement;
const btnReload = document.getElementById("btnReload") as HTMLButtonElement;
const btnExternal = document.getElementById("btnExternal") as HTMLButtonElement;

function updateSplash(percent: number, statusText: string) {
  const bar = document.getElementById("splashProgressBar") as HTMLElement | null;
  const text = document.getElementById("splashStatusText") as HTMLElement | null;
  if (bar) bar.style.width = `${percent}%`;
  if (text) text.textContent = statusText;
}

function dismissSplashScreen() {
  const splash = document.getElementById("appSplashScreen") as HTMLElement | null;
  if (!splash) return;
  splash.classList.add("fade-out");
  window.setTimeout(() => {
    splash.remove();
  }, 460);
}

async function init() {
  const startTs = performance.now();
  updateSplash(24, "Initializing 57-Site Offline Engine...");
  requestAnimationFrame(() => {
    invoke("window_show_ready").catch(() => {});
  });

  setupWindowControls();
  setupSidebarAndTopbarHover();
  setupEventListeners();
  setupDownloadProgressListener();
  syncReaderSettingsToAllIframes();

  updateSplash(52, "Loading Universal Search Index...");
  await loadSearchIndex();

  updateSplash(78, "Mounting Embedded & Local .docpack Archives...");
  await checkServerHealth();
  try {
    installedPacksCache = await invoke<PackStatusInfo[]>("get_installed_packs");
    for (const p of installedPacksCache) {
      if (p.port) sitePorts[p.id] = p.port;
    }
  } catch {}
  renderAllUI(false);

  const elapsed = performance.now() - startTs;
  const minSplashMs = 1150;
  if (elapsed < minSplashMs) {
    await new Promise((r) => setTimeout(r, minSplashMs - elapsed));
  }

  updateSplash(100, "Ready");
  await new Promise((r) => setTimeout(r, 180));
  dismissSplashScreen();

  // Sync remote registry from GitHub Releases asynchronously after splash opens
  syncAllPacksAndRender(true).catch(() => {});
  setInterval(checkServerHealth, 3000);
}

function getSiteDarkMode(siteId: string): boolean {
  if (!siteId || siteId === "home") return readerDarkMode;
  if (typeof readerDarkBySite[siteId] === "boolean") {
    return readerDarkBySite[siteId];
  }
  return readerDarkMode;
}

function setSiteDarkMode(siteId: string, dark: boolean, broadcast = true) {
  if (!siteId || siteId === "home") {
    readerDarkMode = dark;
    try {
      localStorage.setItem("docx_reader_dark_v2", readerDarkMode ? "1" : "0");
    } catch {}
  } else {
    readerDarkBySite[siteId] = dark;
    try {
      localStorage.setItem("docx_reader_dark_by_site_v2", JSON.stringify(readerDarkBySite));
    } catch {}
  }
  if (broadcast) {
    syncReaderSettingsToAllIframes();
  } else {
    updateTopbarDarkButtonUI();
  }
}

function updateTopbarDarkButtonUI() {
  const activeDark = getSiteDarkMode(activeTab);
  if (btnToggleDarkSite) {
    btnToggleDarkSite.classList.toggle("active", activeDark);
  }
  if (darkSiteIcon) {
    darkSiteIcon.textContent = activeDark ? "🌙" : "☀️";
  }
  if (darkSiteLabel) {
    darkSiteLabel.textContent = activeDark ? "Dark" : "Light";
  }
}

function setReaderZoom(nextZoom: number) {
  readerZoom = Math.max(60, Math.min(220, Math.round(nextZoom / 5) * 5));
  try {
    localStorage.setItem("docx_reader_zoom", String(readerZoom));
  } catch {}
  syncReaderSettingsToAllIframes();
}

function toggleReaderDarkMode() {
  const targetSite = activeTab;
  const nextDark = !getSiteDarkMode(targetSite);
  setSiteDarkMode(targetSite, nextDark, true);
}

function syncReaderSettingsToAllIframes() {
  if (btnZoomReset) {
    btnZoomReset.textContent = `${readerZoom}%`;
  }
  updateTopbarDarkButtonUI();
  if (viewHome) {
    (viewHome.style as any).zoom = `${readerZoom / 100}`;
  }

  for (const t of browserTabs) {
    if (!t.iframeEl || !t.siteId || t.siteId === "home") continue;
    try {
      t.iframeEl.contentWindow?.postMessage(
        {
          type: "DOCX_READER_SETTINGS",
          siteId: t.siteId,
          zoom: readerZoom,
          darkMode: getSiteDarkMode(t.siteId),
        },
        "*"
      );
    } catch {}
  }
}

function setupDownloadProgressListener() {
  listen<DownloadProgressPayload>("docpack-progress", (event) => {
    const p = event.payload;
    if (!p || !p.site_id) return;
    applyDownloadProgress(p);
  }).catch((err) => {
    console.warn("Failed to attach docpack-progress listener:", err);
  });
}

function applyDownloadProgress(p: DownloadProgressPayload) {
  const brand = getSiteBrand(p.site_id);
  const pct = Math.max(0, Math.min(100, Math.round(p.percent || 0)));

  if (hudHideTimer) {
    window.clearTimeout(hudHideTimer);
    hudHideTimer = null;
  }

  activeDownloads.set(p.site_id, p);

  if (downloadProgressHud) {
    downloadProgressHud.style.display = "flex";
  }
  if (dlHudTitle) {
    dlHudTitle.textContent = `${brand.name} (${brand.version}) — ${p.phase}`;
  }
  if (dlHudPhase) {
    dlHudPhase.textContent = `${pct}%`;
  }
  if (dlHudDetail) {
    dlHudDetail.textContent = p.detail;
  }
  if (dlProgressBar) {
    dlProgressBar.style.width = `${pct}%`;
  }

  // Update inline card progress bar if card is rendered in DOM
  const cardWrap = document.querySelector(`[data-dl-card="${p.site_id}"]`) as HTMLElement | null;
  if (cardWrap) {
    cardWrap.style.display = "flex";
    const phaseEl = cardWrap.querySelector("[data-dl-card-phase]") as HTMLElement | null;
    const pctEl = cardWrap.querySelector("[data-dl-card-pct]") as HTMLElement | null;
    const fillEl = cardWrap.querySelector("[data-dl-card-fill]") as HTMLElement | null;
    if (phaseEl) phaseEl.textContent = p.detail || p.phase;
    if (pctEl) pctEl.textContent = `${pct}%`;
    if (fillEl) fillEl.style.width = `${pct}%`;
  }

  const installBtn = document.querySelector(`[data-card-install="${p.site_id}"]`) as HTMLButtonElement | null;
  if (installBtn) {
    installBtn.disabled = pct < 100;
    installBtn.textContent = pct < 100 ? `⏳ Downloading... ${pct}%` : `✓ Installed (${pct}%)`;
  }

  const deltaBtn = document.querySelector(`[data-card-delta="${p.site_id}"]`) as HTMLButtonElement | null;
  if (deltaBtn) {
    deltaBtn.disabled = pct < 100;
    deltaBtn.textContent = pct < 100 ? `⏳ Syncing... ${pct}%` : `✓ Updated (${pct}%)`;
  }

  if (pct >= 100 && p.phase.toLowerCase().includes("complete")) {
    activeDownloads.delete(p.site_id);
    hudHideTimer = window.setTimeout(() => {
      if (activeDownloads.size === 0 && downloadProgressHud) {
        downloadProgressHud.style.display = "none";
      }
    }, 2400);
  }
}

function buildUnifiedSitesList(): UnifiedSiteEntry[] {
  const installedMap = new Map<string, PackStatusInfo>();
  for (const p of installedPacksCache) {
    installedMap.set(p.id, p);
  }

  const remoteMap = new Map<string, RemoteRegistryItem>();
  for (const r of remoteRegistryCache) {
    remoteMap.set(r.id, r);
  }

  const allIds = new Set<string>([
    ...Object.keys(SITE_BRANDS),
    ...installedMap.keys(),
    ...remoteMap.keys(),
  ]);

  const list: UnifiedSiteEntry[] = [];
  for (const id of allIds) {
    const brand = getSiteBrand(id, remoteMap.get(id)?.name || installedMap.get(id)?.name);
    const inst = installedMap.get(id);
    const rem = remoteMap.get(id);

    const installed = Boolean(inst) || Boolean(rem?.installed);
    const localCommit = inst?.commit || rem?.local_commit || "";
    const remoteCommit = rem?.commit || inst?.commit || "latest";
    const updateAvailable =
      Boolean(rem?.update_available) ||
      (installed && Boolean(localCommit) && Boolean(rem?.commit) && localCommit !== rem!.commit);

    const routeCount = inst?.route_count || rem?.routeCount || 6;
    const chunkCount = inst?.chunk_count || rem?.chunkCount || 6;
    const sizeMb = inst
      ? inst.size_mb.toFixed(2)
      : rem
      ? (rem.sizeBytes / (1024 * 1024)).toFixed(2)
      : "0.05";

    list.push({
      id,
      name: brand.name,
      version: rem?.version || inst?.version || brand.version,
      category: brand.category,
      color: brand.color,
      bgTint: brand.bgTint,
      description: brand.description,
      svg: brand.svg,
      defaultRoutes: brand.defaultRoutes,
      installed,
      localCommit,
      remoteCommit,
      updateAvailable,
      routeCount,
      chunkCount,
      sizeMb,
      port: inst?.port || sitePorts[id] || 0,
    });
  }

  // Sort: Installed with updates first, then Installed, then by category & name
  list.sort((a, b) => {
    if (a.updateAvailable !== b.updateAvailable) return a.updateAvailable ? -1 : 1;
    if (a.installed !== b.installed) return a.installed ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return list;
}

async function checkAppCoreUpdateStatus() {
  const btnSelfUpdate = document.getElementById("btnSelfUpdateApp") as HTMLButtonElement | null;
  const btnSelfUpdateLabel = document.getElementById("btnSelfUpdateAppLabel");
  try {
    const appUpd = await invoke<{
      localCommit: string;
      remoteCommit: string;
      version: string;
      updateAvailable: boolean;
      coreSizeMb: number;
    }>("check_app_update");
    if (btnSelfUpdate) {
      btnSelfUpdate.style.display = appUpd.updateAvailable ? "inline-flex" : "none";
    }
    if (btnSelfUpdateLabel && appUpd.updateAvailable) {
      btnSelfUpdateLabel.textContent = `⚡ Update App Core (${appUpd.coreSizeMb} MB)`;
    }
    return appUpd;
  } catch {
    if (btnSelfUpdate) {
      btnSelfUpdate.style.display = "none";
    }
    return null;
  }
}

async function syncAllPacksAndRender(showStartupNotification = false) {
  try {
    installedPacksCache = await invoke<PackStatusInfo[]>("get_installed_packs");
    for (const p of installedPacksCache) {
      if (p.port) sitePorts[p.id] = p.port;
    }
  } catch (err) {
    console.warn("get_installed_packs failed:", err);
  }

  // Render immediately with local data so UI is instant
  renderAllUI(false);

  // Then fetch remote registry from GitHub Releases
  try {
    remoteRegistryCache = await invoke<RemoteRegistryItem[]>("fetch_remote_registry");
  } catch (err) {
    console.warn("fetch_remote_registry offline or unreachable:", err);
  }

  await refreshExtraSearchEntries();
  await checkAppCoreUpdateStatus();
  renderAllUI(showStartupNotification);
}

function renderAllUI(showStartupNotification = false) {
  const sites = buildUnifiedSitesList();
  renderBrowserTabs();
  renderServerRail(sites);
  renderChannelDrawer(sites);
  renderHomeHub(sites);
  updateNotificationBanner(sites, showStartupNotification);
}

// 1. Render Startup Update Alert / Notification Banner (ONLY when real updates exist)
function updateNotificationBanner(sites: UnifiedSiteEntry[], _forceShow = false) {
  const outdated = sites.filter((s) => s.updateAvailable);
  const btnUpdateAllPacks = document.getElementById("btnUpdateAllPacks") as HTMLButtonElement;

  if (titlebarUpdatePill && titlebarUpdateCount) {
    if (outdated.length > 0) {
      titlebarUpdatePill.style.display = "inline-flex";
      titlebarUpdateCount.textContent = String(outdated.length);
    } else {
      titlebarUpdatePill.style.display = "none";
    }
  }

  if (btnUpdateAllPacks) {
    btnUpdateAllPacks.style.display = outdated.length > 0 ? "inline-flex" : "none";
    btnUpdateAllPacks.textContent = `⚡ Update All (${outdated.length})`;
  }

  if (!updateAlertBanner) return;

  if (outdated.length > 0) {
    updateAlertBanner.style.display = "flex";
    updateAlertBanner.classList.remove("up-to-date");
    const names = outdated
      .map((s) => `${s.name} (${s.localCommit} → ${s.remoteCommit})`)
      .join(" • ");
    if (updateAlertHeadline) {
      updateAlertHeadline.textContent = `Update Available for ${outdated.length} installed docpack${
        outdated.length > 1 ? "s" : ""
      }!`;
    }
    if (updateAlertSub) {
      updateAlertSub.textContent = `Ready for HTTP 206 Partial Delta Update: ${names}`;
    }
    if (btnAlertUpdateAll) {
      btnAlertUpdateAll.style.display = "inline-flex";
    }
  } else {
    updateAlertBanner.style.display = "none";
  }
}

// 2. Render Column 1: Discord Server Rail with Original Brand Colors
function renderServerRail(sites: UnifiedSiteEntry[]) {
  if (!installedRailList) return;
  const installed = sites.filter((s) => s.installed);

  const railHomeWrap = document.getElementById("railHomeWrap");
  if (railHomeWrap) {
    railHomeWrap.classList.toggle("active", activeTab === "home");
    tabHome?.classList.toggle("active", activeTab === "home");
  }

  installedRailList.innerHTML = installed
    .map((s) => {
      const isActive = activeTab === s.id;
      return `
        <div class="rail-item ${isActive ? "active" : ""}" data-rail-site="${escapeHtml(s.id)}">
          <span class="rail-pill"></span>
          <button
            class="rail-btn brand-rail-btn ${isActive ? "active" : ""}"
            data-open-site="${escapeHtml(s.id)}"
            style="--brand-color: ${s.color}; --brand-tint: ${s.bgTint};"
            title="${escapeHtml(s.name)} (${escapeHtml(s.version)}) — Click to Open • Ctrl+Click / Middle-Click for New Tab${
        s.updateAvailable ? " — Update Available!" : ""
      }"
          >
            ${s.svg}
            ${s.updateAvailable ? `<span class="rail-update-dot" title="Update Available"></span>` : ""}
          </button>
        </div>
      `;
    })
    .join("");

  installedRailList.querySelectorAll("[data-open-site]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const me = e as MouseEvent;
      const siteId = btn.getAttribute("data-open-site");
      if (siteId) switchTab(siteId, undefined, me.ctrlKey || me.metaKey);
    });
    btn.addEventListener("auxclick", (e) => {
      const me = e as MouseEvent;
      if (me.button === 1) {
        me.preventDefault();
        const siteId = btn.getAttribute("data-open-site");
        if (siteId) switchTab(siteId, undefined, true);
      }
    });
  });
}

// 3. Render Column 2: Discord Channel Drawer with All 57 Sites & Original Brand Colored Icons
function renderChannelDrawer(sites: UnifiedSiteEntry[]) {
  if (!drawerChannelsScroll) return;

  const categories = [
    "Frontend & UI",
    "TanStack Suite",
    "Backend & JS/TS",
    "Systems & Languages",
    "DevOps, Build & Shells",
  ];

  const installedSites = sites.filter((s) => s.installed);
  const sidebarStatus = document.getElementById("sidebarEngineStatus");
  if (sidebarStatus) {
    sidebarStatus.textContent = `${installedSites.length}/${sites.length} Installed • HTTP 206`;
  }

  const homeChannelHtml = `
    <div class="channel-category">
      <span class="category-label">DOCX HUB & INSTALLED (${installedSites.length})</span>
      <button class="channel-item ${activeTab === "home" ? "active" : ""}" data-drawer-site="home">
        <span class="channel-brand-icon" style="color: #38bdf8;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
        </span>
        <span class="channel-name">${sites.length}-Site Hub & Store</span>
        <span class="channel-tag">${sites.length}</span>
      </button>
      ${installedSites
        .map(
          (s) => `
        <button class="channel-item ${activeTab === s.id ? "active" : ""}" data-drawer-site="${escapeHtml(s.id)}" title="${escapeHtml(s.name)} — Click to Open • Ctrl+Click / Middle-Click for New Tab">
          <span class="channel-brand-icon" style="color: ${s.color};">${s.svg}</span>
          <span class="channel-name">${escapeHtml(s.name)}</span>
          ${
            s.updateAvailable
              ? `<span class="channel-tag update-tag">Update</span>`
              : `<span class="channel-tag installed-tag">${escapeHtml(s.version)}</span>`
          }
        </button>
      `
        )
        .join("")}
    </div>
  `;

  const categoriesHtml = categories
    .map((cat) => {
      const catSites = sites.filter((s) => s.category === cat);
      return `
        <div class="channel-category">
          <span class="category-label">${escapeHtml(cat.toUpperCase())} (${catSites.length})</span>
          ${catSites
            .map(
              (s) => `
            <button
              class="channel-item ${activeTab === s.id ? "active" : ""}"
              data-drawer-site="${escapeHtml(s.id)}"
              title="${escapeHtml(s.name)} — ${s.installed ? "Click to Open • Ctrl+Click for New Tab" : "Click to Install & Open"}"
            >
              <span class="channel-brand-icon" style="color: ${s.color};">${s.svg}</span>
              <span class="channel-name">${escapeHtml(s.name)}</span>
              ${
                s.updateAvailable
                  ? `<span class="channel-tag update-tag">⚡ Update</span>`
                  : s.installed
                  ? `<span class="channel-tag installed-tag">Ready</span>`
                  : `<span class="channel-tag">☁ Install</span>`
              }
            </button>
          `
            )
            .join("")}
        </div>
      `;
    })
    .join("");

  drawerChannelsScroll.innerHTML = homeChannelHtml + categoriesHtml;

  drawerChannelsScroll.querySelectorAll("[data-drawer-site]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const me = e as MouseEvent;
      const target = btn.getAttribute("data-drawer-site");
      if (!target) return;
      if (target === "home") {
        switchTab("home", undefined, me.ctrlKey || me.metaKey);
        return;
      }
      const siteEntry = sites.find((s) => s.id === target);
      if (siteEntry && !siteEntry.installed) {
        await runGitHubPackUpdate(target, true);
      } else {
        switchTab(target, undefined, me.ctrlKey || me.metaKey);
      }
    });
    btn.addEventListener("auxclick", async (e) => {
      const me = e as MouseEvent;
      if (me.button !== 1) return;
      me.preventDefault();
      const target = btn.getAttribute("data-drawer-site");
      if (!target) return;
      if (target === "home") {
        switchTab("home", undefined, true);
        return;
      }
      const siteEntry = sites.find((s) => s.id === target);
      if (siteEntry && !siteEntry.installed) {
        await runGitHubPackUpdate(target, true);
      } else {
        switchTab(target, undefined, true);
      }
    });
  });
}

// 4. Render Redesigned 57-Site Home Hub
function renderHomeHub(sites: UnifiedSiteEntry[]) {
  const gridEl = document.getElementById("allSitesGrid");
  if (!gridEl) return;

  const installedCount = sites.filter((s) => s.installed).length;
  const updatesCount = sites.filter((s) => s.updateAvailable).length;

  const catCountAll = document.getElementById("catCountAll");
  const catCountInstalled = document.getElementById("catCountInstalled");
  const catCountUpdates = document.getElementById("catCountUpdates");
  if (catCountAll) catCountAll.textContent = String(sites.length);
  if (catCountInstalled) catCountInstalled.textContent = String(installedCount);
  if (catCountUpdates) catCountUpdates.textContent = String(updatesCount);

  const q = hubSearchQuery.trim().toLowerCase();
  const filtered = sites.filter((s) => {
    if (selectedHubCategory === "installed" && !s.installed) return false;
    if (selectedHubCategory === "updates" && !s.updateAvailable) return false;
    if (
      selectedHubCategory !== "all" &&
      selectedHubCategory !== "installed" &&
      selectedHubCategory !== "updates" &&
      s.category !== selectedHubCategory
    ) {
      return false;
    }
    if (q) {
      const hay = `${s.name} ${s.id} ${s.category} ${s.description} ${s.version}`.toLowerCase();
      return hay.includes(q);
    }
    return true;
  });

  if (filtered.length === 0) {
    gridEl.innerHTML = `
      <div class="search-no-results" style="grid-column: 1 / -1;">
        <p>No documentation packs match the current filter.</p>
      </div>
    `;
    return;
  }

  gridEl.innerHTML = filtered
    .map((s) => {
      const dl = activeDownloads.get(s.id);
      const dlPct = dl ? Math.max(0, Math.min(100, Math.round(dl.percent || 0))) : 0;

      const statusBadge = s.updateAvailable
        ? `<span class="site-status-badge update">⚡ Update: ${escapeHtml(s.localCommit)} → ${escapeHtml(s.remoteCommit)}</span>`
        : s.installed
        ? `<span class="site-status-badge installed">● Installed</span>`
        : `<span class="site-status-badge cloud">☁ Cloud Pack</span>`;

      const quickPillsHtml =
        s.installed && s.defaultRoutes && s.defaultRoutes.length > 0
          ? `<div class="pills-container" style="margin-top: 2px;">
              ${s.defaultRoutes
                .map(
                  (r) =>
                    `<button class="link-pill" data-card-jump-site="${escapeHtml(s.id)}" data-card-jump-url="${escapeHtml(
                      r.path
                    )}" title="Click to Open • Ctrl+Click for New Tab">${escapeHtml(r.label)}</button>`
                )
                .join("")}
            </div>`
          : "";

      return `
        <article
          class="site-card ${s.updateAvailable ? "has-update" : ""}"
          style="--brand-color: ${s.color}; --brand-tint: ${s.bgTint};"
        >
          <div class="site-card-top">
            <div class="site-brand-box">
              ${s.svg}
            </div>
            <div class="site-card-headings">
              <div class="site-card-title-row">
                <span class="site-card-name">${escapeHtml(s.name)}</span>
                <span class="site-ver-pill">${escapeHtml(s.version)}</span>
                ${statusBadge}
              </div>
              <div class="site-cat-line">
                <span>${escapeHtml(s.category)}</span>
                <span>•</span>
                <span>id: ${escapeHtml(s.id)}</span>
              </div>
            </div>
          </div>

          <p class="site-card-desc">${escapeHtml(s.description)}</p>

          ${quickPillsHtml}

          <div class="site-card-meta">
            commit: ${escapeHtml(s.installed ? s.localCommit || s.remoteCommit : s.remoteCommit)} • ${
        s.chunkCount
      } chunks (${s.routeCount} routes) • ${s.sizeMb} MB Max-Gzip
          </div>

          <div class="card-dl-wrap" data-dl-card="${escapeHtml(s.id)}" style="${dl ? "display: flex;" : "display: none;"}">
            <div class="card-dl-row">
              <span class="card-dl-phase" data-dl-card-phase>${escapeHtml(dl?.detail || dl?.phase || "")}</span>
              <span class="card-dl-pct" data-dl-card-pct>${dlPct}%</span>
            </div>
            <div class="card-dl-bar-track">
              <div class="card-dl-bar-fill" data-dl-card-fill style="width: ${dlPct}%;"></div>
            </div>
          </div>

          <div class="site-card-footer">
            ${
              s.installed
                ? `
                  <button class="site-btn-open" data-card-open="${escapeHtml(s.id)}" title="Open Documentation (Ctrl+Click for New Tab)">
                    Open Docs
                  </button>
                  <button class="site-btn-delta" data-card-new-tab="${escapeHtml(s.id)}" title="Open in a New Browser Tab">
                    + Tab
                  </button>
                  <button
                    class="site-btn-delta ${s.updateAvailable ? "highlight-update" : ""}"
                    data-card-delta="${escapeHtml(s.id)}"
                    ${dl ? "disabled" : ""}
                    title="Run SHA-256 Chunk Diff & HTTP 206 Partial Range Update from GitHub Releases"
                  >
                    ${
                      dl
                        ? `⏳ Syncing... ${dlPct}%`
                        : s.updateAvailable
                        ? "⚡ Update"
                        : "↻ Sync"
                    }
                  </button>
                `
                : `
                  <button class="site-btn-install" data-card-install="${escapeHtml(s.id)}" ${dl ? "disabled" : ""}>
                    ${dl ? `⏳ Downloading... ${dlPct}%` : `⬇ Install & Open Pack (${s.sizeMb} MB • HTTP 206)`}
                  </button>
                `
            }
          </div>
        </article>
      `;
    })
    .join("");

  gridEl.querySelectorAll("[data-card-open]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const me = e as MouseEvent;
      const siteId = btn.getAttribute("data-card-open");
      if (siteId) switchTab(siteId, undefined, me.ctrlKey || me.metaKey);
    });
    btn.addEventListener("auxclick", (e) => {
      const me = e as MouseEvent;
      if (me.button === 1) {
        me.preventDefault();
        const siteId = btn.getAttribute("data-card-open");
        if (siteId) switchTab(siteId, undefined, true);
      }
    });
  });

  gridEl.querySelectorAll("[data-card-new-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const siteId = btn.getAttribute("data-card-new-tab");
      if (siteId) switchTab(siteId, undefined, true);
    });
  });

  gridEl.querySelectorAll("[data-card-jump-site]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const me = e as MouseEvent;
      const siteId = btn.getAttribute("data-card-jump-site");
      const url = btn.getAttribute("data-card-jump-url") || "/docs";
      if (siteId) switchTab(siteId, url, me.ctrlKey || me.metaKey);
    });
    btn.addEventListener("auxclick", (e) => {
      const me = e as MouseEvent;
      if (me.button === 1) {
        me.preventDefault();
        const siteId = btn.getAttribute("data-card-jump-site");
        const url = btn.getAttribute("data-card-jump-url") || "/docs";
        if (siteId) switchTab(siteId, url, true);
      }
    });
  });

  gridEl.querySelectorAll("[data-card-delta]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const siteId = btn.getAttribute("data-card-delta");
      if (siteId) await runGitHubPackUpdate(siteId, false);
    });
  });

  gridEl.querySelectorAll("[data-card-install]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const siteId = btn.getAttribute("data-card-install");
      if (siteId) await runGitHubPackUpdate(siteId, true);
    });
  });
}

async function runGitHubPackUpdate(siteId: string, openAfter = false) {
  const brand = getSiteBrand(siteId);
  applyDownloadProgress({
    site_id: siteId,
    phase: "Starting Download",
    downloaded_bytes: 0,
    total_bytes: 0,
    percent: 2,
    detail: `Connecting to GitHub Releases for ${brand.name} (${siteId}.docpack)...`,
  });

  const banner = document.getElementById("deltaStatusBanner");
  if (banner) {
    banner.style.display = "block";
    banner.textContent = `Downloading & verifying '${siteId}.docpack' from GitHub Releases...`;
  }
  try {
    const res = await invoke<DeltaUpdateResult>("install_or_update_from_github", { siteId });
    if (res.port) {
      sitePorts[siteId] = res.port;
    }
    if (banner) {
      banner.textContent = `✓ [${res.site_id.toUpperCase()} ${res.old_commit} → ${res.new_commit}] ${res.message}`;
    }
    activeDownloads.delete(siteId);
    await syncAllPacksAndRender(false);
    if (openAfter) {
      await switchTab(siteId);
    }
  } catch (err) {
    activeDownloads.delete(siteId);
    if (downloadProgressHud) {
      downloadProgressHud.style.display = "none";
    }
    if (banner) {
      banner.textContent = `Update notice for ${siteId}: ${String(err)}`;
    }
    renderHomeHub(buildUnifiedSitesList());
  }
}

async function updateAllOutdatedPacks() {
  const sites = buildUnifiedSitesList().filter((s) => s.updateAvailable);
  if (sites.length === 0) return;
  for (const s of sites) {
    await runGitHubPackUpdate(s.id, false);
  }
}

// Custom Window Controls via Tauri Backend Commands
async function toggleAppFullscreen() {
  try {
    const isFs = await invoke<boolean>("window_toggle_fullscreen");
    if (typeof isFs === "boolean") {
      btnToggleFullscreen?.classList.toggle("active", isFs);
      if (isFs && !topbarHidden) {
        toggleTopbarHidden();
      } else if (!isFs && topbarHidden) {
        toggleTopbarHidden();
      }
    }
  } catch {}
}

function setupWindowControls() {
  document.getElementById("winMinimize")?.addEventListener("click", () => {
    invoke("window_minimize").catch(() => {});
  });
  document.getElementById("winMaximize")?.addEventListener("click", () => {
    invoke("window_toggle_maximize").catch(() => {});
  });
  document.getElementById("winClose")?.addEventListener("click", () => {
    invoke("window_close").catch(() => {});
  });
  btnToggleFullscreen?.addEventListener("click", () => {
    toggleAppFullscreen();
  });

  titlebarDrag?.addEventListener("mousedown", (e) => {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      target.closest(
        ".browser-tab-item, .browser-tab-action-btn, .titlebar-action-btn, .win-btn, .titlebar-brand"
      )
    ) {
      return;
    }
    if (e.button === 0 && e.detail === 1) {
      invoke("window_start_dragging").catch(() => {});
    }
  });

  titlebarDrag?.addEventListener("dblclick", (e) => {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      target.closest(
        ".browser-tab-item, .browser-tab-action-btn, .titlebar-action-btn, .win-btn, .titlebar-brand"
      )
    ) {
      return;
    }
    invoke("window_toggle_maximize").catch(() => {});
  });
}

// Discord Hover Sidebar & Collapsible Custom Topbar Logic
function openHoverSidebar() {
  if (sidebarCloseTimer) {
    window.clearTimeout(sidebarCloseTimer);
    sidebarCloseTimer = null;
  }
  discordSidebar.classList.add("open");
}

function scheduleCloseHoverSidebar(delay = 220) {
  if (sidebarPinned) return;
  if (sidebarCloseTimer) window.clearTimeout(sidebarCloseTimer);
  sidebarCloseTimer = window.setTimeout(() => {
    discordSidebar.classList.remove("open");
  }, delay);
}

function applyDrawerState() {
  discordSidebar.classList.toggle("drawer-hidden", drawerHidden);
  document.body.classList.toggle("drawer-hidden", drawerHidden);
  btnToggleDrawer?.classList.toggle("active", !drawerHidden);
}

function toggleDrawerHidden() {
  drawerHidden = !drawerHidden;
  try {
    localStorage.setItem("docx_drawer_hidden", String(drawerHidden));
  } catch {}
  applyDrawerState();
}

function togglePinSidebar() {
  sidebarPinned = !sidebarPinned;
  discordSidebar.classList.toggle("pinned", sidebarPinned);
  document.body.classList.toggle("sidebar-pinned", sidebarPinned);
  btnPinSidebar.classList.toggle("active", sidebarPinned);
  if (sidebarPinned) {
    discordSidebar.classList.add("open");
  }
}

function toggleTopbarHidden() {
  topbarHidden = !topbarHidden;
  document.body.classList.toggle("topbar-hidden", topbarHidden);
  document.body.classList.remove("topbar-peek");
  btnRailToggleTopbar.classList.toggle("active", !topbarHidden);
  if (topbarToggleLabel) {
    topbarToggleLabel.textContent = topbarHidden ? "Pin Bar" : "Hide Bar";
  }
}

function peekTopbar() {
  if (!topbarHidden) return;
  if (topbarCloseTimer) {
    window.clearTimeout(topbarCloseTimer);
    topbarCloseTimer = null;
  }
  document.body.classList.add("topbar-peek");
}

function scheduleClosePeekTopbar(delay = 350) {
  if (!topbarHidden) return;
  if (topbarCloseTimer) window.clearTimeout(topbarCloseTimer);
  topbarCloseTimer = window.setTimeout(() => {
    document.body.classList.remove("topbar-peek");
  }, delay);
}

function setupSidebarAndTopbarHover() {
  applyDrawerState();
  leftEdgeSensor.addEventListener("mouseenter", () => openHoverSidebar());
  discordSidebar.addEventListener("mouseenter", () => openHoverSidebar());
  discordSidebar.addEventListener("mouseleave", () => scheduleCloseHoverSidebar(220));

  btnToggleDrawer?.addEventListener("click", () => toggleDrawerHidden());
  btnCollapseDrawer?.addEventListener("click", () => toggleDrawerHidden());
  btnPinSidebar.addEventListener("click", () => togglePinSidebar());
  btnToggleTopbar.addEventListener("click", () => toggleTopbarHidden());
  btnRailToggleTopbar.addEventListener("click", () => toggleTopbarHidden());

  topEdgeSensor.addEventListener("mouseenter", () => peekTopbar());
  customTitlebar.addEventListener("mouseenter", () => peekTopbar());
  customTitlebar.addEventListener("mouseleave", () => scheduleClosePeekTopbar(300));
}

// Load Search Index
async function loadSearchIndex() {
  try {
    const res = await fetch("/search-index.json");
    if (res.ok) {
      baseSearchIndex = await res.json();
      await refreshExtraSearchEntries();
    }
  } catch (err) {
    console.error("Failed to load search index:", err);
  }
}

async function refreshExtraSearchEntries() {
  try {
    const extra = await invoke<SearchEntry[]>("get_extra_search_entries");
    searchIndex = [...baseSearchIndex, ...(extra || [])];
  } catch {
    searchIndex = [...baseSearchIndex];
  }
  const twCount = searchIndex.filter((i) => i.site === "tailwind").length;
  const shadcnCount = searchIndex.filter((i) => i.site === "shadcn").length;
  if (countAll) countAll.textContent = searchIndex.length.toString();
  if (countTw) countTw.textContent = twCount.toString();
  if (countShadcn) countShadcn.textContent = shadcnCount.toString();
}

// Multi-Tab Browser Management
function getActiveBrowserTab(): BrowserTab {
  return browserTabs.find((t) => t.id === activeBrowserTabId) || browserTabs[0];
}

function formatTabTitle(siteId: string, rawTitle?: string, pathOrUrl?: string): string {
  if (siteId === "home") return "57-Site Hub";
  const brand = getSiteBrand(siteId);
  if (rawTitle && rawTitle.trim()) {
    const cleaned = rawTitle
      .replace(/\s*[|—–-]\s*(Qt\s*[\d.]*|Hono|Vue\.js|Nuxt|Angular|Motion|Python.*|FastAPI|Django.*|Express.*|NestJS.*|Three\.js.*|Tailwind.*|shadcn.*|MDN.*|Docs|Documentation).*$/i, "")
      .trim();
    if (cleaned && cleaned.toLowerCase() !== brand.name.toLowerCase()) {
      return `${brand.name} · ${cleaned}`;
    }
  }
  if (pathOrUrl && pathOrUrl !== "/" && pathOrUrl !== "/docs") {
    try {
      const cleanPath = pathOrUrl
        .replace(/^https?:\/\/[^/]+/, "")
        .replace(/\.(html|htm)$/i, "")
        .replace(/^\/(docs|guide|qt-6|en\/6\.1|3)\/?/, "")
        .replace(/\/$/, "");
      const lastSeg = cleanPath.split("/").filter(Boolean).pop();
      if (lastSeg && lastSeg !== "index" && lastSeg !== "docs") {
        return `${brand.name} · ${lastSeg}`;
      }
    } catch {}
  }
  return brand.name;
}

function renderBrowserTabs() {
  if (!browserTabsList) return;

  browserTabsList.innerHTML = browserTabs
    .map((t) => {
      const isActive = t.id === activeBrowserTabId;
      const isHome = t.siteId === "home";
      const brand = getSiteBrand(t.siteId);
      const badgeHtml = isHome
        ? `<span class="browser-tab-badge home-badge">⌂</span>`
        : `<span class="browser-tab-badge" style="background: ${brand.bgTint}; color: ${brand.color}; border: 1px solid ${brand.color}44;">${escapeHtml(
            brand.badge
          )}</span>`;
      const showClose = browserTabs.length > 1 || !isHome;

      return `
        <div class="browser-tab-item ${isActive ? "active" : ""}" data-tab-id="${t.id}" title="${escapeHtml(
        t.title
      )} (${escapeHtml(t.pathOrUrl)})">
          ${badgeHtml}
          <span class="browser-tab-title">${escapeHtml(t.title)}</span>
          ${
            showClose
              ? `<button class="browser-tab-close" data-close-tab="${t.id}" title="Close Tab (Ctrl+W)">×</button>`
              : ""
          }
        </div>
      `;
    })
    .join("");

  browserTabsList.querySelectorAll(".browser-tab-item").forEach((el) => {
    const tabId = el.getAttribute("data-tab-id");
    if (!tabId) return;

    el.addEventListener("click", (ev) => {
      const target = ev.target as HTMLElement | null;
      if (target && target.closest("[data-close-tab]")) return;
      activateBrowserTab(tabId);
    });

    el.addEventListener("auxclick", (ev) => {
      const me = ev as MouseEvent;
      if (me.button === 1) {
        me.preventDefault();
        me.stopPropagation();
        closeBrowserTab(tabId);
      }
    });
  });

  browserTabsList.querySelectorAll("[data-close-tab]").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const tabId = btn.getAttribute("data-close-tab");
      if (tabId) closeBrowserTab(tabId);
    });
  });

  const activeEl = browserTabsList.querySelector(".browser-tab-item.active") as HTMLElement | null;
  if (activeEl) {
    activeEl.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}

function ensureTabDomPanel(tab: BrowserTab) {
  if (tab.siteId === "home" || !viewportContainer) return;
  if (tab.panelEl && tab.iframeEl && tab.loadingEl) return;

  const brand = getSiteBrand(tab.siteId);
  const panel = document.createElement("section");
  panel.className = "view-panel";
  panel.dataset.tabPanelId = tab.id;

  const loading = document.createElement("div");
  loading.className = "iframe-loading";
  loading.style.display = "none";
  loading.innerHTML = `<div class="spinner"></div><span>Loading ${escapeHtml(brand.name)} (${escapeHtml(
    brand.version
  )})...</span>`;

  const iframe = document.createElement("iframe");
  iframe.className = "doc-iframe";
  iframe.title = `${brand.name} Documentation`;

  panel.appendChild(loading);
  panel.appendChild(iframe);
  viewportContainer.appendChild(panel);

  tab.panelEl = panel;
  tab.iframeEl = iframe;
  tab.loadingEl = loading;
}

async function loadTabFrame(tab: BrowserTab, forceReload = false) {
  if (tab.siteId === "home") return;

  if (tab.siteId !== "tailwind" && tab.siteId !== "shadcn") {
    try {
      const port = await invoke<number>("ensure_site_server_cmd", { siteId: tab.siteId });
      if (port) sitePorts[tab.siteId] = port;
    } catch {}
  }

  ensureTabDomPanel(tab);
  const iframe = tab.iframeEl;
  const loadingEl = tab.loadingEl;
  if (!iframe || !loadingEl) return;

  const brand = getSiteBrand(tab.siteId);
  const defaultEntryPath =
    tab.pathOrUrl ||
    (brand.defaultRoutes && brand.defaultRoutes.length > 0 ? brand.defaultRoutes[0].path : "/docs");
  tab.pathOrUrl = defaultEntryPath;
  const url = resolveUrl(tab.siteId, defaultEntryPath);

  const currentSrc = iframe.getAttribute("src") || "";
  if (forceReload || !currentSrc || currentSrc === "about:blank" || iframe.src !== url) {
    loadingEl.style.display = "flex";
    if (tab.loadingTimer) window.clearTimeout(tab.loadingTimer);
    tab.loadingTimer = window.setTimeout(() => {
      loadingEl.style.display = "none";
      syncReaderSettingsToAllIframes();
    }, 650);

    iframe.onload = () => {
      if (tab.loadingTimer) {
        window.clearTimeout(tab.loadingTimer);
        tab.loadingTimer = undefined;
      }
      loadingEl.style.display = "none";
      syncReaderSettingsToAllIframes();
      try {
        const docTitle = iframe.contentDocument?.title;
        const docPath = iframe.contentWindow?.location?.pathname;
        if (docPath) tab.pathOrUrl = docPath;
        tab.title = formatTabTitle(tab.siteId, docTitle, tab.pathOrUrl);
        renderBrowserTabs();
      } catch {}
    };
    iframe.src = url;
  } else {
    loadingEl.style.display = "none";
    syncReaderSettingsToAllIframes();
  }
}

function activateBrowserTab(tabId: string) {
  const target = browserTabs.find((t) => t.id === tabId);
  if (!target) return;

  activeBrowserTabId = target.id;
  activeTab = target.siteId;
  updateTopbarDarkButtonUI();

  const sites = buildUnifiedSitesList();
  renderBrowserTabs();
  renderServerRail(sites);
  renderChannelDrawer(sites);

  if (titlebarCurrentView) {
    if (target.siteId === "home") {
      titlebarCurrentView.textContent = `${sites.length}-Site Hub`;
    } else {
      const brand = getSiteBrand(target.siteId);
      titlebarCurrentView.textContent = `${brand.name} (${brand.version})`;
    }
  }

  // Hide legacy static panels and only show either viewHome or the active tab's panelEl
  [viewTailwind, viewShadcn, viewDynamic].forEach((v) => v?.classList.remove("active"));
  if (target.siteId === "home") {
    viewHome?.classList.add("active");
  } else {
    viewHome?.classList.remove("active");
    ensureTabDomPanel(target);
  }

  for (const t of browserTabs) {
    if (t.panelEl) {
      t.panelEl.classList.toggle("active", t.id === target.id && target.siteId !== "home");
    }
  }
}

function closeBrowserTab(tabId: string) {
  const idx = browserTabs.findIndex((t) => t.id === tabId);
  if (idx === -1) return;

  const closing = browserTabs[idx];
  if (closing.loadingTimer) {
    window.clearTimeout(closing.loadingTimer);
  }
  if (closing.panelEl) {
    closing.panelEl.remove();
  }

  browserTabs.splice(idx, 1);

  if (browserTabs.length === 0) {
    const fallbackHome: BrowserTab = {
      id: `tab-${++tabSeq}`,
      siteId: "home",
      title: "57-Site Hub",
      pathOrUrl: "/",
    };
    browserTabs.push(fallbackHome);
    activateBrowserTab(fallbackHome.id);
    return;
  }

  if (activeBrowserTabId === tabId) {
    const nextTab = browserTabs[Math.min(idx, browserTabs.length - 1)];
    activateBrowserTab(nextTab.id);
  } else {
    renderBrowserTabs();
  }
}

function openBlankPickerTab() {
  const newTab: BrowserTab = {
    id: `tab-${++tabSeq}`,
    siteId: "home",
    title: "New Tab",
    pathOrUrl: "/",
    isNewTabPicker: true,
  };
  browserTabs.push(newTab);
  activateBrowserTab(newTab.id);
}

async function duplicateActiveBrowserTab() {
  const current = getActiveBrowserTab();
  if (!current || current.siteId === "home") {
    openBlankPickerTab();
    return;
  }
  let currentPath = current.pathOrUrl;
  try {
    const livePath = current.iframeEl?.contentWindow?.location?.pathname;
    const liveSearch = current.iframeEl?.contentWindow?.location?.search || "";
    const liveHash = current.iframeEl?.contentWindow?.location?.hash || "";
    if (livePath) currentPath = `${livePath}${liveSearch}${liveHash}`;
  } catch {}

  await switchTab(current.siteId, currentPath, true);
}

function cycleBrowserTab(delta: number) {
  if (browserTabs.length <= 1) return;
  const curIdx = browserTabs.findIndex((t) => t.id === activeBrowserTabId);
  const nextIdx = (curIdx + delta + browserTabs.length) % browserTabs.length;
  activateBrowserTab(browserTabs[nextIdx].id);
}

// Tab / Server Switching (Supports Multi-Tab & Same-Doc Multiple Pages)
async function switchTab(tab: string, targetPathOrUrl?: string, forceNewTab = false) {
  if (tab === "home" && !forceNewTab) {
    const existingHome = browserTabs.find((t) => t.siteId === "home");
    if (existingHome) {
      activateBrowserTab(existingHome.id);
    } else {
      const homeTab: BrowserTab = {
        id: `tab-${++tabSeq}`,
        siteId: "home",
        title: "57-Site Hub",
        pathOrUrl: "/",
      };
      browserTabs.unshift(homeTab);
      activateBrowserTab(homeTab.id);
    }
    if (!sidebarPinned) scheduleCloseHoverSidebar(120);
    return;
  }

  const brand = getSiteBrand(tab);
  const defaultEntryPath =
    targetPathOrUrl ||
    (brand.defaultRoutes && brand.defaultRoutes.length > 0 ? brand.defaultRoutes[0].path : "/docs");

  const current = getActiveBrowserTab();

  // Case 1: Explicitly opening a new tab (+ Tab button, Ctrl+Click, Middle-Click, Duplicate)
  if (forceNewTab) {
    const newTab: BrowserTab = {
      id: `tab-${++tabSeq}`,
      siteId: tab,
      title: formatTabTitle(tab, undefined, defaultEntryPath),
      pathOrUrl: defaultEntryPath,
    };
    browserTabs.push(newTab);
    activateBrowserTab(newTab.id);
    await loadTabFrame(newTab, true);
    if (!sidebarPinned) scheduleCloseHoverSidebar(120);
    return;
  }

  // Case 2: Current tab is a "New Tab" picker (or the initial Home Hub tab) -> replace it in-place with the chosen doc
  if (current && current.siteId === "home") {
    current.siteId = tab;
    current.isNewTabPicker = false;
    current.pathOrUrl = defaultEntryPath;
    current.title = formatTabTitle(tab, undefined, defaultEntryPath);
    activateBrowserTab(current.id);
    await loadTabFrame(current, true);
    if (!sidebarPinned) scheduleCloseHoverSidebar(120);
    return;
  }

  // Case 3: Current tab is already on this exact site -> navigate within the current tab
  if (current && current.siteId === tab) {
    if (targetPathOrUrl) {
      current.pathOrUrl = targetPathOrUrl;
      current.title = formatTabTitle(tab, undefined, targetPathOrUrl);
      activateBrowserTab(current.id);
      await loadTabFrame(current, false);
    } else {
      activateBrowserTab(current.id);
    }
    if (!sidebarPinned) scheduleCloseHoverSidebar(120);
    return;
  }

  // Case 4: User is viewing Doc A and clicks Doc B in the Sidebar/Search:
  // If Doc B already has an open tab (and no new deep path was forced), switch to it;
  // otherwise open Doc B in a new tab so Doc A stays open in its tab!
  const existingSiteTab = browserTabs.find((t) => t.siteId === tab);
  if (existingSiteTab && !targetPathOrUrl) {
    activateBrowserTab(existingSiteTab.id);
    if (!sidebarPinned) scheduleCloseHoverSidebar(120);
    return;
  }

  const newSiteTab: BrowserTab = {
    id: `tab-${++tabSeq}`,
    siteId: tab,
    title: formatTabTitle(tab, undefined, defaultEntryPath),
    pathOrUrl: defaultEntryPath,
  };
  browserTabs.push(newSiteTab);
  activateBrowserTab(newSiteTab.id);
  await loadTabFrame(newSiteTab, true);

  if (!sidebarPinned) {
    scheduleCloseHoverSidebar(120);
  }
}

function resolveUrl(site: string, pathOrUrl: string): string {
  const origin = getOrigin(site);
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    try {
      const parsed = new URL(pathOrUrl);
      return `${origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return `${origin}/docs`;
    }
  }
  return `${origin}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

// Universal Search Logic
function performSearch(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) {
    currentResults = searchIndex
      .filter((item) => currentFilter === "all" || item.site === currentFilter)
      .slice(0, 35);
  } else {
    const tokens = q.split(/\s+/).filter(Boolean);
    const scored = searchIndex
      .filter((item) => currentFilter === "all" || item.site === currentFilter)
      .map((item) => {
        let score = 0;
        const titleLower = (item.title || "").toLowerCase();
        const descLower = (item.description || "").toLowerCase();
        const pathLower = (item.path || "").toLowerCase();
        const categoryLower = (item.category || "").toLowerCase();
        const keywordsLower = (item.keywords || []).map((k) => k.toLowerCase()).join(" ");

        if (titleLower === q) score += 100;
        else if (titleLower.startsWith(q)) score += 60;
        else if (titleLower.includes(q)) score += 40;

        for (const token of tokens) {
          if (titleLower.includes(token)) score += 25;
          if (keywordsLower.includes(token)) score += 15;
          if (pathLower.includes(token)) score += 10;
          if (categoryLower.includes(token)) score += 10;
          if (descLower.includes(token)) score += 5;
        }

        return { item, score };
      })
      .filter((res) => res.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((res) => res.item);

    currentResults = scored.slice(0, 50);
  }

  selectedIndex = 0;
  renderSearchResults(q);
}

function renderSearchResults(query: string) {
  if (currentResults.length === 0) {
    searchResultsList.innerHTML = `
      <div class="search-no-results">
        <p>No documentation results found for "${escapeHtml(query)}"</p>
      </div>
    `;
    return;
  }

  searchResultsList.innerHTML = currentResults
    .map((item, idx) => {
      const isSelected = idx === selectedIndex;
      const brand = getSiteBrand(item.site);

      return `
        <div class="search-result-item ${isSelected ? "selected" : ""}" data-index="${idx}">
          <span class="result-badge" style="background: ${brand.bgTint}; color: ${brand.color};">${escapeHtml(
        item.site.slice(0, 8)
      )}</span>
          <div class="result-info">
            <div class="result-top-line">
              <span class="result-title">${highlight(item.title, query)}</span>
              <span class="result-category">${escapeHtml(item.category || item.siteName)}</span>
            </div>
            <p class="result-snippet">${highlight(item.description || item.path, query)}</p>
          </div>
          <span class="result-enter-hint">↵ Open · Ctrl+↵ New Tab</span>
        </div>
      `;
    })
    .join("");

  searchResultsList.querySelectorAll(".search-result-item").forEach((el) => {
    el.addEventListener("click", (ev) => {
      const me = ev as MouseEvent;
      const idx = parseInt(el.getAttribute("data-index") || "0", 10);
      selectResult(idx, me.ctrlKey || me.metaKey || me.button === 1);
    });
    el.addEventListener("auxclick", (ev) => {
      const me = ev as MouseEvent;
      if (me.button === 1) {
        me.preventDefault();
        const idx = parseInt(el.getAttribute("data-index") || "0", 10);
        selectResult(idx, true);
      }
    });
  });

  const activeEl = searchResultsList.querySelector(".search-result-item.selected") as HTMLElement;
  if (activeEl) {
    activeEl.scrollIntoView({ block: "nearest" });
  }
}

function selectResult(index: number, forceNewTab = false) {
  const item = currentResults[index];
  if (!item) return;

  closeSearchModal();
  switchTab(item.site, item.path, forceNewTab);
}

function highlight(text: string, query: string): string {
  if (!query) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const q = escapeRegex(query.trim());
  const regex = new RegExp(`(${q})`, "gi");
  return escaped.replace(
    regex,
    "<mark style='background:rgba(255,255,255,0.22);color:#fff;border-radius:2px;padding:0 2px;'>$1</mark>"
  );
}

function escapeHtml(str: string): string {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function openSearchModal() {
  searchModal.classList.add("open");
  searchModal.setAttribute("aria-hidden", "false");
  searchInput.value = "";
  performSearch("");
  setTimeout(() => searchInput.focus(), 40);
}

function closeSearchModal() {
  searchModal.classList.remove("open");
  searchModal.setAttribute("aria-hidden", "true");
}

async function checkServerHealth(): Promise<void> {
  try {
    const status = await invoke<ServerStatus>("check_servers");
    tailwindPort = status.tailwind_port;
    shadcnPort = status.shadcn_port;
    if (status.site_ports) {
      sitePorts = { ...sitePorts, ...status.site_ports };
    }
  } catch {}
}

function getActiveIframe(): HTMLIFrameElement | null {
  const cur = getActiveBrowserTab();
  if (!cur || cur.siteId === "home") return null;
  return cur.iframeEl || null;
}

function setupEventListeners() {
  tabHome?.addEventListener("click", () => switchTab("home"));
  brandBtn?.addEventListener("click", () => switchTab("home"));
  titlebarBrandHome?.addEventListener("click", () => switchTab("home"));

  btnNewBrowserTab?.addEventListener("click", () => openBlankPickerTab());
  btnDuplicateBrowserTab?.addEventListener("click", () => duplicateActiveBrowserTab());

  btnZoomOut?.addEventListener("click", () => setReaderZoom(readerZoom - 10));
  btnZoomReset?.addEventListener("click", () => setReaderZoom(100));
  btnZoomIn?.addEventListener("click", () => setReaderZoom(readerZoom + 10));
  btnToggleDarkSite?.addEventListener("click", () => toggleReaderDarkMode());

  titlebarUpdatePill?.addEventListener("click", () => {
    switchTab("home");
    selectedHubCategory = "updates";
    document.querySelectorAll(".hub-cat-tab").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-cat") === "updates");
    });
    renderAllUI(false);
  });

  btnAlertUpdateAll?.addEventListener("click", async () => {
    await updateAllOutdatedPacks();
  });

  document.getElementById("btnUpdateAllPacks")?.addEventListener("click", async () => {
    await updateAllOutdatedPacks();
  });

  btnAlertDismiss?.addEventListener("click", () => {
    if (updateAlertBanner) updateAlertBanner.style.display = "none";
  });

  document.getElementById("btnRefreshRegistry")?.addEventListener("click", async () => {
    const banner = document.getElementById("deltaStatusBanner");
    if (banner) {
      banner.style.display = "block";
      banner.textContent = "Checking GitHub Releases (VahidM313/docx) for docpack & app core updates...";
    }
    await syncAllPacksAndRender(true);
    const appUpd = await checkAppCoreUpdateStatus();
    if (banner) {
      if (appUpd && appUpd.updateAvailable) {
        banner.textContent = `✓ Synced 57-Site Registry • New App Core available (${appUpd.localCommit} → ${appUpd.remoteCommit}, only ${appUpd.coreSizeMb} MB delta download)!`;
      } else if (appUpd) {
        banner.textContent = `✓ Synced live 57-Site Registry from GitHub Releases (packs-latest). App Core (${appUpd.remoteCommit}) is up to date.`;
      } else {
        banner.textContent = "✓ Synced live 57-Site Registry from GitHub Releases (packs-latest).";
      }
    }
  });

  document.getElementById("btnSelfUpdateApp")?.addEventListener("click", async () => {
    const btn = document.getElementById("btnSelfUpdateApp") as HTMLButtonElement | null;
    const banner = document.getElementById("deltaStatusBanner");
    if (btn) btn.disabled = true;
    if (banner) {
      banner.style.display = "block";
      banner.textContent =
        "Downloading updated Docx-core.exe (~4 MB) & replacing Docx.exe in-place (preserving all local documentation packs)...";
    }
    try {
      const msg = await invoke<string>("self_update_app");
      if (btn) btn.style.display = "none";
      if (banner) {
        banner.textContent = `✓ ${msg}`;
      }
    } catch (err) {
      if (btn) btn.disabled = false;
      if (banner) {
        banner.textContent = `App core update error: ${String(err)}`;
      }
    }
  });

  document.getElementById("btnBundleSingleExe")?.addEventListener("click", async () => {
    const banner = document.getElementById("deltaStatusBanner");
    if (banner) {
      banner.style.display = "block";
      banner.textContent =
        "Bundling all installed .docpack chunks into standalone Desktop\\Docx.exe via DOCXPACK trailer...";
    }
    try {
      const msg = await invoke<string>("bundle_into_single_exe");
      if (banner) {
        banner.textContent = `✓ ${msg}`;
      }
      await syncAllPacksAndRender(false);
    } catch (err) {
      if (banner) {
        banner.textContent = `Bundle error: ${String(err)}`;
      }
    }
  });

  // Hub Category Filter Tabs
  document.querySelectorAll(".hub-cat-tab").forEach((tabBtn) => {
    tabBtn.addEventListener("click", () => {
      document.querySelectorAll(".hub-cat-tab").forEach((b) => b.classList.remove("active"));
      tabBtn.classList.add("active");
      selectedHubCategory = tabBtn.getAttribute("data-cat") || "all";
      renderHomeHub(buildUnifiedSitesList());
    });
  });

  // Hub Live Filter Input
  const hubFilterInput = document.getElementById("hubSiteFilterInput") as HTMLInputElement;
  hubFilterInput?.addEventListener("input", () => {
    hubSearchQuery = hubFilterInput.value;
    renderHomeHub(buildUnifiedSitesList());
  });

  openSearchBtn?.addEventListener("click", openSearchModal);
  drawerSearchBtn?.addEventListener("click", openSearchModal);
  btnQuickSearchTop?.addEventListener("click", openSearchModal);
  heroSearchBtn?.addEventListener("click", openSearchModal);
  clearSearchBtn?.addEventListener("click", closeSearchModal);

  searchModal.addEventListener("click", (e) => {
    if (e.target === searchModal) closeSearchModal();
  });

  searchInput.addEventListener("input", () => {
    performSearch(searchInput.value);
  });

  document.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      currentFilter = chip.getAttribute("data-filter") || "all";
      performSearch(searchInput.value);
    });
  });

  // Cross-iframe messages for Ctrl+K, Zoom, Dark Reader, Multi-Tab, Fullscreen, and Edge Hover
  window.addEventListener("message", (e) => {
    if (!e.data || !e.data.type) return;
    if (e.data.type === "OPEN_UNIVERSAL_SEARCH") {
      if (searchModal.classList.contains("open")) {
        closeSearchModal();
      } else {
        openSearchModal();
      }
    } else if (e.data.type === "DOCX_IFRAME_READY") {
      // Immediately hide loading spinner as soon as DOMContentLoaded fires inside the iframe
      const matchingTab = browserTabs.find(
        (t) => t.iframeEl && t.iframeEl.contentWindow === e.source
      );
      if (matchingTab) {
        if (matchingTab.loadingTimer) {
          window.clearTimeout(matchingTab.loadingTimer);
          matchingTab.loadingTimer = undefined;
        }
        if (matchingTab.loadingEl) {
          matchingTab.loadingEl.style.display = "none";
        }
        if (e.data.path) {
          matchingTab.pathOrUrl = String(e.data.path);
        }
        matchingTab.title = formatTabTitle(
          matchingTab.siteId,
          e.data.title ? String(e.data.title) : undefined,
          matchingTab.pathOrUrl
        );
        renderBrowserTabs();
      }
      syncReaderSettingsToAllIframes();
    } else if (e.data.type === "DOCX_SITE_THEME_CHANGED") {
      if (e.data.siteId) {
        setSiteDarkMode(String(e.data.siteId), Boolean(e.data.darkMode), false);
      }
    } else if (e.data.type === "DOCX_TOGGLE_FULLSCREEN") {
      toggleAppFullscreen();
    } else if (e.data.type === "DOCX_OPEN_NEW_TAB") {
      const siteId = String(e.data.siteId || activeTab);
      const urlOrPath = String(e.data.url || "/docs");
      if (siteId && siteId !== "home") {
        switchTab(siteId, urlOrPath, true);
      }
    } else if (e.data.type === "DOCX_TAB_ACTION") {
      const act = String(e.data.action || "");
      if (act === "new") openBlankPickerTab();
      else if (act === "close") closeBrowserTab(activeBrowserTabId);
      else if (act === "duplicate") duplicateActiveBrowserTab();
      else if (act === "next") cycleBrowserTab(1);
      else if (act === "prev") cycleBrowserTab(-1);
    } else if (e.data.type === "DOCX_ZOOM_DELTA") {
      setReaderZoom(readerZoom + (Number(e.data.delta) || 0));
    } else if (e.data.type === "DOCX_ZOOM_RESET") {
      setReaderZoom(100);
    } else if (e.data.type === "HOVER_LEFT_EDGE") {
      openHoverSidebar();
    } else if (e.data.type === "HOVER_TOP_EDGE") {
      peekTopbar();
    } else if (e.data.type === "IFRAME_INTERACT") {
      if (!sidebarPinned) {
        discordSidebar.classList.remove("open");
      }
      if (topbarHidden) {
        document.body.classList.remove("topbar-peek");
      }
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "F11") {
      e.preventDefault();
      toggleAppFullscreen();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "t" && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      openBlankPickerTab();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "w" && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      closeBrowserTab(activeBrowserTabId);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "d") {
      e.preventDefault();
      duplicateActiveBrowserTab();
      return;
    }

    if (e.ctrlKey && e.key === "Tab") {
      e.preventDefault();
      cycleBrowserTab(e.shiftKey ? -1 : 1);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "+")) {
      e.preventDefault();
      setReaderZoom(readerZoom + 10);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === "-") {
      e.preventDefault();
      setReaderZoom(readerZoom - 10);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === "0") {
      e.preventDefault();
      setReaderZoom(100);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (searchModal.classList.contains("open")) {
        closeSearchModal();
      } else {
        openSearchModal();
      }
      return;
    }

    if (!searchModal.classList.contains("open")) return;

    if (e.key === "Escape") {
      e.preventDefault();
      closeSearchModal();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (currentResults.length > 0) {
        selectedIndex = (selectedIndex + 1) % currentResults.length;
        renderSearchResults(searchInput.value);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (currentResults.length > 0) {
        selectedIndex = (selectedIndex - 1 + currentResults.length) % currentResults.length;
        renderSearchResults(searchInput.value);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectResult(selectedIndex, e.ctrlKey || e.metaKey);
    }
  });

  btnBack?.addEventListener("click", () => {
    const iframe = getActiveIframe();
    if (iframe?.contentWindow) {
      try {
        iframe.contentWindow.history.back();
      } catch (e) {
        console.warn(e);
      }
    }
  });

  btnForward?.addEventListener("click", () => {
    const iframe = getActiveIframe();
    if (iframe?.contentWindow) {
      try {
        iframe.contentWindow.history.forward();
      } catch (e) {
        console.warn(e);
      }
    }
  });

  btnReload?.addEventListener("click", () => {
    const cur = getActiveBrowserTab();
    if (cur && cur.siteId !== "home") {
      loadTabFrame(cur, true);
    }
  });

  btnExternal?.addEventListener("click", () => {
    const cur = getActiveBrowserTab();
    if (cur && cur.siteId !== "home") {
      window.open(resolveUrl(cur.siteId, cur.pathOrUrl || "/docs"), "_blank");
    }
  });
}

init();

