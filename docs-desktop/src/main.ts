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
let readerDarkMode = localStorage.getItem("docx_reader_dark") !== "0";

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

const iframeTailwind = document.getElementById("iframeTailwind") as HTMLIFrameElement;
const iframeShadcn = document.getElementById("iframeShadcn") as HTMLIFrameElement;
const iframeDynamic = document.getElementById("iframeDynamic") as HTMLIFrameElement;
const twLoading = document.getElementById("twLoading") as HTMLElement;
const shadcnLoading = document.getElementById("shadcnLoading") as HTMLElement;
const dynamicLoading = document.getElementById("dynamicLoading") as HTMLElement;
const dynamicLoadingText = document.getElementById("dynamicLoadingText") as HTMLElement;

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
  updateSplash(24, "Initializing 42-Site Offline Engine...");

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

function setReaderZoom(nextZoom: number) {
  readerZoom = Math.max(60, Math.min(220, Math.round(nextZoom / 5) * 5));
  try {
    localStorage.setItem("docx_reader_zoom", String(readerZoom));
  } catch {}
  syncReaderSettingsToAllIframes();
}

function toggleReaderDarkMode() {
  readerDarkMode = !readerDarkMode;
  try {
    localStorage.setItem("docx_reader_dark", readerDarkMode ? "1" : "0");
  } catch {}
  syncReaderSettingsToAllIframes();
}

function syncReaderSettingsToAllIframes() {
  if (btnZoomReset) {
    btnZoomReset.textContent = `${readerZoom}%`;
  }
  if (btnToggleDarkSite) {
    btnToggleDarkSite.classList.toggle("active", readerDarkMode);
  }
  if (darkSiteIcon) {
    darkSiteIcon.textContent = readerDarkMode ? "🌙" : "☀️";
  }
  if (darkSiteLabel) {
    darkSiteLabel.textContent = readerDarkMode ? "Dark" : "Light";
  }
  if (viewHome) {
    (viewHome.style as any).zoom = `${readerZoom / 100}`;
  }

  const msg = {
    type: "DOCX_READER_SETTINGS",
    zoom: readerZoom,
    darkMode: readerDarkMode,
  };
  [iframeTailwind, iframeShadcn, iframeDynamic].forEach((frame) => {
    try {
      frame?.contentWindow?.postMessage(msg, "*");
    } catch {}
  });
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
  renderAllUI(showStartupNotification);
}

function renderAllUI(showStartupNotification = false) {
  const sites = buildUnifiedSitesList();
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
            title="${escapeHtml(s.name)} (${escapeHtml(s.version)})${
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
    btn.addEventListener("click", () => {
      const siteId = btn.getAttribute("data-open-site");
      if (siteId) switchTab(siteId);
    });
  });
}

