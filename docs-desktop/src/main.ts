import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { SITE_BRANDS, getSiteBrand } from "./brands";

interface SearchEntry {
  id?: string;
  site: string;
  siteName?: string;
  title: string;
  category: string;
  description?: string;
  preview?: string;
  path: string;
  url?: string;
  keywords?: string[];
  headings?: string[];
}

const SITE_ENTRY_PATHS: Record<string, string> = {
  tailwind: "/docs/installation/using-vite",
  shadcn: "/docs",
  react: "/learn",
  nextjs: "/docs",
  vite: "/guide/",
  astro: "/en/getting-started/",
  mdn_js: "/en-US/docs/Web/JavaScript",
  htmx: "/docs/",
  typescript: "/docs/handbook/intro.html",
  bun: "/docs",
  elysia: "/table-of-content",
  drizzle: "/docs/overview",
  oxc: "/docs/guide/introduction.html",
  rust: "/book/",
  go: "/doc/",
  cppreference: "/",
  learncpp: "/",
  llvm: "/docs/",
  lua: "/manual/5.4/",
  docker: "/get-started/",
  git: "/docs/git",
  curl: "/docs/",
  cmake: "/cmake/help/latest/index.html",
  ninja: "/manual.html",
  powershell: "/en-us/powershell/scripting/overview",
  cmd: "/en-us/windows-server/administration/windows-commands/windows-commands",
  tanstack_query: "/query/latest/docs/framework/react/overview",
  tanstack_router: "/router/latest/docs/overview",
  tanstack_start: "/start/latest/docs/framework/react/overview",
  tanstack_table: "/table/latest/docs/overview",
  tanstack_form: "/form/latest/docs/overview",
  tanstack_virtual: "/virtual/latest/docs/introduction",
  tanstack_store: "/store/latest/docs/overview",
  tanstack_db: "/db/latest/docs/overview",
  tanstack_ai: "/ai/latest/docs/getting-started/overview",
  tanstack_pacer: "/pacer/latest/docs/overview",
  tanstack_ranger: "/ranger/latest/docs/overview",
  tanstack_config: "/config/latest/docs/overview",
  tanstack_devtools: "/devtools/latest/docs/overview",
  tanstack_hotkeys: "/hotkeys/latest/docs/overview",
  tanstack_react_charts: "/docs/overview",
  tanstack_create_tsrouter_app: "/router/latest/docs/quick-start",
  python: "/3/",
  threejs: "/docs/",
  motion: "/docs",
  vue: "/guide/introduction.html",
  nuxt: "/docs/4.x/getting-started/introduction",
  angular: "/docs",
  hono: "/docs/",
  express: "/",
  nestjs: "/",
  qt: "/",
  boost: "/doc/libs/latest/libs/libraries.htm",
  django: "/en/6.1/",
  fastapi: "/",
  postgresql: "/docs/",
  sqlite: "/docs.html",
};

const DEFAULT_PACK_SIZES_MB: Record<string, number> = {
  tailwind: 13.6,
  shadcn: 31.78,
  react: 11.69,
  nextjs: 24.6,
  vite: 0.9,
  astro: 7.17,
  mdn_js: 5.74,
  htmx: 0.21,
  typescript: 12.35,
  bun: 4.63,
  elysia: 2.77,
  drizzle: 9.94,
  oxc: 1.24,
  rust: 4.34,
  go: 2.93,
  cppreference: 8.13,
  learncpp: 11.57,
  llvm: 1.44,
  lua: 0.44,
  docker: 2.73,
  git: 3.58,
  curl: 3.26,
  cmake: 1.68,
  ninja: 0.27,
  powershell: 3.66,
  cmd: 2.65,
  tanstack_query: 8.24,
  tanstack_router: 5.5,
  tanstack_start: 4.29,
  tanstack_table: 1.75,
  tanstack_form: 4.46,
  tanstack_virtual: 1.59,
  tanstack_store: 2.63,
  tanstack_db: 4.45,
  tanstack_ai: 1.42,
  tanstack_pacer: 5.04,
  tanstack_ranger: 1.28,
  tanstack_config: 1.04,
  tanstack_devtools: 2.15,
  tanstack_hotkeys: 3.47,
  tanstack_react_charts: 0.82,
  tanstack_create_tsrouter_app: 1.97,
  python: 4.65,
  threejs: 0.69,
  motion: 4.43,
  vue: 3.49,
  nuxt: 8.98,
  angular: 1.37,
  hono: 5.71,
  express: 3.4,
  nestjs: 1.3,
  qt: 5.14,
  boost: 6.61,
  django: 3.75,
  fastapi: 12.33,
  postgresql: 1.6,
  sqlite: 2.75,
};

function getDefaultEntryPath(siteId: string): string {
  const brand = getSiteBrand(siteId);
  if (brand.defaultRoutes && brand.defaultRoutes.length > 0 && brand.defaultRoutes[0].path) {
    return brand.defaultRoutes[0].path;
  }
  return SITE_ENTRY_PATHS[siteId] || "/docs";
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
let bundledExtraSearchIndex: SearchEntry[] = [];
let searchIndex: SearchEntry[] = [];
let activeTab: string = "home";
let currentFilter: string = "all";
let currentResults: SearchEntry[] = [];
let selectedIndex = 0;

let sidebarPinned = false;
let drawerHidden = localStorage.getItem("docx_drawer_hidden") !== "false";
let topbarHidden = false;
let sidebarCloseTimer: number | null = null;
let drawerHoverCloseTimer: number | null = null;
let topbarCloseTimer: number | null = null;

// User-toggleable features (Browser Tabs, Expand Tabs on Hover, Theme Engine, Default Clean Font)
let featureTabsEnabled = localStorage.getItem("docx_feature_tabs") !== "0";
let featureTabHoverExpand = localStorage.getItem("docx_feature_tab_hover_expand") !== "0";
let featureThemeEnabled = localStorage.getItem("docx_feature_theme") !== "0";
let featureFontEnabled = localStorage.getItem("docx_feature_font") !== "0";

let readerZoom = Math.max(
  60,
  Math.min(220, parseInt(localStorage.getItem("docx_reader_zoom") || "100", 10) || 100)
);
let systemDarkMode =
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : true;
let readerDarkMode: boolean = (() => {
  try {
    const saved = localStorage.getItem("docx_reader_dark_v3");
    if (saved === "1") return true;
    if (saved === "0") return false;
  } catch {}
  return systemDarkMode;
})();
let readerDarkBySite: Record<string, boolean> = (() => {
  try {
    const raw = localStorage.getItem("docx_reader_dark_by_site_v3");
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

const DEFAULT_PINNED_DOCS = ["tailwind", "shadcn", "react", "nextjs", "typescript", "rust", "python"];
let pinnedSiteIds: string[] = (() => {
  try {
    const raw = localStorage.getItem("docx_pinned_docs_v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "string");
    }
  } catch {}
  return [...DEFAULT_PINNED_DOCS];
})();
let drawerFilterQuery: string = "";
let rightTabsCompact: boolean = (() => {
  try {
    return localStorage.getItem("docx_right_tabs_compact") !== "false";
  } catch {
    return true;
  }
})();

let suppressPinClickUntil = 0;

interface DocBookmark {
  id: string;
  siteId: string;
  title: string;
  pathOrUrl: string;
  createdAt: number;
}

let bookmarksList: DocBookmark[] = (() => {
  try {
    const raw = localStorage.getItem("docx_bookmarks_v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (b) => b && typeof b.siteId === "string" && typeof b.pathOrUrl === "string"
        );
      }
    }
  } catch {}
  return [];
})();
let bookmarksFilterQuery: string = "";

function isSpecialNativeView(siteId: string): boolean {
  return siteId === "home" || siteId === "bookmarks";
}

function saveBookmarks() {
  try {
    localStorage.setItem("docx_bookmarks_v1", JSON.stringify(bookmarksList));
  } catch {}
}

function normalizeBookmarkPath(siteId: string, pathOrUrl?: string): string {
  const raw = (pathOrUrl || getDefaultEntryPath(siteId) || "/").trim();
  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      const u = new URL(raw);
      return `${u.pathname}${u.search}${u.hash}` || "/";
    }
  } catch {}
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function normalizeBookmarkCompareKey(siteId: string, pathOrUrl?: string): string {
  const norm = normalizeBookmarkPath(siteId, pathOrUrl)
    .replace(/\/index\.(html|htm)$/i, "")
    .replace(/\.(html|htm)$/i, "")
    .replace(/^\/w\//i, "/")
    .replace(/\/+$/, "");
  return `${siteId}::${norm || "/"}`.toLowerCase();
}

function formatBookmarkDisplayInfo(
  siteId: string,
  rawTitle: string,
  pathOrUrl: string
): { topicTitle: string; breadcrumb: string; cleanDocName: string } {
  const brand = getSiteBrand(siteId);
  const cleanDocName = brand.name.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const cleanPath = normalizeBookmarkPath(siteId, pathOrUrl)
    .replace(/\.(html|htm)$/i, "")
    .replace(/\/index$/i, "")
    .replace(/^\/(w|docs|guide|en\/[\d.]+)\//i, "/");
  const segments = cleanPath.split("/").filter(Boolean);
  const breadcrumb = segments.length > 0 ? segments.join(" › ") : "Documentation Home";
  const lastSeg = segments[segments.length - 1] || "";

  let candidate = (rawTitle || "").trim();
  if (candidate.includes(" · ")) {
    candidate = candidate.split(" · ").slice(1).join(" · ").trim();
  }
  candidate = candidate
    .replace(/\s*[-–—|]\s*(cppreference\.com|C\+\+\s*Reference.*|Rust.*|MDN.*|Docs|Documentation).*$/i, "")
    .trim();

  if (
    !candidate ||
    candidate.toLowerCase() === brand.name.toLowerCase() ||
    candidate.toLowerCase() === cleanDocName.toLowerCase()
  ) {
    if (lastSeg) {
      if (siteId === "cppreference" && segments.includes("cpp") && lastSeg !== "cpp") {
        candidate = `std::${lastSeg}`;
      } else {
        candidate = lastSeg.replace(/[-_]+/g, " ");
      }
    } else {
      candidate = `${cleanDocName} Overview`;
    }
  }

  return {
    topicTitle: candidate,
    breadcrumb,
    cleanDocName,
  };
}

function getLiveActiveTabDocState(): { siteId: string; pathOrUrl: string; title: string } | null {
  const cur = getActiveBrowserTab();
  if (!cur || isSpecialNativeView(cur.siteId)) return null;
  const pathOrUrl = normalizeBookmarkPath(cur.siteId, cur.pathOrUrl || getDefaultEntryPath(cur.siteId));
  const title = cur.title || formatTabTitle(cur.siteId, undefined, pathOrUrl);
  return {
    siteId: cur.siteId,
    pathOrUrl,
    title,
  };
}

function findBookmarkForCurrentPage(): DocBookmark | undefined {
  const live = getLiveActiveTabDocState();
  if (!live) return undefined;
  const targetKey = normalizeBookmarkCompareKey(live.siteId, live.pathOrUrl);
  return bookmarksList.find(
    (b) => normalizeBookmarkCompareKey(b.siteId, b.pathOrUrl) === targetKey
  );
}

function updateBookmarkUI() {
  if (railBookmarkCount) {
    if (bookmarksList.length > 0) {
      railBookmarkCount.style.display = "inline-flex";
      railBookmarkCount.textContent = String(bookmarksList.length);
    } else {
      railBookmarkCount.style.display = "none";
    }
  }

  const live = getLiveActiveTabDocState();
  const existing = findBookmarkForCurrentPage();
  const isBookmarked = Boolean(existing);

  const railBookmarksWrap = document.getElementById("railBookmarksWrap");
  if (railBookmarksWrap) {
    railBookmarksWrap.classList.toggle("active", activeTab === "bookmarks");
    tabBookmarks?.classList.toggle("active", activeTab === "bookmarks");
    tabBookmarks?.classList.toggle("page-bookmarked", isBookmarked);
  }

  if (btnBookmarkPage) {
    btnBookmarkPage.classList.toggle("bookmarked", isBookmarked);
    btnBookmarkPage.classList.toggle("active", isBookmarked);
    if (bookmarkTopbarLabel) {
      bookmarkTopbarLabel.textContent = isBookmarked ? "Bookmarked" : "Bookmark";
    }
    if (!live) {
      btnBookmarkPage.title = "Open Saved Bookmarks (or open any documentation page to bookmark it)";
    } else if (existing) {
      btnBookmarkPage.title = `★ Bookmarked: ${existing.title} (${existing.pathOrUrl}) — Click or press Ctrl+D to remove`;
    } else {
      btnBookmarkPage.title = `Bookmark "${live.title}" (${live.pathOrUrl}) — Click or press Ctrl+D`;
    }
  }
}

function toggleBookmarkCurrentPage() {
  const live = getLiveActiveTabDocState();
  if (!live) {
    switchTab("bookmarks");
    return;
  }
  const existing = findBookmarkForCurrentPage();
  if (existing) {
    bookmarksList = bookmarksList.filter((b) => b.id !== existing.id);
  } else {
    bookmarksList.unshift({
      id: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      siteId: live.siteId,
      title: live.title,
      pathOrUrl: live.pathOrUrl,
      createdAt: Date.now(),
    });
  }
  saveBookmarks();
  updateBookmarkUI();
  renderBookmarksView();
  renderBrowserTabs();
}

function removeBookmarkById(id: string) {
  bookmarksList = bookmarksList.filter((b) => b.id !== id);
  saveBookmarks();
  updateBookmarkUI();
  renderBookmarksView();
  renderBrowserTabs();
}

function renderBookmarksView() {
  if (!bookmarksGrid) return;
  if (bookmarksTotalStat) {
    bookmarksTotalStat.textContent = `${bookmarksList.length} Saved Page${
      bookmarksList.length === 1 ? "" : "s"
    }`;
  }

  const q = bookmarksFilterQuery.trim().toLowerCase();
  const filtered = q
    ? bookmarksList.filter((b) => {
        const brand = getSiteBrand(b.siteId);
        const info = formatBookmarkDisplayInfo(b.siteId, b.title, b.pathOrUrl);
        return (
          b.title.toLowerCase().includes(q) ||
          info.topicTitle.toLowerCase().includes(q) ||
          b.siteId.toLowerCase().includes(q) ||
          brand.name.toLowerCase().includes(q) ||
          b.pathOrUrl.toLowerCase().includes(q)
        );
      })
    : bookmarksList;

  if (bookmarksList.length === 0) {
    bookmarksGrid.innerHTML = `
      <div class="bookmarks-empty-state">
        <div class="bookmarks-empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
        <div class="bookmarks-empty-title">No Bookmarked Pages Yet</div>
        <div class="bookmarks-empty-sub">
          Open any documentation page and click the <strong>Bookmark</strong> button in the top bar (or press <kbd class="bookmarks-kbd">Ctrl+D</kbd>) to save it here for instant offline access.
        </div>
      </div>
    `;
    return;
  }

  if (filtered.length === 0) {
    bookmarksGrid.innerHTML = `
      <div class="bookmarks-empty-state">
        <div class="bookmarks-empty-title">No matching bookmarks for "${escapeHtml(
          bookmarksFilterQuery
        )}"</div>
        <div class="bookmarks-empty-sub">Try searching by documentation name, topic title, or URL path.</div>
      </div>
    `;
    return;
  }

  bookmarksGrid.innerHTML = filtered
    .map((bm) => {
      const brand = getSiteBrand(bm.siteId);
      const info = formatBookmarkDisplayInfo(bm.siteId, bm.title, bm.pathOrUrl);
      const dateStr = new Date(bm.createdAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      return `
        <div
          class="bookmark-card"
          data-bm-id="${escapeHtml(bm.id)}"
          data-bm-site="${escapeHtml(bm.siteId)}"
          data-bm-path="${escapeHtml(bm.pathOrUrl)}"
          style="--bm-color: ${brand.color}; --bm-tint: ${brand.bgTint};"
          title="Click to open ${escapeHtml(info.topicTitle)} in ${escapeHtml(info.cleanDocName)} (${escapeHtml(
        bm.pathOrUrl
      )})"
        >
          <div class="bookmark-card-top">
            <div class="bookmark-card-brand">
              <span class="bookmark-card-icon">${brand.svg || escapeHtml(brand.badge)}</span>
              <div class="bookmark-card-brand-meta">
                <span class="bookmark-card-docname">${escapeHtml(info.cleanDocName)}</span>
                <span class="bookmark-card-version">${escapeHtml(brand.version)}</span>
              </div>
            </div>
            <div class="bookmark-card-actions">
              <button
                class="bookmark-action-btn"
                data-open-bm-newtab="${escapeHtml(bm.id)}"
                title="Open in New Tab (Ctrl+Click)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </button>
              <button
                class="bookmark-action-btn remove-btn"
                data-remove-bookmark="${escapeHtml(bm.id)}"
                title="Remove Bookmark"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                  <path d="M10 11v6"></path>
                  <path d="M14 11v6"></path>
                </svg>
              </button>
            </div>
          </div>
          <div class="bookmark-card-body">
            <div class="bookmark-card-title">${escapeHtml(info.topicTitle)}</div>
            <div class="bookmark-card-breadcrumb">${escapeHtml(info.breadcrumb)}</div>
          </div>
          <div class="bookmark-card-footer">
            <span class="bookmark-card-path">${escapeHtml(bm.pathOrUrl)}</span>
            <span class="bookmark-card-date">${escapeHtml(dateStr)}</span>
          </div>
        </div>
      `;
    })
    .join("");

  bookmarksGrid.querySelectorAll(".bookmark-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest("[data-remove-bookmark], [data-open-bm-newtab]")) return;
      const me = e as MouseEvent;
      const siteId = card.getAttribute("data-bm-site");
      const pathOrUrl = card.getAttribute("data-bm-path") || undefined;
      if (siteId) {
        switchTab(siteId, pathOrUrl, me.ctrlKey || me.metaKey);
      }
    });
    card.addEventListener("auxclick", (e) => {
      const me = e as MouseEvent;
      if (me.button === 1) {
        me.preventDefault();
        const siteId = card.getAttribute("data-bm-site");
        const pathOrUrl = card.getAttribute("data-bm-path") || undefined;
        if (siteId) {
          switchTab(siteId, pathOrUrl, true);
        }
      }
    });
  });

  bookmarksGrid.querySelectorAll("[data-open-bm-newtab]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const bmId = btn.getAttribute("data-open-bm-newtab");
      const bm = bookmarksList.find((x) => x.id === bmId);
      if (bm) {
        switchTab(bm.siteId, bm.pathOrUrl, true);
      }
    });
  });

  bookmarksGrid.querySelectorAll("[data-remove-bookmark]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const bmId = btn.getAttribute("data-remove-bookmark");
      if (bmId) {
        removeBookmarkById(bmId);
      }
    });
  });
}

