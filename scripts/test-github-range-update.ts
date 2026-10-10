import fs from "fs";
import crypto from "crypto";

const REPO = "VahidM313/docx";
const TAG = "packs-latest";
const BASE_URL = `https://github.com/${REPO}/releases/download/${TAG}`;

async function verifyGitHubPartialUpdate() {
  console.log(`1. Fetching live registry.json from ${BASE_URL}/registry.json ...`);
  const regRes = await fetch(`${BASE_URL}/registry.json`);
  if (!regRes.ok) throw new Error(`Failed to fetch registry.json: ${regRes.status}`);
  const registry = await regRes.json();
  console.log(`   Found packs:`, Object.keys(registry.packs).join(", "));

  console.log(`2. Fetching live tailwind.manifest.json ...`);
  const manRes = await fetch(`${BASE_URL}/tailwind.manifest.json`);
  if (!manRes.ok) throw new Error(`Failed to fetch tailwind.manifest.json: ${manRes.status}`);
  const remoteManifest = await manRes.json();

  const manifestBytesLen = Buffer.from(JSON.stringify(remoteManifest), "utf-8").byteLength;
  const dataStartOffset = 4 + manifestBytesLen;

  // Simulate local install where 2 routes (/docs/padding and /docs/flex-direction) have an old hash
  const changedRoutes = ["/docs/padding", "/docs/flex-direction"];
  let reusedChunks = 0;
  let reusedBytes = 0;
  let downloadedChunks = 0;
  let downloadedBytes = 0;

  const seenHashes = new Set<string>();
  for (const [route, entry] of Object.entries<any>(remoteManifest.routes)) {
    if (changedRoutes.includes(route)) continue;
    if (!seenHashes.has(entry.hash)) {
      seenHashes.add(entry.hash);
      reusedChunks++;
      reusedBytes += entry.length;
    }
  }

  console.log(`3. Testing HTTP 206 Partial Content Range requests against live GitHub Releases CDN...`);
  for (const route of changedRoutes) {
    const entry = remoteManifest.routes[route];
    if (!entry) continue;
    const absStart = dataStartOffset + entry.offset;
    const absEnd = absStart + entry.length - 1;

    const rangeRes = await fetch(`${BASE_URL}/tailwind.docpack`, {
      headers: {
        Range: `bytes=${absStart}-${absEnd}`,
      },
    });

    const chunkBuf = Buffer.from(await rangeRes.arrayBuffer());
    const actualHash = crypto.createHash("sha256").update(chunkBuf).digest("hex").slice(0, 16);

    console.log(
      `   [${route}] HTTP ${rangeRes.status} (${rangeRes.headers.get("content-range")}) | Downloaded ${(
        chunkBuf.byteLength / 1024
      ).toFixed(1)} KB | Hash match: ${actualHash === entry.hash} (${actualHash})`
    );

    downloadedChunks++;
    downloadedBytes += chunkBuf.byteLength;
  }

  const totalBytes = reusedBytes + downloadedBytes;
  const savedPct = ((reusedBytes / totalBytes) * 100).toFixed(2);
  console.log(`\n=== LIVE GITHUB RELEASES PARTIAL UPDATE SUMMARY ===`);
  console.log(`Reused local chunks:     ${reusedChunks} chunks (${(reusedBytes / (1024 * 1024)).toFixed(2)} MB)`);
  console.log(`Downloaded via HTTP 206: ${downloadedChunks} chunks (${(downloadedBytes / 1024).toFixed(1)} KB)`);
  console.log(`Bandwidth saved:         ${savedPct}%`);
}

verifyGitHubPartialUpdate();
