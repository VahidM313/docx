import { invoke } from "@tauri-apps/api/core";

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
  ports: Record<string, number>;
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
let installedPacksCache: PackStatusInfo[] = [];

let serverStatus: ServerStatus = {
  tailwind: false,
  shadcn: false,
  tailwind_port: tailwindPort,
  shadcn_port: shadcnPort,
  ports: {},
};

// DOM Elements
const tabHome = document.getElementById("tabHome") as HTMLButtonElement;
const tabTailwind = document.getElementById("tabTailwind") as HTMLButtonElement;
const tabShadcn = document.getElementById("tabShadcn") as HTMLButtonElement;
const dynamicRailList = document.getElementById("dynamicRailList") as HTMLElement;
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
const btnToggleTopbar = document.getElementById("btnToggleTopbar") as HTMLButtonElement;
const btnRailToggleTopbar = document.getElementById("btnRailToggleTopbar") as HTMLButtonElement;
const topbarToggleLabel = document.getElementById("topbarToggleLabel") as HTMLElement;

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

const twPortLabel = document.getElementById("twPortLabel") as HTMLElement;
const shadcnPortLabel = document.getElementById("shadcnPortLabel") as HTMLElement;
const cardTwPort = document.getElementById("cardTwPort") as HTMLElement;
const cardShadcnPort = document.getElementById("cardShadcnPort") as HTMLElement;

const btnBack = document.getElementById("btnBack") as HTMLButtonElement;
const btnForward = document.getElementById("btnForward") as HTMLButtonElement;
const btnReload = document.getElementById("btnReload") as HTMLButtonElement;
const btnExternal = document.getElementById("btnExternal") as HTMLButtonElement;

async function init() {
  setupWindowControls();
  setupSidebarAndTopbarHover();
  setupEventListeners();
  await loadSearchIndex();
  await checkServerHealth();
  await refreshInstalledPacks();
  await loadCloudRegistry();
  setInterval(checkServerHealth, 3000);
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
  message: string;
}

function renderDynamicRail(packs: PackStatusInfo[]) {
  if (!dynamicRailList) return;
  const extraPacks = packs.filter((p) => p.id !== "tailwind" && p.id !== "shadcn");
  dynamicRailList.innerHTML = extraPacks
    .map((p) => {
      const shortBadge = p.id
        .replace(/^tanstack_/, "ts-")
        .slice(0, 4)
        .toUpperCase();
      const isActive = activeTab === p.id;
      return `
        <div class="rail-item ${isActive ? "active" : ""}" data-rail-site="${escapeHtml(p.id)}">
          <span class="rail-pill"></span>
          <button class="rail-btn" data-open-site="${escapeHtml(p.id)}" title="${escapeHtml(p.name)} (${escapeHtml(p.version)})">
            <span class="rail-text-badge">${escapeHtml(shortBadge)}</span>
          </button>
        </div>
      `;
    })
    .join("");

  dynamicRailList.querySelectorAll("[data-open-site]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const siteId = btn.getAttribute("data-open-site");
      if (siteId) switchTab(siteId);
    });
  });
}

async function refreshInstalledPacks() {
  const listEl = document.getElementById("installedPacksList");
  if (!listEl) return;
  try {
    const packs = await invoke<PackStatusInfo[]>("get_installed_packs");
    installedPacksCache = packs;
    for (const p of packs) {
      if (p.port) sitePorts[p.id] = p.port;
    }
    renderDynamicRail(packs);

    listEl.innerHTML = packs
      .map(
        (p) => `
      <div class="pack-row">
        <div class="pack-row-info">
          <div class="pack-row-title">
            <span>${escapeHtml(p.name)}</span>
            <span class="badge zinc">${escapeHtml(p.version)}</span>
            <span class="badge blue">${escapeHtml(p.source)}</span>
          </div>
          <div class="pack-meta-line">
            commit: ${escapeHtml(p.commit)} • ${p.chunk_count} hashed chunks (${p.route_count} routes) • ${p.size_mb} MB Max-Gzip • :${p.port}
          </div>
        </div>
        <div class="pack-row-actions">
          <button class="pack-open-btn" data-open-pack="${escapeHtml(p.id)}">
            Open Docs
          </button>
          <button class="pack-delta-btn" data-delta-site="${escapeHtml(p.id)}">
            ⚡ Delta Update (HTTP 206)
          </button>
        </div>
      </div>
    `
      )
      .join("");

    listEl.querySelectorAll("[data-open-pack]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const siteId = btn.getAttribute("data-open-pack");
        if (siteId) switchTab(siteId);
      });
    });

    listEl.querySelectorAll("[data-delta-site]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const siteId = btn.getAttribute("data-delta-site") || "tailwind";
        await runGitHubPackUpdate(siteId);
      });
    });

    await refreshExtraSearchEntries();
  } catch (err) {
    console.warn("Failed to load installed packs:", err);
  }
}