// 3. Render Column 2: Discord Channel Drawer with All 42 Sites & Original Brand Colored Icons
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
        <span class="channel-name">42-Site Hub & Store</span>
        <span class="channel-tag">${sites.length}</span>
      </button>
      ${installedSites
        .map(
          (s) => `
        <button class="channel-item ${activeTab === s.id ? "active" : ""}" data-drawer-site="${escapeHtml(s.id)}">
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
              title="${escapeHtml(s.name)} — ${s.installed ? "Click to Open" : "Click to Install & Open"}"
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
    btn.addEventListener("click", async () => {
      const target = btn.getAttribute("data-drawer-site");
      if (!target) return;
      if (target === "home") {
        switchTab("home");
        return;
      }
      const siteEntry = sites.find((s) => s.id === target);
      if (siteEntry && !siteEntry.installed) {
        await runGitHubPackUpdate(target, true);
      } else {
        switchTab(target);
      }
    });
  });
}

// 4. Render Redesigned 42-Site Home Hub
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
                    )}">${escapeHtml(r.label)}</button>`
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
                  <button class="site-btn-open" data-card-open="${escapeHtml(s.id)}">
                    Open Docs
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
                        ? "⚡ Update Now (HTTP 206)"
                        : "⚡ Delta Sync"
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
    btn.addEventListener("click", () => {
      const siteId = btn.getAttribute("data-card-open");
      if (siteId) switchTab(siteId);
    });
  });

  gridEl.querySelectorAll("[data-card-jump-site]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const siteId = btn.getAttribute("data-card-jump-site");
      const url = btn.getAttribute("data-card-jump-url") || "/docs";
      if (siteId) switchTab(siteId, url);
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
    invoke("window_toggle_fullscreen").catch(() => {});
  });

  titlebarDrag?.addEventListener("mousedown", (e) => {
    if (e.button === 0 && e.detail === 1) {
      invoke("window_start_dragging").catch(() => {});
    }
  });

  titlebarDrag?.addEventListener("dblclick", () => {
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

// Tab / Server Switching
async function switchTab(tab: string, targetPathOrUrl?: string) {
  activeTab = tab;

  const sites = buildUnifiedSitesList();
  renderServerRail(sites);
  renderChannelDrawer(sites);

  const brand = getSiteBrand(tab);
  if (titlebarCurrentView) {
    titlebarCurrentView.textContent =
      tab === "home" ? "42-Site Documentation Hub" : `${brand.name} (${brand.version})`;
  }

  [viewHome, viewTailwind, viewShadcn, viewDynamic].forEach((view) =>
    view?.classList.remove("active")
  );
  if (tab === "home") {
    viewHome.classList.add("active");
  } else if (tab === "tailwind") {
    viewTailwind.classList.add("active");
    const fullUrl = resolveUrl("tailwind", targetPathOrUrl || "/docs");
    loadSiteFrame(iframeTailwind, twLoading, fullUrl);
  } else if (tab === "shadcn") {
    viewShadcn.classList.add("active");
    const fullUrl = resolveUrl("shadcn", targetPathOrUrl || "/docs");
    loadSiteFrame(iframeShadcn, shadcnLoading, fullUrl);
  } else {
    viewDynamic?.classList.add("active");
    if (dynamicLoadingText) {
      dynamicLoadingText.textContent = `Loading ${brand.name} (${brand.version}) Documentation...`;
    }
    try {
      const port = await invoke<number>("ensure_site_server_cmd", { siteId: tab });
      if (port) sitePorts[tab] = port;
    } catch {}
    const defaultEntryPath =
      targetPathOrUrl ||
      (brand.defaultRoutes && brand.defaultRoutes.length > 0 ? brand.defaultRoutes[0].path : "/docs");
    const fullUrl = resolveUrl(tab, defaultEntryPath);
    if (iframeDynamic && dynamicLoading) {
      loadSiteFrame(iframeDynamic, dynamicLoading, fullUrl, true);
    }
  }

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

function loadSiteFrame(
  iframe: HTMLIFrameElement,
  loadingEl: HTMLElement,
  url: string,
  forceReload = false
) {
  const currentSrc = iframe.getAttribute("src") || "";
  if (forceReload || !currentSrc || currentSrc === "about:blank" || iframe.src !== url) {
    loadingEl.style.display = "flex";
    iframe.src = url;
    iframe.onload = () => {
      loadingEl.style.display = "none";
      syncReaderSettingsToAllIframes();
    };
  } else {
    syncReaderSettingsToAllIframes();
  }
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
          <span class="result-enter-hint">↵ Open</span>
        </div>
      `;
    })
    .join("");

  searchResultsList.querySelectorAll(".search-result-item").forEach((el) => {
    el.addEventListener("click", () => {
      const idx = parseInt(el.getAttribute("data-index") || "0", 10);
      selectResult(idx);
    });
  });

  const activeEl = searchResultsList.querySelector(".search-result-item.selected") as HTMLElement;
  if (activeEl) {
    activeEl.scrollIntoView({ block: "nearest" });
  }
}

function selectResult(index: number) {
  const item = currentResults[index];
  if (!item) return;

  closeSearchModal();
  switchTab(item.site, item.path);
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
  if (activeTab === "tailwind") return iframeTailwind;
  if (activeTab === "shadcn") return iframeShadcn;
  if (activeTab !== "home") return iframeDynamic;
  return null;
}

function setupEventListeners() {
  tabHome?.addEventListener("click", () => switchTab("home"));
  brandBtn?.addEventListener("click", () => switchTab("home"));

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
      banner.textContent = "Checking GitHub Releases (VahidM313/docx) for docpack updates...";
    }
    await syncAllPacksAndRender(true);
    if (banner) {
      banner.textContent = "✓ Synced live 42-Site Registry from GitHub Releases (packs-latest).";
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

  // Cross-iframe messages for Ctrl+K, Zoom, Dark Reader, Left-Edge Sidebar Hover, and Top-Edge Bar Reveal
  window.addEventListener("message", (e) => {
    if (!e.data || !e.data.type) return;
    if (e.data.type === "OPEN_UNIVERSAL_SEARCH") {
      if (searchModal.classList.contains("open")) {
        closeSearchModal();
      } else {
        openSearchModal();
      }
    } else if (e.data.type === "DOCX_IFRAME_READY") {
      syncReaderSettingsToAllIframes();
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
      invoke("window_toggle_fullscreen").catch(() => {});
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
      selectResult(selectedIndex);
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
    const iframe = getActiveIframe();
    if (iframe) {
      const current = iframe.src;
      if (current && current !== "about:blank") {
        iframe.src = "about:blank";
        setTimeout(() => {
          iframe.src = current;
        }, 50);
      }
    }
  });

  btnExternal?.addEventListener("click", () => {
    if (activeTab !== "home") {
      window.open(`${getOrigin(activeTab)}/docs`, "_blank");
    }
  });
}

init();