function isDocPinned(siteId: string): boolean {
  return pinnedSiteIds.includes(siteId);
}

function savePinnedSitesAndRender() {
  try {
    localStorage.setItem("docx_pinned_docs_v1", JSON.stringify(pinnedSiteIds));
  } catch {}
  const sites = buildUnifiedSitesList();
  renderServerRail(sites);
  renderChannelDrawer(sites);
  renderHomeHub(sites);
}

function togglePinDoc(siteId: string) {
  if (!siteId || isSpecialNativeView(siteId)) return;
  if (pinnedSiteIds.includes(siteId)) {
    pinnedSiteIds = pinnedSiteIds.filter((id) => id !== siteId);
  } else {
    pinnedSiteIds = [...pinnedSiteIds, siteId];
  }
  savePinnedSitesAndRender();
}

function attachPointerPinnedSort(
  container: HTMLElement,
  itemSelector: string,
  attrName: string,
  ignoreSelector: string,
  siteMap: Map<string, UnifiedSiteEntry>
) {
  container.querySelectorAll(itemSelector).forEach((node) => {
    const el = node as HTMLElement;
    const siteId = el.getAttribute(attrName);
    if (!siteId) return;

    el.addEventListener("pointerdown", (e: PointerEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (target && ignoreSelector && target.closest(ignoreSelector)) return;

      const startX = e.clientX;
      const startY = e.clientY;
      let isDragging = false;
      let ghostEl: HTMLElement | null = null;
      const siteInfo = siteMap.get(siteId);

      const onPointerMove = (ev: PointerEvent) => {
        if (!isDragging) {
          if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
          isDragging = true;
          suppressPinClickUntil = Date.now() + 260;
          el.classList.add("dragging");

          ghostEl = document.createElement("div");
          ghostEl.className = "pin-drag-ghost";
          if (siteInfo) {
            ghostEl.style.setProperty("--brand-color", siteInfo.color);
            ghostEl.style.setProperty("--brand-tint", siteInfo.bgTint);
            ghostEl.innerHTML = `${siteInfo.svg}<span>${escapeHtml(siteInfo.name)}</span>`;
          } else {
            ghostEl.textContent = siteId;
          }
          document.body.appendChild(ghostEl);
        }

        if (ghostEl) {
          ghostEl.style.left = `${ev.clientX}px`;
          ghostEl.style.top = `${ev.clientY}px`;
        }

        const otherItems = Array.from(container.querySelectorAll(itemSelector)).filter(
          (n) => n !== el
        ) as HTMLElement[];
        if (otherItems.length === 0) return;

        const insertBeforeTarget = otherItems.find((other) => {
          const rect = other.getBoundingClientRect();
          return ev.clientY < rect.top + rect.height / 2;
        });

        const parent = el.parentElement;
        if (!parent) return;

        if (insertBeforeTarget) {
          if (el.nextElementSibling !== insertBeforeTarget) {
            parent.insertBefore(el, insertBeforeTarget);
          }
        } else {
          const lastOther = otherItems[otherItems.length - 1];
          if (lastOther && lastOther.nextElementSibling !== el) {
            parent.insertBefore(el, lastOther.nextElementSibling);
          }
        }
      };

      const onPointerUp = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);

        if (ghostEl) {
          ghostEl.remove();
          ghostEl = null;
        }
        el.classList.remove("dragging");

        if (isDragging) {
          suppressPinClickUntil = Date.now() + 180;
          const newOrder = Array.from(container.querySelectorAll(itemSelector))
            .map((n) => n.getAttribute(attrName) || "")
            .filter(Boolean);
          if (newOrder.length > 0) {
            pinnedSiteIds = newOrder;
            savePinnedSitesAndRender();
          }
        }
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    });
  });
}

let installedPacksCache: PackStatusInfo[] = [];
let remoteRegistryCache: RemoteRegistryItem[] = [];
let selectedHubCategory: string = "all";
let hubSearchQuery: string = "";
const activeDownloads = new Map<string, DownloadProgressPayload>();
let hudHideTimer: number | null = null;

// DOM Elements
const tabHome = document.getElementById("tabHome") as HTMLButtonElement;
const tabBookmarks = document.getElementById("tabBookmarks") as HTMLButtonElement;
const railBookmarkCount = document.getElementById("railBookmarkCount") as HTMLElement;
const btnBookmarkPage = document.getElementById("btnBookmarkPage") as HTMLButtonElement;
const bookmarkTopbarLabel = document.getElementById("bookmarkTopbarLabel") as HTMLElement;
const viewBookmarks = document.getElementById("viewBookmarks") as HTMLElement;
const bookmarksTotalStat = document.getElementById("bookmarksTotalStat") as HTMLElement;
const bookmarksFilterInput = document.getElementById("bookmarksFilterInput") as HTMLInputElement;
const bookmarksGrid = document.getElementById("bookmarksGrid") as HTMLElement;

const installedRailList = document.getElementById("installedRailList") as HTMLElement;
const drawerChannelsScroll = document.getElementById("drawerChannelsScroll") as HTMLElement;
const drawerFilterInput = document.getElementById("drawerFilterInput") as HTMLInputElement;
const brandBtn = document.getElementById("brandBtn") as HTMLElement;
const titlebarBrandHome = document.getElementById("titlebarBrandHome") as HTMLElement;
const rightTabsSidebar = document.getElementById("rightTabsSidebar") as HTMLElement;
const rightTabsCount = document.getElementById("rightTabsCount") as HTMLElement;
const btnToggleRightTabs = document.getElementById("btnToggleRightTabs") as HTMLButtonElement;
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

