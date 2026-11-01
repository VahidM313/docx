import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { Browser } from "playwright";
import { buildPack, parsePack, SEARCH_ROUTE, type PackAsset, type ParsedPack } from "./lib/docpack-v3";
import { compressImages } from "./lib/compress-images";
import { looksFingerprinted, normalizeHtml, stableAssetKey } from "./lib/normalize-html";

import siteCatalog from "../docs-desktop/sites.json";

export interface SiteConfig {
  id: string;
  name: string;
  version: string;
  origin: string;
  entryPath: string;
  allowedPrefixes: string[];
  maxPages?: number;
  userAgent?: string;
  customHeaders?: Record<string, string>;
  /** An official copy of a site that refuses CI runners, read in its place. */
  mirror?: { url: string; path: string };
  /** The whole site is a page or two, so a small crawl is not a failed one. */
  singlePage?: boolean;
  /** Paths to leave out, as a regular expression: old-version archives repeat the docs. */
  excludePattern?: string;
  /** Every address serves an empty shell, so pages are read from a real browser. */
  rendered?: boolean;
  /** Refuses GitHub's runners: scripts/build-local.ts builds it, and CI leaves it alone. */
  localBuild?: boolean;
}
/**
 * Crawl/pack configuration, sourced from `docs-desktop/sites.json`
 * (generated from the atomic per-site sources in `docs-desktop/sites.d/*.json`).
 */
export const SITE_CATALOG: SiteConfig[] = siteCatalog.sites.map((s: any) => ({
  id: s.id,
  name: s.name,
  version: s.version,
  origin: s.origin ?? "",
  entryPath: s.entryPath,
  allowedPrefixes: s.allowedPrefixes ?? [],
  maxPages: s.maxPages,
  mirror: s.mirror,
  singlePage: s.singlePage,
  excludePattern: s.excludePattern,
  rendered: s.rendered,
  localBuild: s.localBuild,
}));

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Sites whose pages only work with their own JavaScript bundles and data. */
const SCRIPTED_SITES = new Set(["angular", "nestjs", "threejs", "rust", "lucide"]);

/** A site's `maxPages` is a floor on how much we want, not a reason to ship a partial copy. */
const PAGE_CAP_FLOOR = Number(process.env.DOCX_PAGE_CAP_FLOOR || 1500);
const CRAWL_BUDGET_MS = Number(process.env.DOCX_CRAWL_BUDGET_MINUTES || 20) * 60_000;
const MAX_SITEMAPS = 24;

const ASSET_PLACEHOLDER = /\/__docx_assets\/[0-9a-f]{14}\.[a-z0-9]+/g;

function getInjectedSnippet(_origin: string): string {
  // Runtime scrollbar, interactive UI controllers, and per-site dark/light sync
  // are injected dynamically by inject_reader_bridge in lib.rs.
  return "";
}

function guessMime(urlPath: string, contentTypeHeader?: string | null): string {
  if (contentTypeHeader && !contentTypeHeader.includes("octet-stream")) {
    return contentTypeHeader.split(";")[0].trim() + (contentTypeHeader.includes("text/") ? "; charset=utf-8" : "");
  }
  const clean = urlPath.split("?")[0].toLowerCase();
  if (clean.endsWith(".css")) return "text/css; charset=utf-8";
  if (clean.endsWith(".js") || clean.endsWith(".mjs")) return "application/javascript; charset=utf-8";
  if (clean.endsWith(".svg")) return "image/svg+xml";
  if (clean.endsWith(".woff2")) return "font/woff2";
  if (clean.endsWith(".woff")) return "font/woff";
  if (clean.endsWith(".ttf")) return "font/ttf";
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return "image/jpeg";
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".gif")) return "image/gif";
  if (clean.endsWith(".ico")) return "image/x-icon";
  if (clean.endsWith(".json")) return "application/json; charset=utf-8";
  return "text/html; charset=utf-8";
}

function normalizeRouteKey(pathname: string): string {
  let p = pathname || "/";
  if (!p.startsWith("/")) p = "/" + p;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

function assetUrlToLocalRoute(fullUrl: string, siteOrigin: string, keepFingerprintedPaths: boolean): string {
  try {
    const u = new URL(fullUrl, siteOrigin);
    if (u.origin === siteOrigin && !u.search && (keepFingerprintedPaths || !looksFingerprinted(u.pathname))) {
      return u.pathname;
    }
    const extMatch = u.pathname.match(/\.(css|js|woff2|woff|ttf|svg|png|jpg|jpeg|webp|ico|gif)$/i);
    const ext = extMatch ? extMatch[0].toLowerCase() : u.pathname.includes("load.php") ? ".css" : ".bin";
    const hash = crypto.createHash("sha256").update(u.href).digest("hex").slice(0, 14);
    return `/__docx_assets/${hash}${ext}`;
  } catch {
    return fullUrl;
  }
}

let browser: Promise<Browser> | null = null;
/** Code the rendered pages loaded. The app needs it all offline, and only a browser sees lazy chunks. */
const renderedCode = new Set<string>();

/** The page as a browser sees it once its scripts have run, or null to retry on a later crawl. */
async function fetchRendered(url: string): Promise<Response | null> {
  browser ??= import("playwright").then(({ chromium }) => chromium.launch());
  const page = await (await browser).newPage({ userAgent: USER_AGENT });
  // Only the site's own code shapes the page; ads and analytics would just hold up "networkidle"
  const { origin } = new URL(url);
  await page.route("**/*", (route) => {
    const request = route.request();
    const own = new URL(request.url()).origin === origin && !["image", "font", "media"].includes(request.resourceType());
    return own ? route.continue() : route.abort();
  });
  page.on("response", (response) => {
    const type = response.request().resourceType();
    if (response.ok() && new URL(response.url()).origin === origin && ["script", "fetch", "xhr"].includes(type)) {
      renderedCode.add(response.url());
    }
  });
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    const res = new Response(await page.content(), { headers: { "content-type": "text/html; charset=utf-8" } });
    Object.defineProperty(res, "url", { value: page.url() });
    return res;
  } catch {
    return null;
  } finally {
    await page.close();
  }
}

