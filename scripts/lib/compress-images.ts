/**
 * Re-encodes a pack's PNG and JPEG images as WebP.
 *
 * Routes keep their names: the app serves each route with the type stored in the
 * pack, so a page asking for `chart.png` simply receives a WebP. An image stays as
 * it was whenever WebP cannot hold it or would not be smaller.
 */
import crypto from "crypto";
import type { PackAsset } from "./docpack-v3";

const WEBP_MIME = "image/webp";
/** Screenshots and diagrams hold small text, which ordinary lossy WebP blurs. */
const PNG_OPTIONS = { nearLossless: true, quality: 60, effort: 4 };
const JPEG_OPTIONS = { quality: 80, effort: 4 };
const WORKERS = 4;

export interface ImageReport {
  converted: number;
  kept: number;
  bytesBefore: number;
  bytesAfter: number;
}

/** Only the first frame of an animated PNG would survive the conversion. */
function isAnimatedPng(bytes: Buffer): boolean {
  const animation = bytes.indexOf("acTL", 8, "latin1");
  return animation !== -1 && animation < bytes.indexOf("IDAT", 8, "latin1");
}

export async function compressImages(assets: Map<string, PackAsset>): Promise<ImageReport> {
  const { default: sharp } = await import("sharp");

  // Crawled images often sit under two routes, and they must stay one chunk
  const sources = new Map<string, { asset: PackAsset; routes: string[] }>();
  for (const [route, asset] of assets) {
    const mime = asset.mime.split(";")[0];
    if (mime !== "image/png" && mime !== "image/jpeg") continue;
    const key = crypto.createHash("sha256").update(asset.bytes).digest("hex");
    const source = sources.get(key);
    if (source) source.routes.push(route);
    else sources.set(key, { asset, routes: [route] });
  }

  const report: ImageReport = { converted: 0, kept: 0, bytesBefore: 0, bytesAfter: 0 };
  const queue = [...sources.values()];
  const convert = async ({ asset, routes }: { asset: PackAsset; routes: string[] }) => {
    const png = asset.mime.startsWith("image/png");
    report.bytesBefore += asset.bytes.length;
    let webp: Buffer | null = null;
    if (!(png && isAnimatedPng(asset.bytes))) {
      try {
        webp = await sharp(asset.bytes).webp(png ? PNG_OPTIONS : JPEG_OPTIONS).toBuffer();
      } catch {
        // Corrupt, or past WebP's 16383 pixel limit: the original still displays
      }
    }
    if (!webp || webp.length >= asset.bytes.length) {
      report.kept++;
      report.bytesAfter += asset.bytes.length;
      return;
    }
    report.converted++;
    report.bytesAfter += webp.length;
    for (const route of routes) assets.set(route, { bytes: webp, mime: WEBP_MIME });
  };

  await Promise.all(
    Array.from({ length: WORKERS }, async () => {
      for (let next = queue.shift(); next; next = queue.shift()) await convert(next);
    }),
  );
  return report;
}