const btnFeaturesMenu = document.getElementById("btnFeaturesMenu") as HTMLButtonElement;
const featuresPopover = document.getElementById("featuresPopover") as HTMLElement;
const toggleFeatureTabs = document.getElementById("toggleFeatureTabs") as HTMLInputElement;
const toggleFeatureTabHover = document.getElementById("toggleFeatureTabHover") as HTMLInputElement;
const toggleFeatureTheme = document.getElementById("toggleFeatureTheme") as HTMLInputElement;
const toggleFeatureFont = document.getElementById("toggleFeatureFont") as HTMLInputElement;

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
const searchFiltersBar = document.getElementById("searchFiltersBar") as HTMLElement;

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
  await setupSystemThemeSync();
  applyFeatureFlags();

  updateSplash(52, "Mounting Embedded & Local .docpack Archives...");
  await checkServerHealth();
  try {
    installedPacksCache = await invoke<PackStatusInfo[]>("get_installed_packs");
    for (const p of installedPacksCache) {
      if (p.port) sitePorts[p.id] = p.port;
    }
  } catch {}

  updateSplash(78, "Loading Universal Search Index across all installed docs...");
  await loadSearchIndex();
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

async function setupSystemThemeSync() {
  const applyNewSystemTheme = (isDark: boolean) => {
    systemDarkMode = isDark;
    try {
      localStorage.setItem("docx_system_dark", isDark ? "1" : "0");
      if (localStorage.getItem("docx_reader_dark_v3") === null) {
        readerDarkMode = isDark;
      }
    } catch {
      readerDarkMode = isDark;
    }
    syncReaderSettingsToAllIframes();
  };

  try {
    const sysTheme = await invoke<string>("get_system_theme");
    if (sysTheme === "light" || sysTheme === "dark") {
      applyNewSystemTheme(sysTheme === "dark");
    }
  } catch {
    if (typeof window !== "undefined" && window.matchMedia) {
      applyNewSystemTheme(window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
  }

  if (typeof window !== "undefined" && window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener?.("change", (ev) => {
      applyNewSystemTheme(ev.matches);
    });
  }

  listen<string>("tauri://theme-changed", (event) => {
    const t = String(event.payload || "").toLowerCase();
    if (t === "dark" || t === "light") {
      applyNewSystemTheme(t === "dark");
    }
  }).catch(() => {});
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
      localStorage.setItem("docx_reader_dark_v3", readerDarkMode ? "1" : "0");
    } catch {}
  } else {
    readerDarkBySite[siteId] = dark;
    try {
      localStorage.setItem("docx_reader_dark_by_site_v3", JSON.stringify(readerDarkBySite));
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
    btnToggleDarkSite.classList.toggle("active", featureThemeEnabled && activeDark);
  }
  if (darkSiteIcon) {
    darkSiteIcon.textContent = !featureThemeEnabled ? "🎨" : activeDark ? "🌙" : "☀️";
  }
  if (darkSiteLabel) {
    darkSiteLabel.textContent = !featureThemeEnabled ? "Native" : activeDark ? "Dark" : "Light";
  }
}

function applyFeatureFlags() {
  if (toggleFeatureTabs) toggleFeatureTabs.checked = featureTabsEnabled;
  if (toggleFeatureTabHover) toggleFeatureTabHover.checked = featureTabHoverExpand;
  if (toggleFeatureTheme) toggleFeatureTheme.checked = featureThemeEnabled;
  if (toggleFeatureFont) toggleFeatureFont.checked = featureFontEnabled;

  document.body.classList.toggle("tabs-feature-off", !featureTabsEnabled);
  document.body.classList.toggle("tabs-hover-expand-off", !featureTabHoverExpand);
  document.body.classList.toggle("right-tabs-pinned-open", featureTabsEnabled && !rightTabsCompact);
  document.body.classList.toggle("theme-feature-off", !featureThemeEnabled);
  document.body.classList.toggle("font-feature-off", !featureFontEnabled);

  if (!featureTabHoverExpand && rightTabsSidebar) {
    rightTabsSidebar.classList.remove("hover-open");
  }

  try {
    localStorage.setItem("docx_feature_tabs", featureTabsEnabled ? "1" : "0");
    localStorage.setItem("docx_feature_tab_hover_expand", featureTabHoverExpand ? "1" : "0");
    localStorage.setItem("docx_feature_theme", featureThemeEnabled ? "1" : "0");
    localStorage.setItem("docx_feature_font", featureFontEnabled ? "1" : "0");
    localStorage.setItem("docx_theme_enabled", featureThemeEnabled ? "1" : "0");
    localStorage.setItem("docx_font_enabled", featureFontEnabled ? "1" : "0");
  } catch {}

  // When Browser Tabs feature is turned OFF, collapse any background doc tabs to free WebView RAM
  if (!featureTabsEnabled && browserTabs.length > 1) {
    const active = getActiveBrowserTab();
    const toRemove = browserTabs.filter((t) => t.id !== active.id);
    for (const r of toRemove) {
      if (r.loadingTimer) window.clearTimeout(r.loadingTimer);
      if (r.panelEl) r.panelEl.remove();
    }
    browserTabs = [active];
    activeBrowserTabId = active.id;
    renderBrowserTabs();
  }

  syncReaderSettingsToAllIframes();
}

function setReaderZoom(nextZoom: number) {
  readerZoom = Math.max(60, Math.min(220, Math.round(nextZoom / 5) * 5));
  try {
    localStorage.setItem("docx_reader_zoom", String(readerZoom));
  } catch {}
  syncReaderSettingsToAllIframes();
}

function toggleReaderDarkMode() {
  if (!featureThemeEnabled) {
    featureThemeEnabled = true;
    applyFeatureFlags();
  }
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
          systemDark: systemDarkMode,
          themeEnabled: featureThemeEnabled,
          fontEnabled: featureFontEnabled,
          customFontEnabled: featureFontEnabled,
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

  const isDone =
    pct >= 100 &&
    (p.phase.toLowerCase().includes("complete") || p.phase.toLowerCase().includes("up to date"));
  if (isDone) {
    activeDownloads.delete(p.site_id);
  }

  const activeList = Array.from(activeDownloads.values());
  if (activeList.length > 1) {
    const avgPct = Math.round(
      activeList.reduce((acc, item) => acc + Math.max(0, Math.min(100, item.percent || 0)), 0) /
        activeList.length
    );
    const activeNames = activeList
      .slice(0, 4)
      .map((item) => `${getSiteBrand(item.site_id).name} (${Math.round(item.percent || 0)}%)`)
      .join(" • ");
    const moreSuffix = activeList.length > 4 ? ` +${activeList.length - 4} more` : "";
    if (dlHudTitle) {
      dlHudTitle.textContent = `⚡ Downloading ${activeList.length} Docs in Parallel`;
    }
    if (dlHudPhase) {
      dlHudPhase.textContent = `${avgPct}%`;
    }
    if (dlHudDetail) {
      dlHudDetail.textContent = `${activeNames}${moreSuffix}`;
    }
    if (dlProgressBar) {
      dlProgressBar.style.width = `${avgPct}%`;
    }
  } else {
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
  }

  if (activeDownloads.size === 0) {
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
    if (p.route_count > 0 && SITE_BRANDS[p.id]) {
      installedMap.set(p.id, p);
    }
  }

  const remoteMap = new Map<string, RemoteRegistryItem>();
  for (const r of remoteRegistryCache) {
    if (SITE_BRANDS[r.id]) {
      remoteMap.set(r.id, r);
    }
  }

  const allIds = Object.keys(SITE_BRANDS);

  const list: UnifiedSiteEntry[] = [];
  for (const id of allIds) {
    const brand = getSiteBrand(id, remoteMap.get(id)?.name || installedMap.get(id)?.name);
    const inst = installedMap.get(id);
    const rem = remoteMap.get(id);

    const installed = Boolean(inst) || Boolean(rem?.installed);
    const localCommit = inst?.commit || rem?.local_commit || "";
    const remoteCommit = rem?.commit || inst?.commit || "latest";
    const updateAvailable =
      installed &&
      Boolean(rem?.update_available) &&
      Boolean(localCommit) &&
      Boolean(rem?.commit) &&
      rem!.commit !== "e3b0c442" &&
      localCommit !== rem!.commit;

    const routeCount = inst?.route_count || rem?.routeCount || 25;
    const chunkCount = inst?.chunk_count || rem?.chunkCount || 25;
    const fallbackMb = DEFAULT_PACK_SIZES_MB[id] || 1.5;
    const sizeMbNum =
      inst && inst.size_mb > 0
        ? inst.size_mb
        : rem && rem.sizeBytes > 0
        ? rem.sizeBytes / (1024 * 1024)
        : fallbackMb;
    const sizeMb = sizeMbNum.toFixed(2);

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
  renderBookmarksView();
  updateBookmarkUI();
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

// 2. Render Column 1: Main Icon Rail = Pinned Docs (Drag-and-Drop Reorderable) + Any Currently Open Unpinned Docs
function renderServerRail(sites: UnifiedSiteEntry[]) {
  if (!installedRailList) return;
  const siteMap = new Map(sites.map((s) => [s.id, s]));
  const pinnedSites = pinnedSiteIds
    .map((id) => siteMap.get(id))
    .filter((s): s is UnifiedSiteEntry => Boolean(s));

  // Collect any open docs (from browserTabs or activeTab) that are NOT pinned so they also show on the main sidebar with selected effect
  const openUnpinnedIds: string[] = [];
  if (!isSpecialNativeView(activeTab) && !isDocPinned(activeTab) && siteMap.has(activeTab)) {
    openUnpinnedIds.push(activeTab);
  }
  for (const t of browserTabs) {
    if (
      !isSpecialNativeView(t.siteId) &&
      !isDocPinned(t.siteId) &&
      !openUnpinnedIds.includes(t.siteId) &&
      siteMap.has(t.siteId)
    ) {
      openUnpinnedIds.push(t.siteId);
    }
  }
  const openUnpinnedSites = openUnpinnedIds
    .map((id) => siteMap.get(id))
    .filter((s): s is UnifiedSiteEntry => Boolean(s));

  const railHomeWrap = document.getElementById("railHomeWrap");
  if (railHomeWrap) {
    railHomeWrap.classList.toggle("active", activeTab === "home");
    tabHome?.classList.toggle("active", activeTab === "home");
  }
  updateBookmarkUI();

  const pinnedHtml = pinnedSites
    .map((s, idx) => {
      const isActive = activeTab === s.id;
      return `
        <div
          class="rail-item pinned-rail-item ${isActive ? "active" : ""}"
          data-rail-site="${escapeHtml(s.id)}"
          data-pinned-item="${escapeHtml(s.id)}"
        >
          <span class="rail-pill"></span>
          <button
            class="rail-btn brand-rail-btn ${isActive ? "active" : ""}"
            data-open-site="${escapeHtml(s.id)}"
            style="--brand-color: ${s.color}; --brand-tint: ${s.bgTint};"
            title="📌 Pinned (#${idx + 1}): ${escapeHtml(s.name)} (${escapeHtml(s.version)}) — Click to Open • Drag to Reorder • Right-Click to Unpin${
        s.updateAvailable ? " — Update Available!" : ""
      }"
          >
            ${s.svg}
            ${s.updateAvailable ? `<span class="rail-update-dot" title="Update Available"></span>` : ""}
          </button>
          <button class="rail-unpin-btn" data-unpin-site="${escapeHtml(s.id)}" title="Unpin ${escapeHtml(s.name)} from main rail">×</button>
        </div>
      `;
    })
    .join("");

  const unpinnedOpenHtml =
    openUnpinnedSites.length > 0
      ? `${pinnedSites.length > 0 ? `<div class="rail-separator" title="Currently Open (Unpinned)"></div>` : ""}${openUnpinnedSites
          .map((s) => {
            const isActive = activeTab === s.id;
            return `
              <div class="rail-item ${isActive ? "active" : ""}" data-rail-site="${escapeHtml(s.id)}">
                <span class="rail-pill"></span>
                <button
                  class="rail-btn brand-rail-btn ${isActive ? "active" : ""}"
                  data-open-site="${escapeHtml(s.id)}"
                  style="--brand-color: ${s.color}; --brand-tint: ${s.bgTint};"
                  title="📖 Open: ${escapeHtml(s.name)} (${escapeHtml(s.version)}) — Click to View • Right-Click or click + to Pin to Sidebar"
                >
                  ${s.svg}
                  ${s.updateAvailable ? `<span class="rail-update-dot" title="Update Available"></span>` : ""}
                </button>
                <button class="rail-pin-btn" data-pin-rail-site="${escapeHtml(s.id)}" title="Pin ${escapeHtml(s.name)} to main sidebar">+</button>
              </div>
            `;
          })
          .join("")}`
      : "";

  installedRailList.innerHTML = pinnedHtml + unpinnedOpenHtml;

  installedRailList.querySelectorAll("[data-open-site]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      if (Date.now() < suppressPinClickUntil) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const me = e as MouseEvent;
      const siteId = btn.getAttribute("data-open-site");
      if (!siteId) return;
      const siteEntry = siteMap.get(siteId);
      if (siteEntry && !siteEntry.installed) {
        await runGitHubPackUpdate(siteId, true);
      } else {
        switchTab(siteId, undefined, me.ctrlKey || me.metaKey);
      }
    });
    btn.addEventListener("auxclick", async (e) => {
      const me = e as MouseEvent;
      if (me.button === 1) {
        me.preventDefault();
        const siteId = btn.getAttribute("data-open-site");
        if (!siteId) return;
        const siteEntry = siteMap.get(siteId);
        if (siteEntry && !siteEntry.installed) {
          await runGitHubPackUpdate(siteId, true);
        } else {
          switchTab(siteId, undefined, true);
        }
      }
    });
    btn.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const siteId = btn.getAttribute("data-open-site");
      if (siteId) togglePinDoc(siteId);
    });
  });

  installedRailList.querySelectorAll("[data-unpin-site]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const siteId = btn.getAttribute("data-unpin-site");
      if (siteId) togglePinDoc(siteId);
    });
  });

  installedRailList.querySelectorAll("[data-pin-rail-site]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const siteId = btn.getAttribute("data-pin-rail-site");
      if (siteId) togglePinDoc(siteId);
    });
  });

  // Smooth pointer-based drag-and-drop reordering for pinned items on the main sidebar rail
  attachPointerPinnedSort(
    installedRailList,
    "[data-pinned-item]",
    "data-pinned-item",
    "[data-unpin-site]",
    siteMap
  );
}

