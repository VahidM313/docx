import fs from "fs";
import path from "path";
import crypto from "crypto";

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
}
/**
 * Crawl/pack configuration, sourced from `docs-desktop/sites.json`
 * (generated from the atomic per-site sources in `docs-desktop/sites.d/*.json`).
 */
export const SITE_CATALOG: SiteConfig[] = siteCatalog.sites
  .filter((s: any) => s.kind !== "embedded")
  .map((s: any) => ({
    id: s.id,
    name: s.name,
    version: s.version,
    origin: s.origin,
    entryPath: s.entryPath,
    allowedPrefixes: s.allowedPrefixes ?? [],
    maxPages: s.maxPages,
  }));

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

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

function assetUrlToLocalRoute(fullUrl: string, siteOrigin: string): string {
  try {
    const u = new URL(fullUrl, siteOrigin);
    if (u.origin === siteOrigin && !u.search) {
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

async function fetchWithTimeout(
  url: string,
  timeoutMs = 12000,
  maxRetries = 4,
  onRateLimited?: () => void,
  siteConfig?: SiteConfig
): Promise<Response | null> {
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

export async function buildDocpackForSite(siteId: string, outDir: string) {
  const site = SITE_CATALOG.find((s) => s.id === siteId);
  if (!site) throw new Error(`Unknown site id: ${siteId}`);

  fs.mkdirSync(outDir, { recursive: true });
  console.log(`\n=== Crawling Real Website for [${site.id}] (${site.origin}${site.entryPath}) ===`);

  // Check if a previous manifest exists so we never overwrite a healthy pack with a partial/rate-limited crawl
  let previousRouteCount = 0;
  const existingManifestPath = path.join(outDir, `${site.id}.manifest.json`);
  if (fs.existsSync(existingManifestPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(existingManifestPath, "utf-8"));
      previousRouteCount = Object.keys(prev.routes || {}).length;
    } catch {}
  }

  const maxPages = site.maxPages || 150;
  const visitedPages = new Set<string>();
  const pageQueue: string[] = [site.entryPath];

  // Map of localRouteKey -> { bytes: Buffer, mime: string }
  const rawAssets = new Map<string, { bytes: Buffer; mime: string }>();
  const pendingAssetUrls = new Map<string, string>(); // fullUrl -> localRoute
  const searchEntries: any[] = [];

  function isAllowedPageUrl(u: URL): boolean {
    if (u.origin !== site.origin) return false;
    if (/\.(png|jpg|jpeg|gif|webp|svg|ico|css|js|mjs|woff2?|ttf|pdf|zip|gz|xml|json)$/i.test(u.pathname)) {
      return false;
    }
    return site.allowedPrefixes.some((pref) => u.pathname.startsWith(pref));
  }

  // Adaptive polite concurrency across ALL 57 sites (steps down automatically if any rate-limit signal occurs)
  let batchConcurrency = 6;
  let batchDelayMs = 100;
  const handleRateLimitSignal = () => {
    batchConcurrency = 2;
    batchDelayMs = 450;
  };

  // 1. Crawl HTML pages concurrently in polite batches
  while (pageQueue.length > 0 && visitedPages.size < maxPages) {
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
        const res = await fetchWithTimeout(fullUrl, 12000, 4, handleRateLimitSignal, site);
        if (!res || !res.ok) return;
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("html")) return;

        let html = await res.text();
        if (isChallengeOrBlockHtml(html)) return;
        const pageUrl = new URL(res.url || fullUrl);
        const routeKey = normalizeRouteKey(pageUrl.pathname);

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

        // Discover same-origin page links <a href="..."> (supporting both quoted and unquoted attributes)
        const hrefRegex = /<a\b[^>]*?\bhref=(?:"([^"'#]+)"|'([^"'#]+)'|([^\s>"'#]+))/gi;
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
            if (isAllowedPageUrl(resolved)) {
              const normTarget = normalizeRouteKey(resolved.pathname);
              if (!visitedPages.has(normTarget) && pageQueue.length < maxPages * 2) {
                pageQueue.push(resolved.pathname);
              }
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
            const localRoute = assetUrlToLocalRoute(resolved.href, site.origin);
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
              const localRoute = assetUrlToLocalRoute(resolved.href, site.origin);
              pendingAssetUrls.set(resolved.href, localRoute);
              const cleanedAttrs = attrs.replace(/\bsrc=(?:"[^"]*"|'[^']*'|[^\s>]+)/i, `src="${localRoute}"`);
              return `<img ${cleanedAttrs.trim()}>`;
            } catch {
              return fullMatch;
            }
          });

        if (site.id === "angular" || site.id === "nestjs" || site.id === "threejs" || site.id === "rust" || site.id === "lucide") {
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
                const localRoute = assetUrlToLocalRoute(resolved.href, site.origin);
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

        const htmlBytes = Buffer.from(html, "utf-8");
        rawAssets.set(routeKey, { bytes: htmlBytes, mime: "text/html; charset=utf-8" });
        if (pageUrl.pathname !== routeKey) {
          rawAssets.set(pageUrl.pathname, { bytes: htmlBytes, mime: "text/html; charset=utf-8" });
        }
      })
    );
  }

  // Extra SPA / Viewer assets for Three.js, NestJS, and Angular
  if (site.id === "threejs") {
    pendingAssetUrls.set("https://threejs.org/files/main.css", "/files/main.css");
    pendingAssetUrls.set("https://threejs.org/files/page.css", "/files/page.css");
    pendingAssetUrls.set("https://threejs.org/files/page.js", "/files/page.js");
    pendingAssetUrls.set("https://threejs.org/docs/search.json", "/docs/search.json");
  } else if (site.id === "nestjs") {
    pendingAssetUrls.set("https://docs.nestjs.com/chunk-BYCV1OW9.js", "/chunk-BYCV1OW9.js");
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

  console.log(
    `  Crawled ${visitedPages.size} HTML pages for ${site.id}, now fetching ${pendingAssetUrls.size} CSS/JS/JSON/image assets...`
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
        if (!res || !res.ok) return;
        const ct = res.headers.get("content-type") || "";
        const mime = guessMime(localRoute, ct);

        if (mime.includes("text/css") || localRoute.endsWith(".css")) {
          let cssText = await res.text();
          // Rewrite url(...) inside CSS for fonts & SVGs
          cssText = cssText.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (fullCssUrl, quote, rawTarget) => {
            const cleanTarget = rawTarget.trim();
            if (cleanTarget.startsWith("data:") || cleanTarget.startsWith("#")) return fullCssUrl;
            try {
              const resolved = new URL(cleanTarget, fullUrl);
              const subLocal = assetUrlToLocalRoute(resolved.href, site.origin);
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
  const subEntries = Array.from(fontAndSubAssets.entries()).slice(0, 80);
  for (let i = 0; i < subEntries.length; i += 8) {
    if (i > 0) await new Promise((r) => setTimeout(r, 60));
    const slice = subEntries.slice(i, i + 8);
    await Promise.all(
      slice.map(async ([fullUrl, localRoute]) => {
        const normKey = normalizeRouteKey(localRoute);
        if (rawAssets.has(normKey)) return;
        const res = await fetchWithTimeout(fullUrl, 8000, 3, handleRateLimitSignal, site);
        if (!res || !res.ok) return;
        const arr = await res.arrayBuffer();
        if (arr.byteLength > 300 * 1024) return;
        const mime = guessMime(localRoute, res.headers.get("content-type"));
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

  // 4. Pack all HTML + CSS + Fonts + Images into Max-Gzip content-hashed chunks
  const routes: Record<string, any> = {};
  const chunks: Buffer[] = [];
  let currentOffset = 0;
  const hashToChunk = new Map<string, { offset: number; length: number; hash: string }>();

  for (const [routeKey, asset] of rawAssets.entries()) {
    const gz = Buffer.from(Bun.gzipSync(asset.bytes, { level: 9 }));
    const hash = crypto.createHash("sha256").update(gz).digest("hex").slice(0, 16);
    let stored = hashToChunk.get(hash);
    if (!stored) {
      stored = { offset: currentOffset, length: gz.byteLength, hash };
      hashToChunk.set(hash, stored);
      chunks.push(gz);
      currentOffset += gz.byteLength;
    }
    routes[routeKey] = {
      offset: stored.offset,
      length: stored.length,
      mime: asset.mime,
      gzipped: true,
      hash: stored.hash,
    };
  }

  const entryNorm = normalizeRouteKey(site.entryPath);
  const firstHtmlRoute =
    routes[entryNorm] ||
    routes[site.entryPath] ||
    Object.values(routes).find((r: any) => r.mime.includes("text/html"));

  if (firstHtmlRoute) {
    if (!routes["/docs"]) routes["/docs"] = firstHtmlRoute;
    if (!routes["/"]) routes["/"] = firstHtmlRoute;
  }

  const newRouteCount = Object.keys(routes).length;
  if (newRouteCount === 0 || chunks.length === 0 || searchEntries.length === 0) {
    throw new Error(`Crawl for ${site.id} produced 0 valid HTML pages — refusing to overwrite existing .docpack!`);
  }
  if (previousRouteCount > 10 && newRouteCount < Math.floor(previousRouteCount * 0.5)) {
    throw new Error(
      `Crawl for ${site.id} only captured ${newRouteCount} routes vs ${previousRouteCount} previously — refusing to overwrite healthy .docpack!`
    );
  }

  const commitHash = crypto
    .createHash("sha256")
    .update(Array.from(hashToChunk.keys()).sort().join(","))
    .digest("hex")
    .slice(0, 8);

  const manifest = {
    id: site.id,
    name: site.name,
    version: site.version,
    commit: commitHash,
    origin: site.origin,
    entryPath: site.entryPath,
    updatedAt: new Date().toISOString(),
    totalBytes: currentOffset,
    chunkCount: chunks.length,
    routes,
  };

  const manifestBytes = Buffer.from(JSON.stringify(manifest), "utf-8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(manifestBytes.byteLength, 0);

  const docpackPath = path.join(outDir, `${site.id}.docpack`);
  const manifestPath = path.join(outDir, `${site.id}.manifest.json`);
  const searchPath = path.join(outDir, `${site.id}.search.json`);

  fs.writeFileSync(docpackPath, Buffer.concat([header, manifestBytes, ...chunks]));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  fs.writeFileSync(searchPath, JSON.stringify(searchEntries, null, 2), "utf-8");

  console.log(
    `✓ Built real-website ${site.id}.docpack: ${(currentOffset / (1024 * 1024)).toFixed(2)} MB (${
      chunks.length
    } unique chunks, ${Object.keys(routes).length} routes, commit ${commitHash})`
  );
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
      await buildDocpackForSite(id, outDir);
    }
  }
}
