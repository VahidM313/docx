// Reads v1/v2 packs. The first v3 build of a site starts from one, so a crawl
// that comes back short cannot replace a healthy pack with a smaller one.
import zlib from "zlib";
import type { PackAsset } from "./docpack-v3";

const LEGACY_MAGIC = "DOCP";

interface LegacyRoute {
  mime: string;
  offset: number;
  length: number;
  gzipped?: boolean;
  encoding?: string | null;
}

export function readLegacyPack(bytes: Buffer): Map<string, PackAsset> {
  const versioned = bytes.subarray(0, 4).toString("latin1") === LEGACY_MAGIC;
  const manifestStart = versioned ? 16 : 4;
  const manifestLen = bytes.readUInt32LE(versioned ? 8 : 0);
  const dataStart = manifestStart + manifestLen;
  if (dataStart > bytes.length) throw new Error("legacy manifest runs past the end of the pack");

  const manifest = JSON.parse(bytes.subarray(manifestStart, dataStart).toString("utf-8"));
  const routes: Record<string, LegacyRoute> = manifest.routes ?? {};
  const assets = new Map<string, PackAsset>();
  for (const [route, entry] of Object.entries(routes)) {
    const start = dataStart + entry.offset;
    if (start + entry.length > bytes.length) throw new Error(`legacy route ${route} runs past the end of the pack`);
    const stored = bytes.subarray(start, start + entry.length);
    const raw =
      entry.encoding === "br"
        ? zlib.brotliDecompressSync(stored)
        : entry.gzipped
          ? zlib.gunzipSync(stored)
          : Buffer.from(stored);
    assets.set(route, { bytes: raw, mime: entry.mime });
  }
  return assets;
}