/** Keeps a renamed page's old address working offline, at the cost of a few bytes. */
function redirectPage(to: string): PackAsset {
  const html = `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${to}"><a href="${to}">${to}</a>`;
  return { bytes: Buffer.from(html, "utf-8"), mime: "text/html; charset=utf-8" };
}

function isChallengeOrBlockHtml(html: string): boolean {
  if (!html || html.length < 120) return true;
  const sample = html.slice(0, 4096).toLowerCase();
  return (
    sample.includes("<title>just a moment...</title>") ||
    sample.includes("attention required! | cloudflare") ||
    sample.includes("cf-browser-verification") ||
    sample.includes("cf-chl-bypass") ||
    sample.includes("<title>access denied</title>") ||
    sample.includes("<title>403 forbidden</title>") ||
    sample.includes("<title>429 too many requests</title>")
  );
}

const FIREFOX_UA = "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0";
const BOT_UA = "DocxCrawler/1.0";

function mirrorUrl(url: string, site?: SiteConfig): string | null {
  if (!site?.mirror) return null;
  const u = new URL(url);
  if (u.origin !== site.origin || !u.pathname.startsWith(site.mirror.path)) return null;
  return site.mirror.url + u.pathname.slice(site.mirror.path.length);
}

/** Git hosts serve everything as text/plain, so the file name decides the type here. */
async function fetchFromMirror(mirrored: string, url: string, timeoutMs: number): Promise<Response | null> {
  try {
    const res = await fetch(mirrored, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return res;
    return new Response(await res.arrayBuffer(), { headers: { "content-type": guessMime(new URL(url).pathname) } });
  } catch {
    return null;
  }
}

async function fetchWithTimeout(
  url: string,
  timeoutMs = 12000,
  maxRetries = 4,
  onRateLimited?: () => void,
  siteConfig?: SiteConfig
): Promise<Response | null> {
  const mirrored = mirrorUrl(url, siteConfig);
  if (mirrored) return fetchFromMirror(mirrored, url, timeoutMs);

  let originReferer = "";
  try {
    originReferer = new URL(url).origin + "/";
  } catch {}

  const isMysql = siteConfig?.id === "mysql" || url.includes("mysql.com");
  const isFirefoxTarget =
    siteConfig?.id === "opencv" ||
    siteConfig?.id === "tensorflow" ||
    url.includes("opencv.org") ||
    url.includes("tensorflow.org");

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    let ua = USER_AGENT;
    let sendSecChUa = true;

    if (siteConfig?.userAgent) {
      ua = siteConfig.userAgent;
      sendSecChUa = false;
    } else if (isMysql) {
      ua = BOT_UA;
      sendSecChUa = false;
    } else if (isFirefoxTarget || attempt >= 1) {
      ua = FIREFOX_UA;
      sendSecChUa = false;
    }

    if (attempt >= 2 && !isMysql) {
      ua = BOT_UA;
      sendSecChUa = false;
    }

    const headers: Record<string, string> = {
      "User-Agent": ua,
      "Accept": "text/html,application/xhtml+xml,text/css,application/javascript,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      ...(originReferer ? { Referer: originReferer } : {}),
      ...(siteConfig?.customHeaders || {}),
    };

    if (sendSecChUa) {
      headers["Sec-Ch-Ua"] = '"Chromium";v="131", "Not_A Brand";v="24"';
      headers["Sec-Ch-Ua-Mobile"] = "?0";
      headers["Sec-Ch-Ua-Platform"] = '"Windows"';
      headers["Sec-Fetch-Dest"] = "document";
      headers["Sec-Fetch-Mode"] = "navigate";
      headers["Sec-Fetch-Site"] = "same-origin";
      headers["Upgrade-Insecure-Requests"] = "1";
    }

    try {
      const res = await fetch(url, {
        headers,
        redirect: "follow",
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.status === 429 || res.status === 503 || res.status === 502 || res.status === 403) {
        onRateLimited?.();
        if (attempt + 1 < maxRetries) {
          const retryHeader = res.headers.get("retry-after");
          const retrySec = retryHeader ? parseInt(retryHeader, 10) : NaN;
          const waitMs =
            !isNaN(retrySec) && retrySec > 0 && retrySec <= 30
              ? retrySec * 1000
              : 800 * Math.pow(2, attempt) + Math.floor(Math.random() * 350);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
      }
      return res;
    } catch {
      clearTimeout(timer);
      if (attempt + 1 < maxRetries) {
        const waitMs = 600 * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
  }
  return null;
}

function isTransientFailure(res: Response | null): boolean {
  return !res || res.status === 403 || res.status === 429 || res.status >= 500;
}

/** Page paths listed in robots.txt sitemaps; finds pages that only JavaScript navigation links to. */
async function discoverSitemapPages(site: SiteConfig, accept: (u: URL) => boolean): Promise<string[]> {
  const queue = new Set<string>();
  const robots = await fetchWithTimeout(`${site.origin}/robots.txt`, 8000, 2, undefined, site);
  if (robots?.ok) {
    for (const m of (await robots.text()).matchAll(/^\s*sitemap:\s*(\S+)/gim)) queue.add(m[1]);
  }
  queue.add(`${site.origin}/sitemap.xml`);
  queue.add(`${site.origin}/sitemap_index.xml`);
  const prefix = site.allowedPrefixes.find((p) => p.length > 1)?.replace(/\/?$/, "/");
  if (prefix) queue.add(`${site.origin}${prefix}sitemap.xml`);

  const pages = new Set<string>();
  let fetched = 0;
  for (const url of queue) {
    if (fetched++ >= MAX_SITEMAPS) break;
    const res = await fetchWithTimeout(url, 10000, 2, undefined, site);
    if (!res?.ok) continue;
    const xml = await res.text();
    const isIndex = /<sitemapindex\b/i.test(xml);
    for (const m of xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)/gi)) {
      if (isIndex) {
        if (!m[1].endsWith(".gz")) queue.add(m[1]);
        continue;
      }
      try {
        const u = new URL(m[1].replace(/&amp;/g, "&"));
        if (accept(u)) pages.add(u.pathname);
      } catch {}
    }
  }
  return [...pages].sort();
}

/**
 * Gives fetched assets names that survive redeploys. During the crawl each URL has
 * a unique placeholder route; afterwards URLs are named by their fingerprint-free
 * key. URLs that collapse to the same key are different files, so they get ordinals.
 */
function applyStableAssetRoutes(rawAssets: Map<string, PackAsset>, assetUrls: Map<string, string>): Map<string, string> {
  const groups = new Map<string, string[]>();
  for (const [url, route] of assetUrls) {
    if (!route.startsWith("/__docx_assets/")) continue;
    const key = stableAssetKey(url);
    groups.set(key, [...(groups.get(key) ?? []), url]);
  }

  const renamed = new Map<string, string>();
  for (const [key, urls] of groups) {
    const stem = crypto.createHash("sha256").update(key).digest("hex").slice(0, 14);
    urls.sort().forEach((url, i) => {
      const route = assetUrls.get(url)!;
      renamed.set(route, `/__docx_assets/${stem}${i ? `-${i}` : ""}${path.extname(route)}`);
    });
  }

  for (const [route, asset] of [...rawAssets]) {
    let next = asset;
    if (asset.mime.startsWith("text/html") || asset.mime.startsWith("text/css")) {
      const text = asset.bytes.toString("utf-8");
      const rewritten = text.replace(ASSET_PLACEHOLDER, (m) => renamed.get(m) ?? m);
      if (rewritten !== text) next = { bytes: Buffer.from(rewritten, "utf-8"), mime: asset.mime };
    }
    const nextRoute = renamed.get(route) ?? route;
    if (nextRoute !== route) rawAssets.delete(route);
    rawAssets.set(nextRoute, next);
  }
  return renamed;
}

/** `routes` plus every route of `pack` they reference, so carried pages keep their styles and images. */
function withReferencedRoutes(pack: ParsedPack, routes: Set<string>): Set<string> {
  const closure = new Set<string>();
  const pending = [...routes];
  while (pending.length) {
    const route = pending.pop()!;
    if (closure.has(route) || !pack.index.p[route]) continue;
    closure.add(route);
    const mime = pack.mimeOf(route) ?? "";
    if (!mime.startsWith("text/html") && !mime.startsWith("text/css")) continue;
    const text = pack.readRoute(route)!.toString("utf-8");
    for (const m of text.matchAll(/(?:href|src)=["'](\/[^"'#?]+)|url\(["']?(\/[^"')#?]+)/gi)) {
      const target = m[1] || m[2];
      if (!pack.mimeOf(target)?.startsWith("text/html")) pending.push(target);
    }
  }
  return closure;
}

/** The pack to build on, from the library. */
function loadPreviousPack(docpackPath: string) {
  if (!fs.existsSync(docpackPath)) return null;
  try {
    return parsePack(fs.readFileSync(docpackPath));
  } catch (e: any) {
    console.warn(`  Ignoring previous pack ${path.basename(docpackPath)}: ${e?.message}`);
    return null;
  }
}

function writePack(docpackPath: string, bytes: Uint8Array) {
  // Write beside the target first: a killed job must not leave a half-written pack to reuse
  fs.writeFileSync(`${docpackPath}.tmp`, bytes);
  fs.renameSync(`${docpackPath}.tmp`, docpackPath);
}

export type BuildResult = "built" | "unchanged" | "kept";

export async function buildDocpackForSite(siteId: string, outDir: string): Promise<BuildResult> {
  const site = SITE_CATALOG.find((s) => s.id === siteId);
  if (!site) throw new Error(`Unknown site id: ${siteId}`);

  fs.mkdirSync(outDir, { recursive: true });
  console.log(`\n=== Crawling Real Website for [${site.id}] (${site.origin}${site.entryPath}) ===`);

  const docpackPath = path.join(outDir, `${site.id}.docpack`);
  // Chunks are reused from this pack, and it guards against a partial/rate-limited crawl replacing a healthy one
  const keepScripts = SCRIPTED_SITES.has(site.id);
  const previous = loadPreviousPack(docpackPath);
  const previousRouteCount = previous?.meta.routeCount ?? 0;
  const previousPageCount = previous
    ? Object.keys(previous.index.p).filter((route) => previous.mimeOf(route)?.startsWith("text/html")).length
    : 0;
  // Keeping the old content must not keep the old compression
  const keepPrevious = (): BuildResult => {
    if (!previous || previous.meta.dict) return "kept";
    const { id, name, version, origin, entryPath } = site;
    const rebuilt = buildPack({
      id, name, version, origin, entryPath,
      assets: new Map(),
      carriedRoutes: Object.keys(previous.index.p),
      previous,
      truncated: previous.meta.truncated,
    });
    if (rebuilt.unchanged) return "kept";
    writePack(docpackPath, rebuilt.bytes);
    return "built";
  };

  const crawlDeadline = Date.now() + CRAWL_BUDGET_MS;
  const maxPages = Math.max(site.maxPages || 150, PAGE_CAP_FLOOR);
  const visitedPages = new Set<string>();
  const pageQueue: string[] = [site.entryPath];
  const queuedPages = new Set<string>([normalizeRouteKey(site.entryPath)]);
  const enqueuePage = (pagePath: string) => {
    const norm = normalizeRouteKey(pagePath);
    if (visitedPages.has(norm) || queuedPages.has(norm)) return;
    queuedPages.add(norm);
    pageQueue.push(pagePath);
  };
  // Routes a refetch could not confirm; their previous bytes are kept instead of losing them
  const unconfirmedRoutes = new Set<string>();
  const unconfirmedAssets = new Set<string>();

  // Map of localRouteKey -> { bytes: Buffer, mime: string }
  const rawAssets = new Map<string, PackAsset>();
  const pendingAssetUrls = new Map<string, string>(); // fullUrl -> localRoute
  const searchEntries: any[] = [];

  function isAllowedPageUrl(u: URL): boolean {
    if (u.origin !== site.origin) return false;
    if (/\.(png|jpg|jpeg|gif|webp|svg|ico|css|js|mjs|woff2?|ttf|pdf|zip|gz|xml|json)$/i.test(u.pathname)) {
      return false;
    }
    // An escaped "#" is a broken in-page link, and shells answer those with a 200
    if (u.pathname.includes("%23")) return false;
    if (site.excludePattern && new RegExp(site.excludePattern).test(u.pathname)) return false;
    return site.allowedPrefixes.some((pref) => u.pathname.startsWith(pref));
  }

  // Adaptive polite concurrency across ALL 57 sites (steps down automatically if any rate-limit signal occurs)
  let batchConcurrency = 6;
  let batchDelayMs = 100;
  const handleRateLimitSignal = () => {
    batchConcurrency = 2;
    batchDelayMs = 450;
  };

  const sitemapPages = await discoverSitemapPages(site, isAllowedPageUrl);
  if (sitemapPages.length) console.log(`  Sitemaps list ${sitemapPages.length} pages`);
  sitemapPages.forEach(enqueuePage);

  const redirects = new Map<string, string>();

  // 1. Crawl HTML pages concurrently in polite batches
  while (pageQueue.length > 0 && visitedPages.size < maxPages && Date.now() < crawlDeadline) {
    const batch: string[] = [];
    while (pageQueue.length > 0 && batch.length < batchConcurrency && visitedPages.size + batch.length < maxPages) {
      const nextPath = pageQueue.shift()!;
      const norm = normalizeRouteKey(nextPath.split("?")[0].split("#")[0]);
      if (!visitedPages.has(norm)) {
        visitedPages.add(norm);
        batch.push(nextPath);
      }
    }
    if (batch.length === 0) break;

    if (visitedPages.size > batch.length) {
      const jitter = Math.floor(Math.random() * 70);
      await new Promise((r) => setTimeout(r, batchDelayMs + jitter));
    }

    await Promise.all(
      batch.map(async (relPath) => {
        const fullUrl = new URL(relPath, site.origin).href;
        const res = site.rendered ? await fetchRendered(fullUrl) : await fetchWithTimeout(fullUrl, 12000, 4, handleRateLimitSignal, site);
        const requestedRoute = normalizeRouteKey(relPath.split("?")[0].split("#")[0]);
        if (!res || !res.ok) {
          if (isTransientFailure(res)) unconfirmedRoutes.add(requestedRoute);
          return;
        }
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("html")) return;

        let html = await res.text();
        if (isChallengeOrBlockHtml(html)) {
          unconfirmedRoutes.add(requestedRoute);
          return;
        }
        const pageUrl = new URL(res.url || fullUrl);
        const routeKey = normalizeRouteKey(pageUrl.pathname);
        if (routeKey !== requestedRoute && pageUrl.origin === site.origin) redirects.set(requestedRoute, pageUrl.pathname);

        // Extract title & description for Universal Search (Ctrl+K)
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const rawTitle = titleMatch
          ? titleMatch[1].replace(/\s+/g, " ").trim()
          : routeKey.split("/").pop() || site.name;
        const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
        const rawDesc = descMatch ? descMatch[1].trim() : `${site.name} documentation — ${rawTitle}`;

        searchEntries.push({
          id: `${site.id}:${routeKey}`,
          site: site.id,
          siteName: site.name,
          title: rawTitle,
          category: site.name,
          description: rawDesc,
          path: pageUrl.pathname,
          url: pageUrl.pathname,
          keywords: [site.id, ...rawTitle.toLowerCase().split(/\W+/).filter(Boolean)].slice(0, 12),
        });

        // Discover same-origin page links <a href="..."> and frames <frame src="...">
        const hrefRegex = /<(?:a\b[^>]*?\bhref|frame\b[^>]*?\bsrc|iframe\b[^>]*?\bsrc)=(?:"([^"'#]+)[^"']*"|'([^"'#]+)[^"']*'|([^\s>"'#]+))/gi;
        let m: RegExpExecArray | null;
        while ((m = hrefRegex.exec(html)) !== null) {
          const rawHref = (m[1] || m[2] || m[3] || "").trim();
          if (!rawHref || rawHref.startsWith("mailto:") || rawHref.startsWith("javascript:")) continue;
          try {
            let effectiveHref = rawHref;
            if (site.id === "threejs" && pageUrl.pathname.startsWith("/docs") && /^[A-Za-z0-9_.-]+\.html$/i.test(rawHref)) {
              effectiveHref = `/docs/pages/${rawHref}`;
            }
            const resolved = new URL(effectiveHref, pageUrl.href);
            if (isAllowedPageUrl(resolved) && pageQueue.length < maxPages * 2) {
              enqueuePage(resolved.pathname);
            }
          } catch {}
        }

        // Discover and rewrite stylesheets <link rel="stylesheet"|"preload stylesheet" href="...">
        // Handles both quoted and unquoted attributes (e.g. Qdrant) and strips SRI integrity/crossorigin hashes (e.g. Git, Cobra)
        html = html.replace(/<link\b([^>]*?)>/gi, (fullTag, attrs) => {
          const relMatch = attrs.match(/\brel=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
          const relVal = (relMatch ? (relMatch[1] || relMatch[2] || relMatch[3] || "") : "").toLowerCase();
          const isStyleOrIcon = relVal.includes("stylesheet") || relVal.includes("icon");
          const isLucideModule = site.id === "lucide" && relVal.includes("modulepreload");
          if (!isStyleOrIcon && !isLucideModule) {
            return fullTag;
          }
          const hrefMatch = attrs.match(/\bhref=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
          if (!hrefMatch) return fullTag;
          const rawHref = (hrefMatch[1] || hrefMatch[2] || hrefMatch[3] || "").trim();
          try {
            const resolved = new URL(rawHref.replace(/&amp;/g, "&"), pageUrl.href);
            const localRoute = assetUrlToLocalRoute(resolved.href, site.origin, keepScripts);
            pendingAssetUrls.set(resolved.href, localRoute);
            let cleanedAttrs = attrs
              .replace(/\bintegrity=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
              .replace(/\bcrossorigin=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
            cleanedAttrs = cleanedAttrs.replace(/\bhref=(?:"[^"]*"|'[^']*'|[^\s>]+)/i, `href="${localRoute}"`);
            cleanedAttrs = cleanedAttrs.replace(/\brel=(?:"preload stylesheet"|'preload stylesheet')/i, 'rel="stylesheet"');
            return `<link ${cleanedAttrs.trim()}>`;
          } catch {
            return fullTag;
          }
        });

        // Discover and rewrite images <img src="..."> (remove srcset so browser uses local src, handle unquoted src)
        html = html
          .replace(/\bsrcset=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
          .replace(/<img\b([^>]*?)>/gi, (fullMatch, attrs) => {
            const srcMatch = attrs.match(/\bsrc=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
            if (!srcMatch) return fullMatch;
            const rawSrc = (srcMatch[1] || srcMatch[2] || srcMatch[3] || "").trim();
            if (rawSrc.startsWith("data:")) return fullMatch;
            try {
              const resolved = new URL(rawSrc.replace(/&amp;/g, "&"), pageUrl.href);
              // Sample photos are requested far larger than a doc shows them
              if (resolved.hostname === "images.unsplash.com") {
                resolved.searchParams.set("w", "800");
                resolved.searchParams.set("q", "70");
              }
              const localRoute = assetUrlToLocalRoute(resolved.href, site.origin, keepScripts);
              pendingAssetUrls.set(resolved.href, localRoute);
              const cleanedAttrs = attrs.replace(/\bsrc=(?:"[^"]*"|'[^']*'|[^\s>]+)/i, `src="${localRoute}"`);
              return `<img ${cleanedAttrs.trim()}>`;
            } catch {
              return fullMatch;
            }
          });

        if (keepScripts) {
          // Keep same-origin JS bundles for SPA sites, Lucide icon search/filtering, Three.js page scripts & Rust mdBook highlight/book scripts
          html = html.replace(
            /<script\b([^>]*?)>\s*<\/script>/gi,
            (fullScript, attrs) => {
              const srcMatch = attrs.match(/\bsrc=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
              if (!srcMatch) return fullScript;
              const rawSrc = (srcMatch[1] || srcMatch[2] || srcMatch[3] || "").trim();
              try {
                const resolved = new URL(rawSrc.replace(/&amp;/g, "&"), pageUrl.href);
                if (resolved.origin !== site.origin) return "";
                const localRoute = assetUrlToLocalRoute(resolved.href, site.origin, keepScripts);
                pendingAssetUrls.set(resolved.href, localRoute);
                const cleanedAttrs = attrs.replace(/\bsrc=(?:"[^"]*"|'[^']*'|[^\s>]+)/i, `src="${localRoute}"`);
                return `<script ${cleanedAttrs.trim()}></script>`;
              } catch {
                return "";
              }
            }
          );
        } else {
          // Remove external client-side hydration/analytics <script src="..."> that would fail or overwrite SSR DOM on localhost
          html = html.replace(/<script\b[^>]*?\bsrc=["'][^"']+["'][^>]*>\s*<\/script>/gi, "");
        }

        // Rewrite absolute origin links inside href="..." to root-relative paths
        const escapedOrigin = site.origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        html = html.replace(new RegExp(`href=["']${escapedOrigin}(/[^"']*)["']`, "gi"), 'href="$1"');

        // Inject <base href> so relative URLs (like cppreference href="cpp/language" or threejs pages/) resolve accurately
        if (!/<base\b/i.test(html) && /<head[^>]*>/i.test(html)) {
          const baseHref =
            site.id === "threejs" && (pageUrl.pathname === "/docs" || pageUrl.pathname === "/docs/")
              ? "/docs/"
              : pageUrl.pathname;
          html = html.replace(/(<head[^>]*>)/i, `$1<base href="${baseHref}">`);
        }

        // Inject Docx scrollbar + dark mode + link navigation bridge before </body>
        const snippet = getInjectedSnippet(site.origin);
        if (site.id === "lucide") {
          html = html.replace("</body>", `<script src="/assets/docx-lucide-bundle.js"></script>${snippet}</body>`);
        } else if (html.includes("</body>")) {
          html = html.replace("</body>", `${snippet}</body>`);
        } else {
          html += snippet;
        }

        const htmlBytes = Buffer.from(normalizeHtml(html, { keepScripts }), "utf-8");
        rawAssets.set(routeKey, { bytes: htmlBytes, mime: "text/html; charset=utf-8" });
        if (pageUrl.pathname !== routeKey) {
          rawAssets.set(pageUrl.pathname, { bytes: htmlBytes, mime: "text/html; charset=utf-8" });
        }
      })
    );
  }

  for (const url of renderedCode) pendingAssetUrls.set(url, new URL(url).pathname);

  // Extra SPA / Viewer assets for Three.js, NestJS, and Angular
  if (site.id === "threejs") {
    pendingAssetUrls.set("https://threejs.org/files/main.css", "/files/main.css");
    pendingAssetUrls.set("https://threejs.org/files/page.css", "/files/page.css");
    pendingAssetUrls.set("https://threejs.org/files/page.js", "/files/page.js");
    pendingAssetUrls.set("https://threejs.org/docs/search.json", "/docs/search.json");
  } else if (site.id === "angular") {
    pendingAssetUrls.set("https://v17.angular.io/light-theme.css", "/light-theme.css");
    pendingAssetUrls.set("https://v17.angular.io/dark-theme.css", "/dark-theme.css");
    pendingAssetUrls.set("https://v17.angular.io/generated/navigation.json", "/generated/navigation.json");
    pendingAssetUrls.set("https://v17.angular.io/generated/docs/docs.json", "/generated/docs/docs.json");
    const navRes = await fetchWithTimeout("https://v17.angular.io/generated/navigation.json", 10000, 4, handleRateLimitSignal);
    if (navRes && navRes.ok) {
      const navText = await navRes.text();
      rawAssets.set("/generated/navigation.json", {
        bytes: Buffer.from(navText, "utf-8"),
        mime: "application/json; charset=utf-8",
      });
      const urlMatches = [...navText.matchAll(/"url"\s*:\s*"([^"]+)"/g)]
        .map((m) => m[1])
        .filter((u) => !u.startsWith("http") && !u.includes("#"))
        .slice(0, 140);
      for (const u of urlMatches) {
        const cleanU = u.replace(/^\/+/, "");
        pendingAssetUrls.set(
          `https://v17.angular.io/generated/docs/${cleanU}.json`,
          `/generated/docs/${cleanU}.json`
        );
      }
    }
  }

  const truncated = pageQueue.length > 0;
  console.log(
    `  Crawled ${visitedPages.size} HTML pages for ${site.id}${truncated ? ` (${pageQueue.length} left unvisited)` : ""}, now fetching ${pendingAssetUrls.size} CSS/JS/JSON/image assets...`
  );

  // 2. Download all discovered CSS and image assets + fonts referenced inside CSS (polite batches of 8)
  const fontAndSubAssets = new Map<string, string>();
  const assetEntries = Array.from(pendingAssetUrls.entries());

  for (let i = 0; i < assetEntries.length; i += 8) {
    if (i > 0) await new Promise((r) => setTimeout(r, 60));
    const slice = assetEntries.slice(i, i + 8);
    await Promise.all(
      slice.map(async ([fullUrl, localRoute]) => {
        const normKey = normalizeRouteKey(localRoute);
        if (rawAssets.has(normKey)) return;
        const res = await fetchWithTimeout(fullUrl, 10000, 3, handleRateLimitSignal, site);
        if (!res || !res.ok) {
          if (isTransientFailure(res)) unconfirmedAssets.add(localRoute);
          return;
        }
        const ct = res.headers.get("content-type") || "";
        const mime = guessMime(localRoute, ct);
        // A missing asset on a single-page site comes back as its shell
        if (mime.startsWith("text/html")) return;

        if (mime.includes("text/css") || localRoute.endsWith(".css")) {
          let cssText = await res.text();
          // Rewrite url(...) inside CSS for fonts & SVGs
          cssText = cssText.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (fullCssUrl, quote, rawTarget) => {
            const cleanTarget = rawTarget.trim();
            if (cleanTarget.startsWith("data:") || cleanTarget.startsWith("#")) return fullCssUrl;
            // Filter non-Latin font subsets (arabic, hebrew, cyrillic, asian) for English docpacks
            if (/(arabic|hebrew|cyrillic|vietnamese|korean|japanese|chinese|thai|devanagari|bengali|tamil)/i.test(cleanTarget)) {
              return fullCssUrl;
            }
            try {
              const resolved = new URL(cleanTarget, fullUrl);
              const subLocal = assetUrlToLocalRoute(resolved.href, site.origin, keepScripts);
              fontAndSubAssets.set(resolved.href, subLocal);
              return `url("${subLocal}")`;
            } catch {
              return fullCssUrl;
            }
          });
          const buf = Buffer.from(cssText, "utf-8");
          rawAssets.set(normKey, { bytes: buf, mime: "text/css; charset=utf-8" });
          rawAssets.set(localRoute, { bytes: buf, mime: "text/css; charset=utf-8" });
        } else {
          const arr = await res.arrayBuffer();
          const maxBytes = localRoute.endsWith(".js") || localRoute.endsWith(".json") ? 2000 * 1024 : 350 * 1024;
          if (arr.byteLength > maxBytes) return;
          const buf = Buffer.from(arr);
          rawAssets.set(normKey, { bytes: buf, mime });
          rawAssets.set(localRoute, { bytes: buf, mime });
        }
      })
    );
  }

  // 3. Download fonts & SVGs discovered inside CSS files (polite batches of 8)
  const subEntries = Array.from(fontAndSubAssets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 80);
  for (let i = 0; i < subEntries.length; i += 8) {
    if (i > 0) await new Promise((r) => setTimeout(r, 60));
    const slice = subEntries.slice(i, i + 8);
    await Promise.all(
      slice.map(async ([fullUrl, localRoute]) => {
        const normKey = normalizeRouteKey(localRoute);
        if (rawAssets.has(normKey)) return;
        const res = await fetchWithTimeout(fullUrl, 8000, 3, handleRateLimitSignal, site);
        if (!res || !res.ok) {
          if (isTransientFailure(res)) unconfirmedAssets.add(localRoute);
          return;
        }
        const arr = await res.arrayBuffer();
        if (arr.byteLength > 300 * 1024) return;
        const mime = guessMime(localRoute, res.headers.get("content-type"));
        // A missing asset on a single-page site comes back as its shell
        if (mime.startsWith("text/html")) return;
        const buf = Buffer.from(arr);
        rawAssets.set(normKey, { bytes: buf, mime });
        rawAssets.set(localRoute, { bytes: buf, mime });
      })
    );
  }

  if (site.id === "lucide") {
    const bundlePath = path.resolve(__dirname, "../docs-desktop/src-tauri/src/lucide_bundle.js");
    if (fs.existsSync(bundlePath)) {
      const bundleBuf = fs.readFileSync(bundlePath);
      rawAssets.set("/assets/docx-lucide-bundle.js", { bytes: bundleBuf, mime: "application/javascript; charset=utf-8" });
    }
  }

  // 4. Name assets, add the search index, and pack everything as content-defined chunks
  const assetUrls = new Map([...pendingAssetUrls, ...fontAndSubAssets]);
  const renamedAssets = applyStableAssetRoutes(rawAssets, assetUrls);

  const pageCount = [...rawAssets.values()].filter((a) => a.mime.startsWith("text/html")).length;
  if (pageCount === 0 || searchEntries.length === 0) {
    if (previousRouteCount > 0) {
      console.warn(`⚠️ [${site.id}] Crawl produced 0 valid HTML pages — keeping existing healthy release .docpack.`);
      return keepPrevious();
    }
    throw new Error(`Crawl for ${site.id} produced 0 valid HTML pages and no previous release pack exists!`);
  }

  const entryNorm = normalizeRouteKey(site.entryPath);
  const entryPage =
    rawAssets.get(entryNorm) ||
    rawAssets.get(site.entryPath) ||
    [...rawAssets.values()].find((a) => a.mime.startsWith("text/html"));
  if (entryPage) {
    if (!rawAssets.has("/docs")) rawAssets.set("/docs", entryPage);
    if (!rawAssets.has("/")) rawAssets.set("/", entryPage);
  }

  const forceRebuild = process.env.DOCX_FORCE_REBUILD === "true";
  // Pages, not routes: a site that stops shipping its bundles has lost assets, not documentation
  if (!forceRebuild && !site.singlePage && previousPageCount > 10 && pageCount < Math.floor(previousPageCount * 0.5)) {
    console.warn(
      `⚠️ [${site.id}] Crawl only captured ${pageCount} pages vs ${previousPageCount} previously — keeping existing healthy .docpack.`
    );
    return keepPrevious();
  }

  // After the guard: a site redirecting everything to a maintenance page has no pages to show for it
  for (const [from, to] of redirects) {
    if (!rawAssets.has(from)) rawAssets.set(from, redirectPage(to));
  }

  const images = await compressImages(rawAssets);
  if (images.converted) {
    const mb = (n: number) => (n / (1024 * 1024)).toFixed(1);
    console.log(`  ${images.converted} images as WebP: ${mb(images.bytesBefore)} MB -> ${mb(images.bytesAfter)} MB`);
  }

  const seenSearchIds = new Set<string>();
  const uniqueSearchEntries = searchEntries
    .filter((e) => !seenSearchIds.has(e.id) && seenSearchIds.add(e.id))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  rawAssets.set(SEARCH_ROUTE, {
    bytes: Buffer.from(JSON.stringify(uniqueSearchEntries), "utf-8"),
    mime: "application/json; charset=utf-8",
  });

  // A partial crawl must not delete pages: only a clean run or a 404/410 can do that
  const carried = new Set<string>();
  if (previous) {
    if (truncated) {
      for (const route of Object.keys(previous.index.p)) {
        if (previous.mimeOf(route)?.startsWith("text/html")) carried.add(route);
      }
    }
    for (const route of unconfirmedRoutes) carried.add(route);
    for (const route of unconfirmedAssets) carried.add(renamedAssets.get(route) ?? normalizeRouteKey(route));
    for (const route of rawAssets.keys()) carried.delete(route);
  }
  const carriedRoutes = previous ? withReferencedRoutes(previous, carried) : carried;

  const built = buildPack({
    id: site.id,
    name: site.name,
    version: site.version,
    origin: site.origin,
    entryPath: site.entryPath,
    assets: rawAssets,
    carriedRoutes,
    previous,
    truncated,
  });

  const mb = (n: number) => (n / (1024 * 1024)).toFixed(2);
  if (built.unchanged && previous?.meta.version === site.version) {
    console.log(`✓ ${site.id} is unchanged at ${built.meta.commit} (${built.stats.routes} routes) — nothing to publish`);
    return "unchanged";
  }

  writePack(docpackPath, built.bytes);

  console.log(
    `✓ Built ${site.id}.docpack: ${mb(built.bytes.byteLength)} MB, ${built.stats.routes} routes, ${built.stats.totalChunks} chunks, generation ${built.meta.generation}, commit ${built.meta.commit}`
  );
  console.log(
    `  ${built.stats.newChunks} new chunks (${mb(built.stats.newBytes)} MB); update from previous build: ${mb(built.stats.updateBytes)} MB; carried ${carriedRoutes.size} routes`
  );
  return "built";
}

export async function closeBrowser() {
  await (await browser)?.close();
}

// CLI Entrypoint
if (import.meta.main) {
  const argSite = process.argv[2];
  const defaultPacksDir = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "docx")
    : path.resolve("packs");
  const outDir = process.argv[3] || defaultPacksDir;
  if (argSite === "--list-json") {
    console.log(JSON.stringify(SITE_CATALOG.map((s) => s.id)));
  } else if (argSite) {
    for (const id of argSite.split(",").map((s) => s.trim()).filter(Boolean)) {
      try {
        const result = await buildDocpackForSite(id, outDir);
        if (result === "built") fs.writeFileSync(path.join(outDir, `${id}.changed`), "");
      } catch (e: any) {
        console.error(`❌ Build error for ${id}:`, e?.message || e);
        if (!fs.existsSync(path.join(outDir, `${id}.docpack`))) {
          process.exitCode = 1;
        }
      }
    }
    await closeBrowser();
  }
}
