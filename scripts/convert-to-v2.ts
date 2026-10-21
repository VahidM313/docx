import fs from "fs";
import path from "path";
import crypto from "crypto";
import zlib from "zlib";
import { promisify } from "util";

const brotliCompressAsync = promisify(zlib.brotliCompress);

interface OldEntry {
  offset: number;
  length: number;
  mime: string;
  gzipped: boolean;
  hash?: string;
  encoding?: string;
  raw_length?: number;
}

interface NewEntry {
  offset: number;
  length: number;
  mime: string;
  gzipped: boolean;
  hash: string;
  encoding?: string;
  raw_length?: number;
}

const TEXT_MIMES = [
  "text/html",
  "text/css",
  "text/javascript",
  "application/javascript",
  "application/x-javascript",
  "application/json",
  "image/svg+xml",
  "text/plain",
  "text/xml",
  "application/xml",
];

function isTextMime(mime: string): boolean {
  const m = mime.toLowerCase();
  return TEXT_MIMES.some((t) => m.includes(t));
}

export async function convertDocpackToV2(packPath: string): Promise<{ oldSize: number; newSize: number; siteId: string } | null> {
  if (!fs.existsSync(packPath)) {
    console.error(`File not found: ${packPath}`);
    return null;
  }

  const buf = fs.readFileSync(packPath);
  const oldSize = buf.length;

  if (buf.subarray(0, 4).toString("utf-8") === "DOCP") {
    console.log(`Pack ${packPath} is ALREADY Docpack v2. Skipping.`);
    return null;
  }

  const manifestLen = buf.readUInt32LE(0);
  const manifestRaw = buf.subarray(4, 4 + manifestLen).toString("utf-8");
  const manifest = JSON.parse(manifestRaw);
  const dataStart = 4 + manifestLen;

  console.log(`Converting ${manifest.id} (${manifest.name}) from v1 to v2...`);
  console.log(`  Initial v1 size: ${(oldSize / (1024 * 1024)).toFixed(2)} MB`);

  const sortedRoutes = Object.keys(manifest.routes).sort();
  console.log(`  Decompressing and preparing ${sortedRoutes.length} routes...`);

  // Step 1: Decompress all chunks in memory
  const rawItems = sortedRoutes.map((route) => {
    const entry = manifest.routes[route] as OldEntry;
    const rawChunk = buf.subarray(dataStart + entry.offset, dataStart + entry.offset + entry.length);
    let uncompressed: Buffer;
    if (entry.gzipped) {
      try {
        uncompressed = zlib.gunzipSync(rawChunk);
      } catch {
        uncompressed = rawChunk;
      }
    } else {
      uncompressed = rawChunk;
    }
    return {
      route,
      entry,
      uncompressed,
      isText: isTextMime(entry.mime),
    };
  });

  // Step 2: Parallel Brotli compression across all 20 CPU threads in batches
  console.log(`  Compressing text chunks in parallel (Brotli Q11)...`);
  const BATCH_SIZE = 64;
  const compressedChunks: { route: string; entry: OldEntry; finalChunk: Buffer; encoding?: string; raw_length: number }[] = [];

  for (let i = 0; i < rawItems.length; i += BATCH_SIZE) {
    const batch = rawItems.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (item) => {
        if (item.isText) {
          const compressed = await brotliCompressAsync(item.uncompressed, {
            params: {
              [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
              [zlib.constants.BROTLI_PARAM_LGWIN]: 24,
            },
          });
          return {
            route: item.route,
            entry: item.entry,
            finalChunk: compressed,
            encoding: "br",
            raw_length: item.uncompressed.length,
          };
        } else {
          return {
            route: item.route,
            entry: item.entry,
            finalChunk: item.uncompressed,
            encoding: undefined,
            raw_length: item.uncompressed.length,
          };
        }
      })
    );
    compressedChunks.push(...results);
  }

  // Step 3: Deduplicate and layout chunks
  const uniqueChunks = new Map<string, Buffer>();
  const chunkOffsets = new Map<string, { offset: number; length: number }>();
  let currentOffset = 0;
  const newRoutes: Record<string, NewEntry> = {};

  for (const item of compressedChunks) {
    const chunkHash = crypto.createHash("sha256").update(item.finalChunk).digest("hex").slice(0, 16);

    let placement = chunkOffsets.get(chunkHash);
    if (!placement) {
      placement = { offset: currentOffset, length: item.finalChunk.length };
      chunkOffsets.set(chunkHash, placement);
      uniqueChunks.set(chunkHash, item.finalChunk);
      currentOffset += item.finalChunk.length;
    }

    newRoutes[item.route] = {
      offset: placement.offset,
      length: placement.length,
      mime: item.entry.mime,
      gzipped: false,
      encoding: item.encoding,
      raw_length: item.raw_length,
      hash: chunkHash,
    };
  }

  // Content-addressable commit hash
  const commitHash = crypto
    .createHash("sha256")
    .update(Array.from(uniqueChunks.keys()).sort().join(","))
    .digest("hex")
    .slice(0, 8);

  const updatedManifest = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version || "1.0",
    commit: commitHash,
    compression: "brotli",
    origin: manifest.origin || "",
    entryPath: manifest.entryPath || "/",
    updatedAt: new Date().toISOString(),
    totalBytes: currentOffset,
    chunkCount: uniqueChunks.size,
    routes: newRoutes,
  };

  const manifestBytes = Buffer.from(JSON.stringify(updatedManifest), "utf-8");

  // Docpack v2 header: DOCP (4) + version 2 (2) + flags 2 (2) + manifestLen (4) + reserved 0 (4) = 16 bytes
  const header = Buffer.alloc(16);
  header.write("DOCP", 0, 4, "utf-8");
  header.writeUInt16LE(2, 4); // version 2
  header.writeUInt16LE(2, 6); // flags: 0x0002 (brotli)
  header.writeUInt32LE(manifestBytes.length, 8);
  header.writeUInt32LE(0, 12); // reserved

  const chunkBuffers = Array.from(uniqueChunks.values());
  const newPackBuf = Buffer.concat([header, manifestBytes, ...chunkBuffers]);

  // Write new pack and manifest atomically
  const outDir = path.dirname(packPath);
  const tmpPack = path.join(outDir, `${manifest.id}.docpack.tmp`);
  fs.writeFileSync(tmpPack, newPackBuf);
  fs.renameSync(tmpPack, packPath);

  const manifestPath = path.join(outDir, `${manifest.id}.manifest.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(updatedManifest, null, 2));

  const newSize = newPackBuf.length;
  const savings = ((1 - newSize / oldSize) * 100).toFixed(1);
  console.log(`  ✓ Converted to Docpack v2 (${commitHash}):`);
  console.log(`    New size: ${(newSize / (1024 * 1024)).toFixed(2)} MB (saved ${savings}%)`);
  console.log(`    Chunks: ${uniqueChunks.size}, Routes: ${sortedRoutes.length}`);

  return { oldSize, newSize, siteId: manifest.id };
}

async function run() {
  const localAppDataDir = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "docx") : null;
  const targets = [
    path.resolve("packs"),
    ...(localAppDataDir ? [localAppDataDir] : []),
  ];

  let totalOld = 0;
  let totalNew = 0;

  for (const targetDir of targets) {
    if (!fs.existsSync(targetDir)) continue;
    console.log(`\nScanning ${targetDir} for legacy docpacks...`);
    const files = fs.readdirSync(targetDir).filter((f) => f.endsWith(".docpack"));
    for (const f of files) {
      const fullPath = path.join(targetDir, f);
      const res = await convertDocpackToV2(fullPath);
      if (res) {
        totalOld += res.oldSize;
        totalNew += res.newSize;
      }
    }
  }

  if (totalOld > 0) {
    console.log("\n=======================================================");
    console.log(`Total conversion: ${(totalOld / (1024 * 1024)).toFixed(2)} MB -> ${(totalNew / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`Overall reduction: ${((1 - totalNew / totalOld) * 100).toFixed(1)}% space saved!`);
    console.log("=======================================================\n");
  }
}

run();