// 3. Render Column 2: Second Column = All 57 Docs with Pin/Unpin & Drag-and-Drop Reordering
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
    sidebarStatus.textContent = `${pinnedSiteIds.length} Pinned • ${installedSites.length}/${sites.length} Installed`;
  }

  const q = drawerFilterQuery.trim().toLowerCase();
  const filteredSites = q
    ? sites.filter((s) =>
        `${s.name} ${s.id} ${s.category} ${s.version}`.toLowerCase().includes(q)
      )
    : sites;

  const siteMap = new Map(sites.map((s) => [s.id, s]));
  const pinnedList = pinnedSiteIds
    .map((id) => siteMap.get(id))
    .filter((s): s is UnifiedSiteEntry => Boolean(s));

  const pinnedSectionHtml =
    !q && pinnedList.length > 0
      ? `
    <div class="channel-category">
      <span class="category-label">📌 PINNED SIDEBAR ORDER (${pinnedList.length})</span>
      ${pinnedList
        .map((s, idx) => {
          return `
        <div class="channel-item-row pinned-drawer-row" data-drawer-pinned-item="${escapeHtml(s.id)}">
          <button
            class="channel-item ${activeTab === s.id ? "active" : ""}"
            data-drawer-site="${escapeHtml(s.id)}"
            title="Pinned #${idx + 1}: ${escapeHtml(s.name)} — Click to Open • Drag to Reorder"
          >
            <span class="channel-drag-handle" title="Drag to reorder">⋮⋮</span>
            <span class="channel-brand-icon" style="color: ${s.color};">${s.svg}</span>
            <span class="channel-name">${escapeHtml(s.name)}</span>
          </button>
          <button
            class="channel-pin-btn pinned"
            data-pin-site="${escapeHtml(s.id)}"
            title="Unpin ${escapeHtml(s.name)} from main sidebar"
          >📌</button>
        </div>
      `;
        })
        .join("")}
    </div>
  `
      : "";

  const homeChannelHtml = `
    <div class="channel-category">
      <span class="category-label">ALL DOCUMENTATION (${filteredSites.length}/${sites.length})</span>
      <div class="channel-item-row">
        <button class="channel-item ${activeTab === "home" ? "active" : ""}" data-drawer-site="home">
          <span class="channel-brand-icon" style="color: #38bdf8;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
          </span>
          <span class="channel-name">${sites.length}-Site Hub & Store</span>
          <span class="channel-tag">${sites.length}</span>
        </button>
      </div>
    </div>
  `;

  const categoriesHtml = categories
    .map((cat) => {
      const catSites = filteredSites.filter((s) => s.category === cat);
      if (catSites.length === 0) return "";
      return `
        <div class="channel-category">
          <span class="category-label">${escapeHtml(cat.toUpperCase())} (${catSites.length})</span>
          ${catSites
            .map((s) => {
              const pinned = isDocPinned(s.id);
              return `
            <div class="channel-item-row">
              <button
                class="channel-item ${activeTab === s.id ? "active" : ""}"
                data-drawer-site="${escapeHtml(s.id)}"
                title="${escapeHtml(s.name)} — ${s.installed ? "Click to Open • Ctrl+Click for New Tab • Right-Click to Pin/Unpin" : "Click to Install & Open"}"
              >
                <span class="channel-brand-icon" style="color: ${s.color};">${s.svg}</span>
                <span class="channel-name">${escapeHtml(s.name)}</span>
                ${
                  s.updateAvailable
                    ? `<span class="channel-tag update-tag">⚡ Update</span>`
                    : s.installed
                    ? `<span class="channel-tag installed-tag">${escapeHtml(s.version)}</span>`
                    : `<span class="channel-tag">☁ ${s.sizeMb}M</span>`
                }
              </button>
              <button
                class="channel-pin-btn ${pinned ? "pinned" : ""}"
                data-pin-site="${escapeHtml(s.id)}"
                title="${pinned ? `Unpin ${escapeHtml(s.name)} from main sidebar` : `Pin ${escapeHtml(s.name)} to main sidebar`}"
              >📌</button>
            </div>
          `;
            })
            .join("")}
        </div>
      `;
    })
    .join("");

  drawerChannelsScroll.innerHTML = homeChannelHtml + pinnedSectionHtml + categoriesHtml;

  drawerChannelsScroll.querySelectorAll("[data-pin-site]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const siteId = btn.getAttribute("data-pin-site");
      if (siteId) togglePinDoc(siteId);
    });
  });

  attachPointerPinnedSort(
    drawerChannelsScroll,
    "[data-drawer-pinned-item]",
    "data-drawer-pinned-item",
    "[data-pin-site]",
    siteMap
  );

  drawerChannelsScroll.querySelectorAll("[data-drawer-site]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      if (Date.now() < suppressPinClickUntil) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
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
    btn.addEventListener("contextmenu", (e) => {
      const target = btn.getAttribute("data-drawer-site");
      if (!target || target === "home") return;
      e.preventDefault();
      togglePinDoc(target);
    });
  });
}

// 4. Render Redesigned 57-Site Home Hub
function renderHomeHub(sites: UnifiedSiteEntry[]) {
  const gridEl = document.getElementById("allSitesGrid");
  if (!gridEl) return;

  const installedSites = sites.filter((s) => s.installed);
  const remainingSites = sites.filter((s) => !s.installed);
  const outdatedSites = sites.filter((s) => s.updateAvailable);
  const installedCount = installedSites.length;
  const updatesCount = outdatedSites.length;

  const installedMb = installedSites.reduce((sum, s) => sum + (parseFloat(s.sizeMb) || 0), 0).toFixed(1);
  const remainingMb = remainingSites.reduce((sum, s) => sum + (parseFloat(s.sizeMb) || 0), 0).toFixed(1);
  const outdatedMb = outdatedSites.reduce((sum, s) => sum + (parseFloat(s.sizeMb) || 0), 0).toFixed(1);

  const heroInstalledStat = document.getElementById("heroInstalledStat");
  if (heroInstalledStat) {
    heroInstalledStat.textContent = `${installedCount}/${sites.length} Installed (${installedMb} MB)`;
  }

  const btnDownloadAll = document.getElementById("btnDownloadAllDocs") as HTMLButtonElement | null;
  const btnDownloadAllLabel = document.getElementById("btnDownloadAllDocsLabel");
  if (btnDownloadAll && btnDownloadAllLabel) {
    if (remainingSites.length > 0) {
      btnDownloadAll.classList.remove("all-installed");
      btnDownloadAllLabel.textContent = `⬇ Download Remaining ${remainingSites.length} Docs (${remainingMb} MB)`;
      btnDownloadAll.title = `Download all ${remainingSites.length} uninstalled documentation packs (${remainingMb} MB total) from GitHub Releases`;
    } else if (outdatedSites.length > 0) {
      btnDownloadAll.classList.remove("all-installed");
      btnDownloadAllLabel.textContent = `⚡ Update ${outdatedSites.length} Docs (${outdatedMb} MB)`;
      btnDownloadAll.title = `Delta-update ${outdatedSites.length} outdated documentation packs (up to ${outdatedMb} MB) from GitHub Releases`;
    } else {
      btnDownloadAll.classList.add("all-installed");
      btnDownloadAllLabel.textContent = `✓ All ${sites.length} Docs Installed (0 MB to download)`;
      btnDownloadAll.title = `All ${sites.length} documentation packs (${installedMb} MB local) are already installed and up to date — click to check for delta updates`;
    }
  }

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
        ? `<span class="site-status-badge installed">● Installed (${s.sizeMb} MB)</span>`
        : `<span class="site-status-badge cloud">☁ Cloud (${s.sizeMb} MB)</span>`;

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
                  <button class="site-btn-delta" data-card-new-tab="${escapeHtml(s.id)}" title="Open in a New Vertical Tab">
                    + Tab
                  </button>
                  <button
                    class="site-btn-delta ${isDocPinned(s.id) ? "highlight-update" : ""}"
                    data-card-pin="${escapeHtml(s.id)}"
                    title="${isDocPinned(s.id) ? "Unpin from Main Sidebar Rail" : "Pin to Main Sidebar Rail"}"
                  >
                    ${isDocPinned(s.id) ? "📌 Pinned" : "📌 Pin"}
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
                    ${dl ? `⏳ Downloading... ${dlPct}%` : `⬇ Download & Install (${s.sizeMb} MB)`}
                  </button>
                  <button
                    class="site-btn-delta ${isDocPinned(s.id) ? "highlight-update" : ""}"
                    data-card-pin="${escapeHtml(s.id)}"
                    title="${isDocPinned(s.id) ? "Unpin from Main Sidebar Rail" : "Pin to Main Sidebar Rail"}"
                  >
                    ${isDocPinned(s.id) ? "📌 Pinned" : "📌 Pin"}
                  </button>
                `
            }
          </div>
        </article>
      `;
    })
    .join("");

  gridEl.querySelectorAll("[data-card-pin]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const siteId = btn.getAttribute("data-card-pin");
      if (siteId) togglePinDoc(siteId);
    });
  });

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

const PARALLEL_DOWNLOAD_WORKERS = 6;

async function syncLocalPacksOnlyAndRender() {
  try {
    installedPacksCache = await invoke<PackStatusInfo[]>("get_installed_packs");
    for (const p of installedPacksCache) {
      if (p.port) sitePorts[p.id] = p.port;
    }
  } catch {}
  renderAllUI(false);
}

async function runGitHubPackUpdate(siteId: string, openAfter = false, isBatchItem = false) {
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
  if (banner && !isBatchItem) {
    banner.style.display = "block";
    banner.textContent = `Downloading & verifying '${siteId}.docpack' from GitHub Releases...`;
  }
  try {
    const res = await invoke<DeltaUpdateResult>("install_or_update_from_github", { siteId });
    if (res.port) {
      sitePorts[siteId] = res.port;
    }
    // Keep remoteRegistryCache in sync immediately so the card flips to up-to-date without waiting on network
    const remEntry = remoteRegistryCache.find((r) => r.id === siteId);
    if (remEntry) {
      remEntry.installed = true;
      remEntry.local_commit = res.new_commit;
      remEntry.commit = res.new_commit;
      remEntry.update_available = false;
    }
    if (banner && !isBatchItem) {
      banner.textContent = `✓ [${res.site_id.toUpperCase()} ${res.old_commit} → ${res.new_commit}] ${res.message}`;
    }
    activeDownloads.delete(siteId);
    if (isBatchItem) {
      await syncLocalPacksOnlyAndRender();
    } else {
      await syncAllPacksAndRender(false);
    }
    if (openAfter) {
      await switchTab(siteId);
    }
  } catch (err) {
    activeDownloads.delete(siteId);
    if (activeDownloads.size === 0 && downloadProgressHud) {
      downloadProgressHud.style.display = "none";
    }
    if (banner && !isBatchItem) {
      banner.textContent = `Update notice for ${siteId}: ${String(err)}`;
    }
    renderHomeHub(buildUnifiedSitesList());
  }
}

