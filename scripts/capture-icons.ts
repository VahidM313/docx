/**
 * Build-time favicon capture for the site catalog (hybrid icon strategy).
 *
 * For every site in `docs-desktop/sites.json` (or only sites passed via
 * `--only id1,id2`), captures a fallback raster icon:
 *
 *   1. apple-touch-icon found in the origin's HTML <head>
 *   2. /apple-touch-icon.png, /apple-touch-icon-precomposed.png (origin + entry path dir)
 *   3. /favicon-32x32.png
 *   4. Google favicon service backstop (always PNG)
 *
 * The captured image is decoded, made square, normalized to 112x112 and saved
 * as `docs-desktop/public/icons/<id>.png`, which ships inside the app. Run this
 * when adding a site and commit the result; a site listed in `SITES_WITHOUT_PNG`
 * (`docs-desktop/src/lib/catalog.ts`) keeps its curated SVG instead.
 *
 * Usage: bun scripts/capture-icons.ts [--only id1,id2] [--force]
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

import siteCatalog from "../docs-desktop/sites.json";

const root = path.resolve(import.meta.dir, "..");
const iconsDir = path.join(root, "docs-desktop", "public", "icons");
fs.mkdirSync(iconsDir, { recursive: true });

const args = process.argv.slice(2);
const onlyArg = args.includes("--only")
  ? (args[args.indexOf("--only") + 1] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : null;
const force = args.includes("--force");

const ICON_SIZE = 112;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function hostOf(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return origin.replace(/^https?:\/\//, "").split("/")[0];
  }
}

async function fetchWithMeta(url: string): Promise<{ ok: true; buf: Buffer; etag?: string; lastModified?: string; mime: string } | { ok: false; status?: number }> {
  try {
    // One stalled site must not hold up every site after it, or the registry that waits on them
    const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return { ok: false, status: res.status };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100) return { ok: false };
    return {
      ok: true,
      buf,
      etag: res.headers.get("etag") ?? undefined,
      lastModified: res.headers.get("last-modified") ?? undefined,
      mime: res.headers.get("content-type") ?? "",
    };
  } catch {
    return { ok: false };
  }
}

/** Extract a plausible icon href from a page's <head> (no full HTML parse). */
function extractAppleTouchIcon(html: string): string | null {
  const m =
    // prefer apple-touch-icon Pregnant any size qualifier
    html.match(/<link[^>]+rel=["']apple-touch-icon["'][^>]*>/i)
      ?? html.match(/<link[^>]+rel=["']apple-touch-icon-precomposed["'][^>]*>/i);
  if (!m) return null;
  const href = m[0].match(/href=["']([^"']+)["']/i)?.[1];
  return href ?? null;
}

function isPng(buf: Buffer): boolean {
  return buf.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
}

/** PNG / JPEG / WebP — anything sharp can decode. */
function isRaster(buf: Buffer): boolean {
  return (
    isPng(buf) ||
    buf.subarray(0, 3).toString("hex") === "ffd8ff" || // JPEG
    (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP")
  );
}

/** Vector sources can't be normalized here (and may crash libvips) — skip them. */
function isSvg(buf: Buffer, mime: string): boolean {
  return mime.includes("svg") || buf.subarray(0, 200).toString("utf8").includes("<svg");
}

async function tryCandidates(origin: string): Promise<{ source: string; buf: Buffer } | null> {
  // Advisory: some origins 403 plain HEAD-less fetches; keep UA browser-like.
  const page = await fetchWithMeta(origin);
  if (page.ok && /text\/html/.test(page.mime)) {
    const html = page.buf.toString("utf8");
    if (!isSvg(page.buf, page.mime)) {
      const href = extractAppleTouchIcon(html);
      if (href) {
        const abs = href.startsWith("http") ? href : new URL(href, origin).toString();
        const got = await fetchWithMeta(abs);
        if (got.ok && !isSvg(got.buf, got.mime) && isRaster(got.buf)) return { source: abs, buf: got.buf };
      }
    }
  }

  const base = new URL(origin);
  const candidates = [
    new URL("/apple-touch-icon.png", base),
    new URL("/apple-touch-icon-precomposed.png", base),
    new URL("/favicon-32x32.png", base),
    new URL("/favicon.png", base),
  ];
  for (const u of candidates) {
    const got = await fetchWithMeta(u.toString());
    if (got.ok && isRaster(got.buf) && !isSvg(got.buf, got.mime)) {
      return { source: u.toString(), buf: got.buf };
    }
  }

  // Re-try the same conventional paths at the origin root of subdomain-less
  // hosts — some docs sites only expose icons at their apex domain.
  let apex: URL | null = null;
  try {
    const h = hostOf(origin);
    const parts = h.split(".");
    if (parts.length > 2) apex = new URL(`https://${parts.slice(-2).join(".")}`);
  } catch {
    /* ignore */
  }
  if (apex) {
    for (const u of [
      new URL("/apple-touch-icon.png", apex),
      new URL("/favicon-32x32.png", apex),
      new URL("/favicon.png", apex),
    ]) {
      const got = await fetchWithMeta(u.toString());
      if (got.ok && isRaster(got.buf) && !isSvg(got.buf, got.mime)) {
        return { source: u.toString(), buf: got.buf };
      }
    }
  }

  // Google favicon service backstop — always PNG. Retry with the apex host,
  // since docs subdomains are often unindexed there.
  for (const domain of [hostOf(origin), apexHost(origin)]) {
    if (!domain) continue;
    const gs = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    const got = await fetchWithMeta(gs);
    if (got.ok && isRaster(got.buf) && !isSvg(got.buf, got.mime)) {
      return { source: gs, buf: got.buf };
    }
  }
  return null;
}

/** Real registration domain (last two labels), or null for github.io-style hosts. */
function apexHost(origin: string): string | null {
  try {
    const parts = new URL(origin).hostname.split(".");
    if (parts.length < 3) return parts.join(".");
    const lastTwo = parts.slice(-2).join(".");
    if (lastTwo === "github.io" || lastTwo === "githubusercontent.com") return null;
    return lastTwo;
  } catch {
    return null;
  }
}

const results: string[] = [];
const failures: string[] = [];

const actionable = siteCatalog.sites.filter((s: any) =>
  onlyArg ? onlyArg.includes(s.id) : true
);

for (const site of actionable) {
  const origin: string | undefined = site.origin;
  if (!origin) continue;
  const pngPath = path.join(iconsDir, `${site.id}.png`);

  try {
    const found = await tryCandidates(origin);
    if (!found) {
      failures.push(`${site.id}`);
      results.push(`✗ ${site.id}: no icon source succeeded`);
      continue;
    }

    // Normalize: square, cover the canvas, 112x112 PNG
    const png = await sharp(found.buf)
      .resize(ICON_SIZE, ICON_SIZE, { fit: "cover", withoutEnlargement: false, background: { r: 250, g: 250, b: 250, alpha: 1 } })
      .flatten({ background: { r: 250, g: 250, b: 250, alpha: 1 } })
      .png({ compressionLevel: 9 })
      .toBuffer();

    if (!force && fs.existsSync(pngPath) && fs.readFileSync(pngPath).equals(png)) {
      results.push(`· ${site.id}: unchanged (${path.basename(found.source)})`);
      continue;
    }

    fs.writeFileSync(pngPath, png);
    results.push(
      `✓ ${site.id}: ${Math.round(png.length / 1024)}KB from ${path.basename(found.source)}`,
    );
  } catch (e) {
    failures.push(`${site.id}`);
    results.push(`✗ ${site.id}: ${e}`);
  }
}

console.log(results.join("\n"));
console.log(`\nCaptured: ${results.filter((r) => r.startsWith("✓")).length}, ` +
  `unchanged: ${results.filter((r) => r.startsWith("·")).length}, ` +
  `failed: ${failures.length}`);
if (failures.length && onlyArg) process.exit(1);
