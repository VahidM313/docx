/**
 * Builds registry.json from the docpacks of a release.
 *
 * Every field comes from the first bytes of each pack, so publishing the registry
 * never downloads the packs themselves. `gens` lists older commits with the bytes
 * a client on that commit must fetch, which is how the app can show real update
 * sizes without touching any pack.
 *
 *   bun scripts/build-registry.ts <release-tag> <icons-dir> <output.json>
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { HEADER_BYTES, updateBytesFrom, type PackMeta } from "./lib/docpack-v3";

const HEAD_PROBE_BYTES = 64 * 1024;
const CONCURRENCY = 8;

interface ReleaseAsset {
  name: string;
  size: number;
  url: string;
}

export async function readRemoteMeta(url: string): Promise<{ meta: PackMeta; headBytes: number }> {
  const res = await fetch(url, { headers: { Range: `bytes=0-${HEAD_PROBE_BYTES - 1}` } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  let head = Buffer.from(await res.arrayBuffer());
  if (head.subarray(0, 4).toString("latin1") !== "DOCP") throw new Error("not a docpack");
  const metaLen = head.readUInt32LE(8);
  const indexLen = head.readUInt32LE(12);
  const metaEnd = HEADER_BYTES + metaLen;
  if (head.length < metaEnd) {
    const rest = await fetch(url, { headers: { Range: `bytes=0-${metaEnd - 1}` } });
    head = Buffer.from(await rest.arrayBuffer());
  }
  return {
    meta: JSON.parse(head.subarray(HEADER_BYTES, metaEnd).toString("utf8")),
    headBytes: metaEnd + indexLen,
  };
}

function iconFields(id: string, iconsDir: string) {
  const iconFile = `${id}.icon.png`;
  const iconPath = path.join(iconsDir, iconFile);
  if (!fs.existsSync(iconPath)) return {};
  const iconETag = crypto.createHash("sha256").update(fs.readFileSync(iconPath)).digest("hex").slice(0, 16);
  return { iconFile, iconETag };
}

async function main() {
  const [tag, iconsDir, outPath] = process.argv.slice(2);
  if (!tag || !iconsDir || !outPath) throw new Error("usage: build-registry <release-tag> <icons-dir> <output.json>");

  const release = JSON.parse(execSync(`gh release view ${tag} --json assets`, { encoding: "utf8", maxBuffer: 1 << 26 }));
  const queue: ReleaseAsset[] = release.assets.filter((a: ReleaseAsset) => a.name.endsWith(".docpack"));
  const packs: Record<string, unknown> = {};
  let failed = 0;

  const worker = async () => {
    for (let asset = queue.pop(); asset; asset = queue.pop()) {
      try {
        const { meta, headBytes } = await readRemoteMeta(asset.url);
        const gens: Record<string, number> = {};
        for (const g of meta.gens) gens[g.commit] = updateBytesFrom(meta, headBytes, g.commit)!;
        packs[meta.id] = {
          id: meta.id,
          name: meta.name,
          version: meta.version,
          commit: meta.commit,
          updatedAt: meta.updatedAt,
          sizeMB: Number((asset.size / (1024 * 1024)).toFixed(2)),
          totalBytes: asset.size,
          chunkCount: meta.chunkCount,
          routeCount: meta.routeCount,
          packFile: asset.name,
          gens,
          ...(meta.truncated ? { truncated: true } : {}),
          ...iconFields(meta.id, iconsDir),
        };
      } catch (e: any) {
        failed++;
        console.warn(`Skipping ${asset.name}: ${e?.message || e}`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const sorted = Object.fromEntries(Object.entries(packs).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(outPath, JSON.stringify({ version: 3, updatedAt: new Date().toISOString(), packs: sorted }));
  console.log(`Registry has ${Object.keys(sorted).length} packs${failed ? `, ${failed} skipped` : ""}.`);
  if (failed > 0 && Object.keys(sorted).length === 0) process.exitCode = 1;
}

if (import.meta.main) await main();