async function runBatchPackUpdatesInParallel(
  targets: UnifiedSiteEntry[],
  concurrency = PARALLEL_DOWNLOAD_WORKERS,
  onProgress?: (completedCount: number, completedMb: number, totalMb: string, lastSite: UnifiedSiteEntry) => void
) {
  if (targets.length === 0) return;
  const totalTargetMb = targets
    .reduce((sum, s) => sum + (parseFloat(s.sizeMb) || 0), 0)
    .toFixed(1);

  let nextIdx = 0;
  let completedCount = 0;
  let completedMb = 0;

  const workerCount = Math.min(concurrency, targets.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIdx < targets.length) {
      const idx = nextIdx++;
      const s = targets[idx];
      if (!s) break;
      const packMb = parseFloat(s.sizeMb) || 0;
      await runGitHubPackUpdate(s.id, false, true);
      completedCount++;
      completedMb += packMb;
      onProgress?.(completedCount, completedMb, totalTargetMb, s);
    }
  });

  await Promise.all(workers);
  await syncAllPacksAndRender(false);
}

async function updateAllOutdatedPacks() {
  const sites = buildUnifiedSitesList().filter((s) => s.updateAvailable);
  if (sites.length === 0) return;
  const banner = document.getElementById("deltaStatusBanner");
  const btnUpdateAllPacks = document.getElementById("btnUpdateAllPacks") as HTMLButtonElement | null;
  if (btnUpdateAllPacks) btnUpdateAllPacks.disabled = true;
  if (btnAlertUpdateAll) btnAlertUpdateAll.disabled = true;

  await runBatchPackUpdatesInParallel(
    sites,
    PARALLEL_DOWNLOAD_WORKERS,
    (done, doneMb, totalMb, lastSite) => {
      if (banner) {
        banner.style.display = "block";
        banner.textContent = `⚡ Parallel Update (${PARALLEL_DOWNLOAD_WORKERS}x) [${done}/${sites.length}]: Finished ${lastSite.name} — ${doneMb.toFixed(
          1
        )} / ${totalMb} MB completed...`;
      }
    }
  );

  if (btnUpdateAllPacks) btnUpdateAllPacks.disabled = false;
  if (btnAlertUpdateAll) btnAlertUpdateAll.disabled = false;
  if (banner) {
    banner.style.display = "block";
    banner.textContent = `✓ Updated all ${sites.length} documentation packs in parallel!`;
  }
}