async function runGitHubPackUpdate(siteId: string) {
  const banner = document.getElementById("deltaStatusBanner");
  if (banner) {
    banner.style.display = "block";
    banner.textContent = `Running Content-Hash Diff & GitHub Releases HTTP 206 Partial Range Update for '${siteId}'...`;
  }
  try {
    const res = await invoke<DeltaUpdateResult>("install_or_update_from_github", { siteId });
    if (banner) {
      banner.textContent = `✓ [${res.site_id.toUpperCase()} ${res.old_commit} → ${res.new_commit}] ${res.message}`;
    }
    await refreshInstalledPacks();
    await loadCloudRegistry();
  } catch (err) {
    if (banner) {
      banner.textContent = `Update notice for ${siteId}: ${String(err)}`;
    }
  }
}

async function loadCloudRegistry() {
  const cloudEl = document.getElementById("cloudPacksList");
  if (!cloudEl) return;
  try {
    const items = await invoke<RemoteRegistryItem[]>("fetch_remote_registry");
    cloudEl.innerHTML = items
      .map((item) => {
        const sizeMb = (item.sizeBytes / (1024 * 1024)).toFixed(2);
        const upToDate = item.installed && item.local_commit === item.commit;
        const statusBadge = item.installed
          ? upToDate
            ? `<span class="badge blue">Installed (${escapeHtml(item.commit)})</span>`
            : `<span class="badge zinc">Update Available (${escapeHtml(item.local_commit)} → ${escapeHtml(item.commit)})</span>`
          : `<span class="badge zinc">Cloud Pack</span>`;

        return `
          <div class="pack-row">
            <div class="pack-row-info">
              <div class="pack-row-title">
                <span>${escapeHtml(item.name)}</span>
                <span class="badge zinc">${escapeHtml(item.version)}</span>
                ${statusBadge}
              </div>
              <div class="pack-meta-line">
                id: ${escapeHtml(item.id)} • commit: ${escapeHtml(item.commit)} • ${item.chunkCount} chunks (${item.routeCount} routes) • ${sizeMb} MB Max-Gzip
              </div>
            </div>
            <div class="pack-row-actions">
              ${
                item.installed
                  ? `<button class="pack-open-btn" data-cloud-open="${escapeHtml(item.id)}">Open Docs</button>`
                  : ""
              }
              <button class="pack-delta-btn" data-cloud-install="${escapeHtml(item.id)}">
                ${item.installed ? "⚡ Delta Update (HTTP 206)" : "⬇ Install Pack (HTTP 206)"}
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    cloudEl.querySelectorAll("[data-cloud-open]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const siteId = btn.getAttribute("data-cloud-open");
        if (siteId) switchTab(siteId);
      });
    });

    cloudEl.querySelectorAll("[data-cloud-install]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const siteId = btn.getAttribute("data-cloud-install");
        if (siteId) {
          await runGitHubPackUpdate(siteId);
        }
      });
    });
  } catch (err) {
    cloudEl.innerHTML = `<div class="pack-meta-line">Offline or unable to reach GitHub Releases registry: ${escapeHtml(String(err))}</div>`;
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

function updatePortLabels() {
  if (twPortLabel) twPortLabel.textContent = `TW :${tailwindPort}`;
  if (shadcnPortLabel) shadcnPortLabel.textContent = `UI :${shadcnPort}`;
  if (cardTwPort) cardTwPort.textContent = `127.0.0.1:${tailwindPort}`;
  if (cardShadcnPort) cardShadcnPort.textContent = `127.0.0.1:${shadcnPort}`;
}

// Tab / Server Switching
async function switchTab(tab: string, targetPathOrUrl?: string) {
  activeTab = tab;

  [tabHome, tabTailwind, tabShadcn].forEach((btn) => {
    btn.classList.remove("active");
    btn.parentElement?.classList.remove("active");
  });

  if (tab === "home" || tab === "tailwind" || tab === "shadcn") {
    const activeBtn = tab === "home" ? tabHome : tab === "tailwind" ? tabTailwind : tabShadcn;
    activeBtn.classList.add("active");
    activeBtn.parentElement?.classList.add("active");
  }

  document.querySelectorAll("[data-rail-site]").forEach((el) => {
    el.classList.toggle("active", el.getAttribute("data-rail-site") === tab);
  });

  document.querySelectorAll("[data-switch-tab]").forEach((el) => {
    el.classList.toggle("active", el.getAttribute("data-switch-tab") === tab);
  });

  const packInfo = installedPacksCache.find((p) => p.id === tab);
  if (titlebarCurrentView) {
    titlebarCurrentView.textContent =
      tab === "home"
        ? "Home Hub"
        : tab === "tailwind"
        ? "Tailwind CSS v4.3"
        : tab === "shadcn"
        ? "shadcn/ui v4"
        : packInfo
        ? `${packInfo.name} (${packInfo.version})`
        : tab.toUpperCase();
  }

  [viewHome, viewTailwind, viewShadcn, viewDynamic].forEach((view) => view?.classList.remove("active"));
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
    try {
      const port = await invoke<number>("ensure_site_server", { siteId: tab });
      sitePorts[tab] = port;
    } catch {}
    const fullUrl = resolveUrl(tab, targetPathOrUrl || "/docs");
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
    };
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
      const isTw = item.site === "tailwind";
      const isShadcn = item.site === "shadcn";
      const badgeClass = isTw ? "tw" : isShadcn ? "shadcn" : "extra";
      const badgeText = isTw ? "Tailwind" : isShadcn ? "shadcn" : item.site.slice(0, 8);

      return `
        <div class="search-result-item ${isSelected ? "selected" : ""}" data-index="${idx}">
          <span class="result-badge ${badgeClass}">${escapeHtml(badgeText)}</span>
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

async function checkServerHealth(): Promise<ServerStatus> {
  try {
    const status = await invoke<ServerStatus>("check_servers");
    serverStatus = status;
    tailwindPort = status.tailwind_port;
    shadcnPort = status.shadcn_port;
    if (status.ports) {
      sitePorts = { ...sitePorts, ...status.ports };
    }
    updatePortLabels();
    return status;
  } catch {
    updatePortLabels();
    return serverStatus;
  }
}

function getActiveIframe(): HTMLIFrameElement | null {
  if (activeTab === "tailwind") return iframeTailwind;
  if (activeTab === "shadcn") return iframeShadcn;
  if (activeTab !== "home") return iframeDynamic;
  return null;
}

function setupEventListeners() {
  tabHome.addEventListener("click", () => switchTab("home"));
  tabTailwind.addEventListener("click", () => switchTab("tailwind"));
  tabShadcn.addEventListener("click", () => switchTab("shadcn"));
  brandBtn?.addEventListener("click", () => switchTab("home"));

  document.querySelectorAll("[data-switch-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-switch-tab");
      if (target) switchTab(target);
    });
  });

  document.getElementById("launchTailwindBtn")?.addEventListener("click", () => {
    switchTab("tailwind");
  });
  document.getElementById("launchShadcnBtn")?.addEventListener("click", () => {
    switchTab("shadcn");
  });

  document.getElementById("btnRefreshRegistry")?.addEventListener("click", async () => {
    const banner = document.getElementById("deltaStatusBanner");
    if (banner) {
      banner.style.display = "block";
      banner.textContent = "Fetching live 40+ site registry.json from GitHub Releases (VahidM313/docx)...";
    }
    await loadCloudRegistry();
    if (banner) {
      banner.textContent = "✓ Synced live Cloud Registry from GitHub Releases (packs-latest).";
    }
  });

  document.getElementById("btnBundleSingleExe")?.addEventListener("click", async () => {
    const banner = document.getElementById("deltaStatusBanner");
    if (banner) {
      banner.style.display = "block";
      banner.textContent = "Bundling all active .docpack chunks into standalone Desktop\\Docx.exe via DOCXPACK trailer...";
    }
    try {
      const msg = await invoke<string>("bundle_into_single_exe");
      if (banner) {
        banner.textContent = `✓ ${msg}`;
      }
      await refreshInstalledPacks();
    } catch (err) {
      if (banner) {
        banner.textContent = `Bundle error: ${String(err)}`;
      }
    }
  });

  document.querySelectorAll(".link-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const target = pill.getAttribute("data-target") || "tailwind";
      const relUrl = pill.getAttribute("data-url") || "/docs";
      switchTab(target, relUrl);
    });
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

  // Cross-iframe messages for Ctrl+K, Left-Edge Sidebar Hover, and Top-Edge Bar Reveal
  window.addEventListener("message", (e) => {
    if (!e.data || !e.data.type) return;
    if (e.data.type === "OPEN_UNIVERSAL_SEARCH") {
      if (searchModal.classList.contains("open")) {
        closeSearchModal();
      } else {
        openSearchModal();
      }
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
