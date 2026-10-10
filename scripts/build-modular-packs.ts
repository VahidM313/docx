import fs from "fs";
import path from "path";
import crypto from "crypto";

interface OldEntry {
  offset: number;
  length: number;
  mime: string;
  gzipped: boolean;
}

export interface HashedManifestEntry {
  offset: number;
  length: number;
  mime: string;
  gzipped: boolean;
  hash: string;
}

export interface SiteManifest {
  id: string;
  name: string;
  version: string;
  commit: string;
  updatedAt: string;
  totalBytes: number;
  chunkCount: number;
  routes: Record<string, HashedManifestEntry>;
}

const packBuf = fs.readFileSync("d:/Dev/crawl/docs-desktop/src-tauri/assets.pack");
const manifestLen = packBuf.readUInt32LE(0);
const oldManifest: Record<string, OldEntry> = JSON.parse(
  packBuf.subarray(4, 4 + manifestLen).toString("utf-8")
);
const dataStart = 4 + manifestLen;

const packsDir = "d:/Dev/crawl/packs";
fs.mkdirSync(packsDir, { recursive: true });

function buildSitePack(
  prefix: "tw" | "sh",
  id: "tailwind" | "shadcn",
  name: string,
  version: string,
  commit: string
) {
  const routes: Record<string, HashedManifestEntry> = {};
  const chunks: Buffer[] = [];
  let currentOffset = 0;

  // Map old offset -> new offset & hash so aliased routes share the same chunk!
  const seenOffsets = new Map<number, { offset: number; length: number; hash: string }>();

  for (const [fullKey, entry] of Object.entries(oldManifest)) {
    if (!fullKey.startsWith(`${prefix}:`)) continue;
    const routePath = fullKey.slice(prefix.length + 1);

    let mapped = seenOffsets.get(entry.offset);
    if (!mapped) {
      const slice = packBuf.subarray(dataStart + entry.offset, dataStart + entry.offset + entry.length);
      const hash = crypto.createHash("sha256").update(slice).digest("hex").slice(0, 16);
      mapped = {
        offset: currentOffset,
        length: entry.length,
        hash,
      };
      seenOffsets.set(entry.offset, mapped);
      chunks.push(slice);
      currentOffset += entry.length;
    }

    routes[routePath] = {
      offset: mapped.offset,
      length: mapped.length,
      mime: entry.mime,
      gzipped: entry.gzipped,
      hash: mapped.hash,
    };
  }

  const siteManifest: SiteManifest = {
    id,
    name,
    version,
    commit,
    updatedAt: new Date().toISOString(),
    totalBytes: currentOffset,
    chunkCount: seenOffsets.size,
    routes,
  };

  const manifestBytes = Buffer.from(JSON.stringify(siteManifest), "utf-8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(manifestBytes.byteLength, 0);

  const docpackPath = path.join(packsDir, `${id}.docpack`);
  const manifestPath = path.join(packsDir, `${id}.manifest.json`);

  fs.writeFileSync(docpackPath, Buffer.concat([header, manifestBytes, ...chunks]));
  fs.writeFileSync(manifestPath, JSON.stringify(siteManifest, null, 2), "utf-8");

  console.log(
    `Built ${id}.docpack: ${(currentOffset / (1024 * 1024)).toFixed(2)} MB (${seenOffsets.size} unique chunks, ${Object.keys(routes).length} routes)`
  );

  return {
    id,
    name,
    version,
    commit,
    updatedAt: siteManifest.updatedAt,
    sizeMB: Number((currentOffset / (1024 * 1024)).toFixed(2)),
    totalBytes: currentOffset,
    headerAndManifestBytes: 4 + manifestBytes.byteLength,
    chunkCount: seenOffsets.size,
    routeCount: Object.keys(routes).length,
    manifestFile: `${id}.manifest.json`,
    packFile: `${id}.docpack`,
  };
}

const twMeta = buildSitePack("tw", "tailwind", "Tailwind CSS", "v4.3.0", "f8a2c91");
const shMeta = buildSitePack("sh", "shadcn", "shadcn/ui", "v4.0.0", "d4e71b3");

const registry = {
  version: 1,
  updatedAt: new Date().toISOString(),
  packs: {
    tailwind: twMeta,
    shadcn: shMeta,
  },
};

fs.writeFileSync(path.join(packsDir, "registry.json"), JSON.stringify(registry, null, 2), "utf-8");
console.log("Wrote d:/Dev/crawl/packs/registry.json");