async function downloadAllOrRemainingDocs() {
  const btn = document.getElementById("btnDownloadAllDocs") as HTMLButtonElement | null;
  const label = document.getElementById("btnDownloadAllDocsLabel");
  const banner = document.getElementById("deltaStatusBanner");

  if (btn) btn.disabled = true;
  if (label) label.textContent = "⏳ Checking registry for missing/updated docs...";
  await syncAllPacksAndRender(true);

  const allSites = buildUnifiedSitesList();
  const remaining = allSites.filter((s) => !s.installed);
  const outdated = allSites.filter((s) => s.updateAvailable);

  const targets = remaining.length > 0 ? remaining : outdated;

  if (targets.length === 0) {
    if (btn) btn.disabled = false;
    renderHomeHub(allSites);
    if (banner) {
      banner.style.display = "block";
      banner.textContent = `✓ All ${allSites.length} documentation packs are already installed and up to date (0.0 MB downloaded)!`;
    }
    return;
  }

  const totalTargetMb = targets
    .reduce((sum, s) => sum + (parseFloat(s.sizeMb) || 0), 0)
    .toFixed(1);

  if (label) {
    label.textContent = `⏳ Downloading ${targets.length} Docs (${PARALLEL_DOWNLOAD_WORKERS}x Parallel)...`;
  }

  await runBatchPackUpdatesInParallel(
    targets,
    PARALLEL_DOWNLOAD_WORKERS,
    (done, doneMb, totalMb, lastSite) => {
      if (label) {
        label.textContent = `⏳ [${done}/${targets.length}] Parallel (${doneMb.toFixed(1)} / ${totalMb} MB)`;
      }
      if (banner) {
        banner.style.display = "block";
        banner.textContent = `⚡ Parallel Batch Download (${PARALLEL_DOWNLOAD_WORKERS}x) [${done}/${targets.length}]: Finished ${lastSite.name} — ${doneMb.toFixed(
          1
        )} MB / ${totalMb} MB completed...`;
      }
    }
  );

  if (btn) btn.disabled = false;
  if (banner) {
    banner.style.display = "block";
    banner.textContent = `✓ Downloaded/updated ${targets.length} documentation packs (${totalTargetMb} MB) in parallel! All ${allSites.length} packs are now up to date.`;
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

let lastPointerX = -1;
let lastPointerY = -1;
let rightTabsCloseTimer: number | null = null;

function isPointerInsideLeftSidebar(): boolean {
  return Boolean(discordSidebar?.matches(":hover") || leftEdgeSensor?.matches(":hover"));
}

function isPointerOverHomeIcon(yOverride?: number): boolean {
  const railHomeWrap = document.getElementById("railHomeWrap");
  if (railHomeWrap?.matches(":hover") || tabHome?.matches(":hover")) {
    return true;
  }
  const checkY = typeof yOverride === "number" ? yOverride : lastPointerY;
  if (checkY < 0) return false;
  const rect = (railHomeWrap || tabHome)?.getBoundingClientRect();
  if (!rect || rect.height === 0) {
    return checkY >= 36 && checkY <= 104;
  }
  return checkY >= rect.top - 8 && checkY <= rect.bottom + 8;
}

function openHoverRightTabs() {
  if (!rightTabsSidebar || !featureTabsEnabled || !featureTabHoverExpand) return;
  if (rightTabsCloseTimer) {
    window.clearTimeout(rightTabsCloseTimer);
    rightTabsCloseTimer = null;
  }
  rightTabsSidebar.classList.add("hover-open");
}

function scheduleCloseHoverRightTabs(delay = 15) {
  if (rightTabsCloseTimer) {
    window.clearTimeout(rightTabsCloseTimer);
    rightTabsCloseTimer = null;
  }
  if (delay <= 0) {
    if (rightTabsSidebar && !rightTabsSidebar.matches(":hover")) {
      rightTabsSidebar.classList.remove("hover-open");
    }
    return;
  }
  rightTabsCloseTimer = window.setTimeout(() => {
    if (!rightTabsSidebar) return;
    if (rightTabsSidebar.matches(":hover")) return;
    rightTabsSidebar.classList.remove("hover-open");
  }, delay);
}

function openHoverDrawer() {
  if (drawerHoverCloseTimer) {
    window.clearTimeout(drawerHoverCloseTimer);
    drawerHoverCloseTimer = null;
  }
  if (sidebarCloseTimer) {
    window.clearTimeout(sidebarCloseTimer);
    sidebarCloseTimer = null;
  }
  discordSidebar.classList.add("open");
  discordSidebar.classList.add("drawer-hover-open");
}

function scheduleCloseHoverDrawer(delay = 20) {
  if (drawerHoverCloseTimer) {
    window.clearTimeout(drawerHoverCloseTimer);
    drawerHoverCloseTimer = null;
  }
  if (delay <= 0) {
    if (!isPointerInsideLeftSidebar()) {
      discordSidebar.classList.remove("drawer-hover-open");
    }
    return;
  }
  drawerHoverCloseTimer = window.setTimeout(() => {
    if (!isPointerInsideLeftSidebar()) {
      discordSidebar.classList.remove("drawer-hover-open");
    }
  }, delay);
}

// Discord Hover Sidebar & Collapsible Custom Topbar Logic
function openHoverSidebar(checkHomeY?: number) {
  if (sidebarCloseTimer) {
    window.clearTimeout(sidebarCloseTimer);
    sidebarCloseTimer = null;
  }
  if (drawerHoverCloseTimer) {
    window.clearTimeout(drawerHoverCloseTimer);
    drawerHoverCloseTimer = null;
  }
  discordSidebar.classList.add("open");
  if (isPointerOverHomeIcon(checkHomeY)) {
    discordSidebar.classList.add("drawer-hover-open");
  }
}

function scheduleCloseHoverSidebar(delay = 20) {
  if (sidebarCloseTimer) {
    window.clearTimeout(sidebarCloseTimer);
    sidebarCloseTimer = null;
  }
  if (delay <= 0) {
    if (!isPointerInsideLeftSidebar()) {
      if (!sidebarPinned) {
        discordSidebar.classList.remove("open");
      }
      discordSidebar.classList.remove("drawer-hover-open");
    }
    return;
  }
  sidebarCloseTimer = window.setTimeout(() => {
    if (isPointerInsideLeftSidebar()) {
      if (lastPointerX <= 74 && isPointerOverHomeIcon()) {
        discordSidebar.classList.add("drawer-hover-open");
      }
      return;
    }
    if (!sidebarPinned) {
      discordSidebar.classList.remove("open");
    }
    discordSidebar.classList.remove("drawer-hover-open");
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
  if (drawerHidden) {
    discordSidebar.classList.remove("drawer-hover-open");
  }
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

function handleGlobalPointerMove(e: MouseEvent | PointerEvent) {
  lastPointerX = e.clientX;
  lastPointerY = e.clientY;

  // 1. Left Sidebar & Doc Hub First Icon fast-cursor detection + immediate collapse outside bounds
  const sidebarIsOpen = sidebarPinned || discordSidebar.classList.contains("open");
  const drawerIsOpen = discordSidebar.classList.contains("drawer-hover-open") || !drawerHidden;
  if (e.clientX <= 22 || (sidebarIsOpen && e.clientX <= 74)) {
    openHoverSidebar(e.clientY);
  } else if (discordSidebar.classList.contains("drawer-hover-open") && e.clientX > 320) {
    scheduleCloseHoverDrawer(0);
    if (!sidebarPinned) scheduleCloseHoverSidebar(0);
  } else if (!drawerIsOpen && !sidebarPinned && discordSidebar.classList.contains("open") && e.clientX > 76) {
    scheduleCloseHoverSidebar(0);
  }

  // 2. Right Vertical Tabs fast-cursor detection + immediate collapse outside bounds
  if (rightTabsSidebar && featureTabsEnabled) {
    const isHoverOpen = rightTabsSidebar.classList.contains("hover-open");
    if (!isHoverOpen) {
      if (e.clientX >= window.innerWidth - 52 && e.clientY >= 36) {
        openHoverRightTabs();
      }
    } else if (e.clientX < window.innerWidth - 228 && !rightTabsSidebar.matches(":hover")) {
      scheduleCloseHoverRightTabs(0);
    }
  }
}

function setupSidebarAndTopbarHover() {
  applyDrawerState();

  window.addEventListener("pointermove", handleGlobalPointerMove, { passive: true });
  window.addEventListener("mousemove", handleGlobalPointerMove, { passive: true });
  window.addEventListener("pointerover", handleGlobalPointerMove, { passive: true });

  // Catch fast cursor exits from the doc viewport/iframe into either sidebar
  const onViewportLeave = (e: MouseEvent | PointerEvent) => {
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    if (!viewportContainer) return;
    const vRect = viewportContainer.getBoundingClientRect();
    if (e.clientX <= vRect.left + 32) {
      openHoverSidebar(e.clientY);
    } else if (e.clientX >= vRect.right - 32) {
      openHoverRightTabs();
    }
    if (e.clientY <= vRect.top + 18) {
      peekTopbar();
    }
  };
  viewportContainer?.addEventListener("mouseleave", onViewportLeave, { passive: true });
  viewportContainer?.addEventListener("pointerleave", onViewportLeave, { passive: true });

  leftEdgeSensor.addEventListener("mouseenter", (e) => {
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    openHoverSidebar(e.clientY);
  });
  leftEdgeSensor.addEventListener("mousemove", (e) => {
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    openHoverSidebar(e.clientY);
  });
  leftEdgeSensor.addEventListener("mouseleave", () => scheduleCloseHoverSidebar(35));

  discordSidebar.addEventListener("mouseenter", (e) => {
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    openHoverSidebar(e.clientY);
  });
  discordSidebar.addEventListener("mousemove", (e) => {
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    if (sidebarCloseTimer) {
      window.clearTimeout(sidebarCloseTimer);
      sidebarCloseTimer = null;
    }
    if (drawerHoverCloseTimer) {
      window.clearTimeout(drawerHoverCloseTimer);
      drawerHoverCloseTimer = null;
    }
    if (e.clientX <= 74 && isPointerOverHomeIcon(e.clientY)) {
      openHoverDrawer();
    }
  });
  discordSidebar.addEventListener("mouseleave", (e) => {
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    scheduleCloseHoverDrawer(15);
    scheduleCloseHoverSidebar(15);
  });

  rightTabsSidebar?.addEventListener("mouseenter", () => openHoverRightTabs());
  rightTabsSidebar?.addEventListener("pointerenter", () => openHoverRightTabs());
  rightTabsSidebar?.addEventListener("mousemove", () => openHoverRightTabs());
  rightTabsSidebar?.addEventListener("mouseleave", (e) => {
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    scheduleCloseHoverRightTabs(0);
  });

  // Hovering on the first icon (Doc Hub) in the main sidebar expands the second column (.discord-channel-drawer)
  // and keeps it expanded as long as the cursor stays anywhere inside #discordSidebar.
  const railHomeWrap = document.getElementById("railHomeWrap");
  const channelDrawer = document.querySelector(".discord-channel-drawer") as HTMLElement | null;
  railHomeWrap?.addEventListener("mouseenter", () => openHoverDrawer());
  railHomeWrap?.addEventListener("mouseover", () => openHoverDrawer());
  railHomeWrap?.addEventListener("pointerenter", () => openHoverDrawer());
  tabHome?.addEventListener("mouseenter", () => openHoverDrawer());
  tabHome?.addEventListener("mouseover", () => openHoverDrawer());
  tabHome?.addEventListener("pointerenter", () => openHoverDrawer());
  channelDrawer?.addEventListener("mouseenter", () => openHoverDrawer());

  btnToggleDrawer?.addEventListener("click", () => toggleDrawerHidden());
  btnCollapseDrawer?.addEventListener("click", () => toggleDrawerHidden());
  btnPinSidebar.addEventListener("click", () => togglePinSidebar());
  btnToggleTopbar.addEventListener("click", () => toggleTopbarHidden());
  btnRailToggleTopbar.addEventListener("click", () => toggleTopbarHidden());

  topEdgeSensor.addEventListener("mouseenter", () => peekTopbar());
  customTitlebar.addEventListener("mouseenter", () => peekTopbar());
  customTitlebar.addEventListener("mouseleave", () => scheduleClosePeekTopbar(300));
}

// Load Search Index (Core + Bundled 21-Pack Index + Dynamic Installed Pack Index)
async function loadSearchIndex() {
  try {
    const [resCore, resExtra] = await Promise.all([
      fetch("/search-index.json").catch(() => null),
      fetch("/extra-search-index.json").catch(() => null),
    ]);
    if (resCore && resCore.ok) {
      baseSearchIndex = await resCore.json();
    }
    if (resExtra && resExtra.ok) {
      bundledExtraSearchIndex = await resExtra.json();
    }
    await refreshExtraSearchEntries();
  } catch (err) {
    console.error("Failed to load search index:", err);
  }
}

let searchDocPickerOpen = false;
let searchDocPickerCat = "all";
let searchDocPickerQuery = "";

async function refreshExtraSearchEntries() {
  let dynamicExtra: SearchEntry[] = [];
  try {
    dynamicExtra = (await invoke<SearchEntry[]>("get_extra_search_entries")) || [];
  } catch {}

  const installedIds = new Set<string>(["tailwind", "shadcn"]);
  for (const p of installedPacksCache) {
    if (p.route_count > 0 && SITE_BRANDS[p.id]) {
      installedIds.add(p.id);
    }
  }
  for (const r of remoteRegistryCache) {
    if (r.installed && SITE_BRANDS[r.id]) {
      installedIds.add(r.id);
    }
  }

  const byKey = new Map<string, SearchEntry>();
  const merged: SearchEntry[] = [];

  const pushUnique = (items: SearchEntry[], requireInstalled: boolean) => {
    for (const item of items) {
      if (!item || !item.site || !item.path || !SITE_BRANDS[item.site]) continue;
      if (requireInstalled && installedPacksCache.length > 0 && !installedIds.has(item.site)) {
        continue;
      }
      const normPath = item.path.replace(/\/+$/, "") || "/";
      const key = `${item.site}:${normPath}:${(item.title || "").toLowerCase()}`;
      const existing = byKey.get(key);
      if (existing) {
        if (item.keywords && item.keywords.length > (existing.keywords?.length || 0)) {
          existing.keywords = item.keywords;
        }
        if (item.headings && item.headings.length > (existing.headings?.length || 0)) {
          existing.headings = item.headings;
        }
        if (item.description && item.description.length > (existing.description?.length || 0)) {
          existing.description = item.description;
        }
        continue;
      }
      // Pre-compute normalized lowercase fields for fast full-content search
      const brand = getSiteBrand(item.site);
      const anyItem = item as any;
      anyItem._siteLower = `${item.site} ${brand.name}`.toLowerCase();
      anyItem._titleLower = (item.title || "").toLowerCase();
      anyItem._descLower = (item.description || item.preview || "").toLowerCase();
      anyItem._pathLower = (item.path || "").toLowerCase();
      anyItem._catLower = (item.category || "").toLowerCase();
      const kwArr = (item.keywords || []).map((k) => String(k).toLowerCase());
      const hdArr = (item.headings || []).map((h) => String(h).toLowerCase());
      anyItem._kwSet = new Set(kwArr);
      anyItem._headingsLower = [...kwArr, ...hdArr].join(" ");

      byKey.set(key, item);
      merged.push(item);
    }
  };

  // Prioritize deep dynamicExtra entries from .search.json / .docpack first
  pushUnique(dynamicExtra, false);
  pushUnique(baseSearchIndex, false);
  pushUnique(bundledExtraSearchIndex, true);

  searchIndex = merged;
  renderSearchFilterChips();
}

function renderSearchFilterChips() {
  if (!searchFiltersBar) return;

  const countsBySite = new Map<string, number>();
  for (const item of searchIndex) {
    countsBySite.set(item.site, (countsBySite.get(item.site) || 0) + 1);
  }

  const siteIds = Array.from(countsBySite.keys());
  siteIds.sort((a, b) => {
    if (a === activeTab && b !== activeTab) return -1;
    if (b === activeTab && a !== activeTab) return 1;
    const brandA = getSiteBrand(a);
    const brandB = getSiteBrand(b);
    return brandA.name.localeCompare(brandB.name);
  });

  if (currentFilter !== "all" && !countsBySite.has(currentFilter)) {
    currentFilter = "all";
  }

  const hasCurrentDoc = activeTab !== "home" && countsBySite.has(activeTab);
  const currentDocBrand = hasCurrentDoc ? getSiteBrand(activeTab) : null;
  const currentDocCnt = hasCurrentDoc ? countsBySite.get(activeTab) || 0 : 0;

  const selectedBrand = currentFilter !== "all" ? getSiteBrand(currentFilter) : null;
  const selectedCnt = currentFilter !== "all" ? countsBySite.get(currentFilter) || 0 : 0;

  searchFiltersBar.innerHTML = `
    <div class="search-scope-left">
      <button class="filter-chip ${currentFilter === "all" ? "active" : ""}" data-filter="all">
        All Installed <span class="count-badge">${searchIndex.length}</span>
      </button>
      ${
        hasCurrentDoc && currentDocBrand
          ? `<button class="filter-chip ${currentFilter === activeTab ? "active" : ""}" data-filter="${escapeHtml(
              activeTab
            )}" title="Filter search to currently open documentation">
              <span class="search-doc-dot" style="background:${currentDocBrand.color};"></span>
              Current: ${escapeHtml(currentDocBrand.name)} <span class="count-badge">${currentDocCnt}</span>
            </button>`
          : ""
      }
      ${
        currentFilter !== "all" && currentFilter !== activeTab && selectedBrand
          ? `<button class="filter-chip active" data-filter="all" title="Click to clear doc filter">
              <span class="search-doc-dot" style="background:${selectedBrand.color};"></span>
              ${escapeHtml(selectedBrand.name)} <span class="count-badge">${selectedCnt}</span>
              <span class="filter-chip-clear">×</span>
            </button>`
          : ""
      }
    </div>
    <div class="search-scope-right">
      <button id="btnToggleSearchDocPicker" class="search-picker-toggle-btn ${
        searchDocPickerOpen ? "open" : ""
      }" type="button">
        <span>📚 ${
          currentFilter === "all"
            ? `Select Doc (${siteIds.length})`
            : `${escapeHtml(selectedBrand?.name || currentFilter)}`
        }</span>
        <span>${searchDocPickerOpen ? "▴" : "▾"}</span>
      </button>
    </div>
  `;

  searchFiltersBar.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      currentFilter = chip.getAttribute("data-filter") || "all";
      searchDocPickerOpen = false;
      renderSearchFilterChips();
      performSearch(searchInput.value);
    });
  });

  const toggleBtn = document.getElementById("btnToggleSearchDocPicker");
  toggleBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    searchDocPickerOpen = !searchDocPickerOpen;
    renderSearchFilterChips();
    if (searchDocPickerOpen) {
      const pickerInput = document.getElementById("searchDocPickerInput") as HTMLInputElement | null;
      setTimeout(() => pickerInput?.focus(), 20);
    }
  });

  renderSearchDocPickerPanel(siteIds, countsBySite);
}

function renderSearchDocPickerPanel(siteIds: string[], countsBySite: Map<string, number>) {
  const panel = document.getElementById("searchDocPickerPanel");
  const catsEl = document.getElementById("searchDocPickerCats");
  const gridEl = document.getElementById("searchDocPickerGrid");
  if (!panel || !catsEl || !gridEl) return;

  panel.style.display = searchDocPickerOpen ? "flex" : "none";
  if (!searchDocPickerOpen) return;

  const categories = [
    { id: "all", label: `All (${siteIds.length})` },
    { id: "Frontend & UI", label: "Frontend" },
    { id: "TanStack Suite", label: "TanStack" },
    { id: "Backend & JS/TS", label: "Backend" },
    { id: "Systems & Languages", label: "Systems" },
    { id: "DevOps, Build & Shells", label: "DevOps" },
  ];

  catsEl.innerHTML = categories
    .map(
      (c) =>
        `<button type="button" class="picker-cat-btn ${
          searchDocPickerCat === c.id ? "active" : ""
        }" data-picker-cat="${escapeHtml(c.id)}">${escapeHtml(c.label)}</button>`
    )
    .join("");

  catsEl.querySelectorAll("[data-picker-cat]").forEach((btn) => {
    btn.addEventListener("click", () => {
      searchDocPickerCat = btn.getAttribute("data-picker-cat") || "all";
      renderSearchDocPickerPanel(siteIds, countsBySite);
    });
  });

  const q = searchDocPickerQuery.trim().toLowerCase();
  const filteredSiteIds = siteIds.filter((id) => {
    const brand = getSiteBrand(id);
    if (searchDocPickerCat !== "all" && brand.category !== searchDocPickerCat) return false;
    if (q) {
      const hay = `${brand.name} ${id} ${brand.category} ${brand.version}`.toLowerCase();
      return hay.includes(q);
    }
    return true;
  });

  gridEl.innerHTML = [
    `<button type="button" class="search-doc-option ${currentFilter === "all" ? "active" : ""}" data-pick-doc="all">
      <span class="search-doc-dot" style="background:#38bdf8;"></span>
      <span class="search-doc-name">All Installed Docs</span>
      <span class="search-doc-cnt">${searchIndex.length}</span>
    </button>`,
    ...filteredSiteIds.map((id) => {
      const brand = getSiteBrand(id);
      const cnt = countsBySite.get(id) || 0;
      return `<button type="button" class="search-doc-option ${
        currentFilter === id ? "active" : ""
      }" data-pick-doc="${escapeHtml(id)}" title="${escapeHtml(brand.name)} (${escapeHtml(brand.version)})">
        <span class="search-doc-dot" style="background:${brand.color};"></span>
        <span class="search-doc-name">${escapeHtml(brand.name)}</span>
        <span class="search-doc-cnt">${cnt}</span>
      </button>`;
    }),
  ].join("");

  gridEl.querySelectorAll("[data-pick-doc]").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentFilter = btn.getAttribute("data-pick-doc") || "all";
      searchDocPickerOpen = false;
      renderSearchFilterChips();
      performSearch(searchInput.value);
      searchInput.focus();
    });
  });
}

// Multi-Tab Browser Management
function getActiveBrowserTab(): BrowserTab {
  return browserTabs.find((t) => t.id === activeBrowserTabId) || browserTabs[0];
}

function formatTabTitle(siteId: string, rawTitle?: string, pathOrUrl?: string): string {
  if (siteId === "home") return "57-Site Hub";
  if (siteId === "bookmarks") return "Saved Bookmarks";
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
  if (rightTabsSidebar) {
    rightTabsSidebar.classList.toggle("compact", rightTabsCompact);
  }
  document.body.classList.toggle("right-tabs-pinned-open", featureTabsEnabled && !rightTabsCompact);
  if (rightTabsCount) {
    rightTabsCount.textContent = String(browserTabs.length);
  }

  browserTabsList.innerHTML = browserTabs
    .map((t) => {
      const isActive = t.id === activeBrowserTabId;
      const isHome = t.siteId === "home";
      const isBookmarks = t.siteId === "bookmarks";
      const brand = getSiteBrand(t.siteId);
      const badgeHtml = isHome
        ? `<span class="browser-tab-badge home-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L12 3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 20v-9.5z"/><path d="M9 21.5v-7.5h6v7.5"/></svg></span>`
        : isBookmarks
        ? `<span class="browser-tab-badge bookmarks-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg></span>`
        : `<span class="browser-tab-badge" style="background: ${brand.bgTint}; color: ${brand.color}; border: 1px solid ${brand.color}44;">${brand.svg || escapeHtml(brand.badge)}</span>`;
      const showClose = browserTabs.length > 1 || !isHome;
      const subLabel = isHome
        ? "All 57 Docs"
        : isBookmarks
        ? `${bookmarksList.length} Saved Page${bookmarksList.length === 1 ? "" : "s"}`
        : `${brand.version} · ${t.pathOrUrl || "/"}`;
      const tabAccent = isHome ? "#ffffff" : isBookmarks ? "#f59e0b" : brand.color;
      const tabTint = isHome
        ? "rgba(255, 255, 255, 0.14)"
        : isBookmarks
        ? "rgba(245, 158, 11, 0.16)"
        : brand.bgTint;

      return `
        <div class="browser-tab-item ${isActive ? "active" : ""}" data-tab-id="${t.id}" style="--tab-accent: ${tabAccent}; --tab-tint: ${tabTint};" title="${escapeHtml(
        t.title
      )} (${escapeHtml(subLabel)})">
          <span class="tab-rail-pill"></span>
          ${badgeHtml}
          <div class="browser-tab-info">
            <span class="browser-tab-title">${escapeHtml(t.title)}</span>
            <span class="browser-tab-sub">${escapeHtml(subLabel)}</span>
          </div>
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
  if (isSpecialNativeView(tab.siteId) || !viewportContainer) return;
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
  if (isSpecialNativeView(tab.siteId)) return;

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

  const defaultEntryPath = tab.pathOrUrl || getDefaultEntryPath(tab.siteId);
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
        const loc = iframe.contentWindow?.location;
        const docPath = loc ? `${loc.pathname}${loc.search || ""}${loc.hash || ""}` : undefined;
        if (docPath) tab.pathOrUrl = docPath;
        tab.title = formatTabTitle(tab.siteId, docTitle, tab.pathOrUrl);
      } catch {}
      renderBrowserTabs();
      updateBookmarkUI();
    };
    iframe.src = url;
  } else {
    loadingEl.style.display = "none";
    syncReaderSettingsToAllIframes();
    updateBookmarkUI();
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
  if (target.siteId === "bookmarks") {
    renderBookmarksView();
  }
  updateBookmarkUI();

  if (titlebarCurrentView) {
    if (target.siteId === "home") {
      titlebarCurrentView.textContent = `${sites.length}-Site Hub`;
    } else if (target.siteId === "bookmarks") {
      titlebarCurrentView.textContent = `Saved Bookmarks (${bookmarksList.length})`;
    } else {
      const brand = getSiteBrand(target.siteId);
      titlebarCurrentView.textContent = `${brand.name} (${brand.version})`;
    }
  }

  // Hide legacy static panels and only show viewHome, viewBookmarks, or the active tab's panelEl
  [viewTailwind, viewShadcn, viewDynamic].forEach((v) => v?.classList.remove("active"));
  if (target.siteId === "home") {
    viewHome?.classList.add("active");
    viewBookmarks?.classList.remove("active");
  } else if (target.siteId === "bookmarks") {
    viewHome?.classList.remove("active");
    viewBookmarks?.classList.add("active");
  } else {
    viewHome?.classList.remove("active");
    viewBookmarks?.classList.remove("active");
    ensureTabDomPanel(target);
  }

  for (const t of browserTabs) {
    if (t.panelEl) {
      t.panelEl.classList.toggle("active", t.id === target.id && !isSpecialNativeView(target.siteId));
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
    renderServerRail(buildUnifiedSitesList());
  }
}

function openBlankPickerTab() {
  if (!featureTabsEnabled) {
    switchTab("home");
    return;
  }
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
  if (!featureTabsEnabled) return;
  const current = getActiveBrowserTab();
  if (!current || isSpecialNativeView(current.siteId)) {
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

// Tab / Server Switching (Supports Multi-Tab & Single-View Mode when Tabs Feature is OFF)
async function switchTab(tab: string, targetPathOrUrl?: string, forceNewTab = false) {
  // Single-View Mode when Browser Tabs feature is turned OFF: reuse a single tab to save RAM
  if (!featureTabsEnabled) {
    const single = browserTabs[0] || {
      id: `tab-${++tabSeq}`,
      siteId: "home",
      title: "57-Site Hub",
      pathOrUrl: "/",
    };
    if (browserTabs.length === 0) browserTabs.push(single);
    if (isSpecialNativeView(tab)) {
      if (single.panelEl) {
        single.panelEl.remove();
        single.panelEl = undefined;
        single.iframeEl = undefined;
        single.loadingEl = undefined;
      }
      single.siteId = tab;
      single.title = formatTabTitle(tab);
      single.pathOrUrl = tab === "bookmarks" ? "/bookmarks" : "/";
      activateBrowserTab(single.id);
      if (!sidebarPinned) scheduleCloseHoverSidebar(25);
      return;
    }
    const entryPath = targetPathOrUrl || getDefaultEntryPath(tab);
    const siteChanged = single.siteId !== tab || Boolean(targetPathOrUrl);
    single.siteId = tab;
    single.pathOrUrl = entryPath;
    single.title = formatTabTitle(tab, undefined, entryPath);
    activateBrowserTab(single.id);
    await loadTabFrame(single, siteChanged);
    if (!sidebarPinned) scheduleCloseHoverSidebar(25);
    return;
  }

  if (isSpecialNativeView(tab) && !forceNewTab) {
    const existingSpecial = browserTabs.find((t) => t.siteId === tab);
    if (existingSpecial) {
      activateBrowserTab(existingSpecial.id);
    } else {
      const specialTab: BrowserTab = {
        id: `tab-${++tabSeq}`,
        siteId: tab,
        title: formatTabTitle(tab),
        pathOrUrl: tab === "bookmarks" ? "/bookmarks" : "/",
      };
      if (tab === "home") {
        browserTabs.unshift(specialTab);
      } else {
        browserTabs.push(specialTab);
      }
      activateBrowserTab(specialTab.id);
    }
    if (!sidebarPinned) scheduleCloseHoverSidebar(25);
    return;
  }

  const defaultEntryPath = targetPathOrUrl || getDefaultEntryPath(tab);
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
    if (!sidebarPinned) scheduleCloseHoverSidebar(25);
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
    if (!sidebarPinned) scheduleCloseHoverSidebar(25);
    return;
  }

  // Case 3: Current tab is already on this exact site -> navigate within the current tab
  if (current && current.siteId === tab) {
    if (targetPathOrUrl) {
      current.pathOrUrl = targetPathOrUrl;
      current.title = formatTabTitle(tab, undefined, targetPathOrUrl);
      activateBrowserTab(current.id);
      await loadTabFrame(current, true);
    } else {
      activateBrowserTab(current.id);
    }
    if (!sidebarPinned) scheduleCloseHoverSidebar(25);
    return;
  }

  // Case 4: User is viewing Doc A (or Bookmarks) and clicks Doc B in the Sidebar/Search/Bookmarks:
  // If Doc B already has an open tab, switch to it (and navigate to targetPathOrUrl if specified);
  // otherwise open Doc B in a new tab so Doc A stays open in its tab!
  const existingSiteTab = browserTabs.find((t) => t.siteId === tab);
  if (existingSiteTab) {
    if (targetPathOrUrl && existingSiteTab.pathOrUrl !== targetPathOrUrl) {
      existingSiteTab.pathOrUrl = targetPathOrUrl;
      existingSiteTab.title = formatTabTitle(tab, undefined, targetPathOrUrl);
      activateBrowserTab(existingSiteTab.id);
      await loadTabFrame(existingSiteTab, true);
    } else {
      activateBrowserTab(existingSiteTab.id);
    }
    if (!sidebarPinned) scheduleCloseHoverSidebar(25);
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
    scheduleCloseHoverSidebar(25);
  }
}

function resolveUrl(site: string, pathOrUrl: string): string {
  const origin = getOrigin(site);
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    try {
      const parsed = new URL(pathOrUrl);
      return `${origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return `${origin}${getDefaultEntryPath(site)}`;
    }
  }
  return `${origin}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

// Universal Search Logic across all installed documentation packs
function scoreSearchEntries(q: string, tokens: string[], subTokens: string[], filterSite: string): SearchEntry[] {
  const scored: { item: SearchEntry; score: number }[] = [];

  for (let i = 0; i < searchIndex.length; i++) {
    const item = searchIndex[i];
    if (filterSite !== "all" && item.site !== filterSite) continue;

    const anyItem = item as any;
    const siteLower: string = anyItem._siteLower ?? `${item.site} ${getSiteBrand(item.site).name}`.toLowerCase();
    const titleLower: string = anyItem._titleLower ?? (item.title || "").toLowerCase();
    const descLower: string = anyItem._descLower ?? (item.description || item.preview || "").toLowerCase();
    const pathLower: string = anyItem._pathLower ?? (item.path || "").toLowerCase();
    const catLower: string = anyItem._catLower ?? (item.category || "").toLowerCase();
    const kwSet: Set<string> | undefined = anyItem._kwSet;
    const headingsLower: string =
      anyItem._headingsLower ??
      [...(item.keywords || []), ...(item.headings || [])].map((k) => k.toLowerCase()).join(" ");

    let score = 0;

    if (titleLower === q || titleLower === `std::${q}`) score += 160;
    else if (titleLower.startsWith(q) || titleLower.startsWith(`std::${q}`)) score += 95;
    else if (titleLower.includes(q)) score += 60;

    if (kwSet && (kwSet.has(q) || kwSet.has(`std::${q}`))) {
      score += 75;
    }

    if (pathLower.endsWith(`/${q}`) || pathLower.endsWith(`#${q}`)) {
      score += 80;
    } else if (pathLower.includes(`/${q}`) || pathLower.includes(`-${q}-`)) {
      score += 42;
    }

    if (item.site.toLowerCase() === q) score += 70;
    else if (siteLower.includes(q)) score += 28;

    let matchedTokens = 0;
    for (let t = 0; t < tokens.length; t++) {
      const token = tokens[t];
      let tokHit = false;
      if (titleLower.includes(token)) {
        score += 34;
        tokHit = true;
      }
      if (kwSet && kwSet.has(token)) {
        score += 40;
        tokHit = true;
      } else if (headingsLower.includes(token)) {
        score += 20;
        tokHit = true;
      }
      if (pathLower.includes(token)) {
        score += 18;
        tokHit = true;
      }
      if (catLower.includes(token)) {
        score += 12;
        tokHit = true;
      }
      if (descLower.includes(token)) {
        score += 14;
        tokHit = true;
      }
      if (siteLower.includes(token)) {
        score += 18;
        tokHit = true;
      }
      if (tokHit) matchedTokens++;
    }

    for (let s = 0; s < subTokens.length; s++) {
      const sub = subTokens[s];
      if (kwSet && kwSet.has(sub)) score += 28;
      else if (titleLower.includes(sub)) score += 18;
      else if (headingsLower.includes(sub)) score += 10;
    }

    if (tokens.length > 1 && matchedTokens === tokens.length) {
      score += 45;
    }

    if (score > 0 && activeTab !== "home" && item.site === activeTab) {
      score += 10;
    }

    if (score > 0) {
      scored.push({ item, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 75).map((r) => r.item);
}

function performSearch(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) {
    if (currentFilter !== "all") {
      currentResults = searchIndex.filter((item) => item.site === currentFilter).slice(0, 45);
    } else {
      // Showcase entries across all installed documentation packs (starting with active doc if open)
      const bySite = new Map<string, SearchEntry[]>();
      for (const item of searchIndex) {
        let arr = bySite.get(item.site);
        if (!arr) {
          arr = [];
          bySite.set(item.site, arr);
        }
        if (arr.length < 15) arr.push(item);
      }

      const mixed: SearchEntry[] = [];
      if (activeTab !== "home" && bySite.has(activeTab)) {
        mixed.push(...(bySite.get(activeTab) || []).slice(0, 8));
      }
      for (let round = 0; round < 3 && mixed.length < 48; round++) {
        for (const [siteId, arr] of bySite.entries()) {
          if (siteId === activeTab && round < 2) continue;
          if (arr[round]) {
            mixed.push(arr[round]);
            if (mixed.length >= 48) break;
          }
        }
      }
      currentResults = mixed;
    }
  } else {
    const tokens = q.split(/\s+/).filter(Boolean);
    const subTokens = q
      .split(/[\s:./()-]+/)
      .filter((t) => t.length >= 2 && !tokens.includes(t));

    let results = scoreSearchEntries(q, tokens, subTokens, currentFilter);
    // If a single-doc filter was active and had 0 matches, automatically search across all installed docs
    if (results.length === 0 && currentFilter !== "all") {
      results = scoreSearchEntries(q, tokens, subTokens, "all");
    }
    currentResults = results;
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

  const qLower = query.trim().toLowerCase();
  const qTokens = qLower ? qLower.split(/[\s:./()-]+/).filter((t) => t.length >= 2) : [];

  searchResultsList.innerHTML = currentResults
    .map((item, idx) => {
      const isSelected = idx === selectedIndex;
      const brand = getSiteBrand(item.site);
      let snippet = item.description || item.preview || item.path;

      if (qLower && !snippet.toLowerCase().includes(qLower)) {
        const matchedExtras = [...(item.headings || []), ...(item.keywords || [])]
          .filter((h) => {
            const hl = String(h).toLowerCase();
            return hl.includes(qLower) || qTokens.some((tk) => hl.includes(tk));
          })
          .slice(0, 5);
        if (matchedExtras.length > 0) {
          snippet = `${matchedExtras.join(", ")} — ${snippet}`;
        }
      }

      return `
        <div class="search-result-item ${isSelected ? "selected" : ""}" data-index="${idx}">
          <span class="result-badge" style="background: ${brand.bgTint}; color: ${brand.color}; border: 1px solid ${brand.color}44;">${escapeHtml(
        brand.name.length <= 10 ? brand.name : item.site.slice(0, 9)
      )}</span>
          <div class="result-info">
            <div class="result-top-line">
              <span class="result-title">${highlight(item.title, query)}</span>
              <span class="result-category">${escapeHtml(item.category || brand.name)}</span>
            </div>
            <p class="result-snippet">${highlight(snippet, query)}</p>
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
  const parts = Array.from(
    new Set(
      query
        .trim()
        .split(/[\s:./()-]+/)
        .filter((t) => t.length >= 2)
        .concat([query.trim()])
    )
  )
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex);
  if (parts.length === 0) return escaped;
  const regex = new RegExp(`(${parts.join("|")})`, "gi");
  return escaped.replace(
    regex,
    "<mark style='background:rgba(56,189,248,0.28);color:#fff;border-radius:2px;padding:0 2px;'>$1</mark>"
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
  searchDocPickerOpen = false;
  searchDocPickerQuery = "";
  const pickerInput = document.getElementById("searchDocPickerInput") as HTMLInputElement | null;
  if (pickerInput) pickerInput.value = "";
  renderSearchFilterChips();
  searchModal.classList.add("open");
  searchModal.setAttribute("aria-hidden", "false");
  searchInput.value = "";
  performSearch("");
  setTimeout(() => searchInput.focus(), 40);
}

function closeSearchModal() {
  searchDocPickerOpen = false;
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
  if (!cur || isSpecialNativeView(cur.siteId)) return null;
  return cur.iframeEl || null;
}

function setupEventListeners() {
  tabHome?.addEventListener("click", () => switchTab("home"));
  tabBookmarks?.addEventListener("click", (e) => {
    const me = e as MouseEvent;
    switchTab("bookmarks", undefined, me.ctrlKey || me.metaKey);
  });
  tabBookmarks?.addEventListener("auxclick", (e) => {
    const me = e as MouseEvent;
    if (me.button === 1) {
      me.preventDefault();
      switchTab("bookmarks", undefined, true);
    }
  });
  btnBookmarkPage?.addEventListener("click", () => toggleBookmarkCurrentPage());
  bookmarksFilterInput?.addEventListener("input", () => {
    bookmarksFilterQuery = bookmarksFilterInput.value;
    renderBookmarksView();
  });

  brandBtn?.addEventListener("click", () => switchTab("home"));
  titlebarBrandHome?.addEventListener("click", () => switchTab("home"));

  btnNewBrowserTab?.addEventListener("click", () => openBlankPickerTab());
  btnDuplicateBrowserTab?.addEventListener("click", () => duplicateActiveBrowserTab());
  btnToggleRightTabs?.addEventListener("click", () => {
    rightTabsCompact = !rightTabsCompact;
    try {
      localStorage.setItem("docx_right_tabs_compact", String(rightTabsCompact));
    } catch {}
    renderBrowserTabs();
  });

  drawerFilterInput?.addEventListener("input", () => {
    drawerFilterQuery = drawerFilterInput.value;
    renderChannelDrawer(buildUnifiedSitesList());
  });

  btnZoomOut?.addEventListener("click", () => setReaderZoom(readerZoom - 10));
  btnZoomReset?.addEventListener("click", () => setReaderZoom(100));
  btnZoomIn?.addEventListener("click", () => setReaderZoom(readerZoom + 10));
  btnToggleDarkSite?.addEventListener("click", () => toggleReaderDarkMode());

  // Features Popover Menu & Toggles (Browser Tabs, Theme Engine, Default Clean Font)
  btnFeaturesMenu?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!featuresPopover) return;
    const isOpen = featuresPopover.style.display !== "none";
    featuresPopover.style.display = isOpen ? "none" : "flex";
    btnFeaturesMenu.classList.toggle("active", !isOpen);
  });

  const closeFeaturesPopover = () => {
    if (!featuresPopover || featuresPopover.style.display === "none") return;
    featuresPopover.style.display = "none";
    btnFeaturesMenu?.classList.remove("active");
  };

  document.addEventListener(
    "pointerdown",
    (e) => {
      if (!featuresPopover || featuresPopover.style.display === "none") return;
      const target = e.target as HTMLElement | null;
      if (!target || !target.closest("#featuresMenuWrap")) {
        closeFeaturesPopover();
      }
    },
    true
  );

  document.addEventListener("click", (e) => {
    if (!featuresPopover || featuresPopover.style.display === "none") return;
    const target = e.target as HTMLElement | null;
    if (!target || !target.closest("#featuresMenuWrap")) {
      closeFeaturesPopover();
    }
  });

  window.addEventListener("blur", () => {
    closeFeaturesPopover();
  });

  toggleFeatureTabs?.addEventListener("change", () => {
    featureTabsEnabled = Boolean(toggleFeatureTabs.checked);
    applyFeatureFlags();
  });

  toggleFeatureTabHover?.addEventListener("change", () => {
    featureTabHoverExpand = Boolean(toggleFeatureTabHover.checked);
    applyFeatureFlags();
  });

  toggleFeatureTheme?.addEventListener("change", () => {
    featureThemeEnabled = Boolean(toggleFeatureTheme.checked);
    applyFeatureFlags();
  });

  toggleFeatureFont?.addEventListener("change", () => {
    featureFontEnabled = Boolean(toggleFeatureFont.checked);
    applyFeatureFlags();
  });

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

  document.getElementById("btnDownloadAllDocs")?.addEventListener("click", async () => {
    await downloadAllOrRemainingDocs();
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

  const pickerInput = document.getElementById("searchDocPickerInput") as HTMLInputElement | null;
  pickerInput?.addEventListener("input", () => {
    searchDocPickerQuery = pickerInput.value;
    renderSearchFilterChips();
  });

  // Cross-iframe messages for Ctrl+K, Zoom, Dark Reader, Multi-Tab, Fullscreen, Bookmark, and Edge Hover
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
        updateBookmarkUI();
      }
      syncReaderSettingsToAllIframes();
    } else if (e.data.type === "DOCX_TOGGLE_BOOKMARK") {
      toggleBookmarkCurrentPage();
    } else if (e.data.type === "DOCX_SITE_THEME_CHANGED") {
      if (e.data.siteId) {
        setSiteDarkMode(String(e.data.siteId), Boolean(e.data.darkMode), false);
      }
    } else if (e.data.type === "DOCX_TOGGLE_FULLSCREEN") {
      toggleAppFullscreen();
    } else if (e.data.type === "DOCX_OPEN_NEW_TAB") {
      const siteId = String(e.data.siteId || activeTab);
      const urlOrPath = String(e.data.url || "/docs");
      if (siteId && !isSpecialNativeView(siteId)) {
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
      const iframeY = typeof e.data.clientY === "number" ? e.data.clientY : -1;
      const vTop = viewportContainer ? viewportContainer.getBoundingClientRect().top : 38;
      const parentY = iframeY >= 0 ? vTop + iframeY : lastPointerY;
      lastPointerX = 12;
      if (parentY >= 0) lastPointerY = parentY;
      openHoverSidebar(parentY);
      if (iframeY >= 0 && iframeY <= 68) {
        openHoverDrawer();
      }
    } else if (e.data.type === "HOVER_RIGHT_EDGE") {
      if (rightTabsSidebar) {
        const rRect = rightTabsSidebar.getBoundingClientRect();
        lastPointerX = rRect.left + 12;
      }
      openHoverRightTabs();
    } else if (e.data.type === "IFRAME_CURSOR_CENTER") {
      lastPointerX = 420;
      if (rightTabsSidebar?.classList.contains("hover-open") && !rightTabsSidebar.matches(":hover")) {
        scheduleCloseHoverRightTabs(0);
      }
      if (
        (discordSidebar.classList.contains("open") || discordSidebar.classList.contains("drawer-hover-open")) &&
        !discordSidebar.matches(":hover")
      ) {
        scheduleCloseHoverDrawer(0);
        scheduleCloseHoverSidebar(0);
      }
    } else if (e.data.type === "HOVER_TOP_EDGE") {
      peekTopbar();
    } else if (e.data.type === "IFRAME_INTERACT") {
      closeFeaturesPopover();
      rightTabsSidebar?.classList.remove("hover-open");
      discordSidebar.classList.remove("drawer-hover-open");
      if (!sidebarPinned) {
        discordSidebar.classList.remove("open");
      }
      if (topbarHidden) {
        document.body.classList.remove("topbar-peek");
      }
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeFeaturesPopover();
    }

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

    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "d") {
      e.preventDefault();
      toggleBookmarkCurrentPage();
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
    if (cur && !isSpecialNativeView(cur.siteId)) {
      loadTabFrame(cur, true);
    }
  });

  btnExternal?.addEventListener("click", () => {
    const cur = getActiveBrowserTab();
    if (cur && !isSpecialNativeView(cur.siteId)) {
      window.open(resolveUrl(cur.siteId, cur.pathOrUrl || "/docs"), "_blank");
    }
  });
}

init();

