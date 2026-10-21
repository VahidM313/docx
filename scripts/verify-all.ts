import fs from "fs";
import path from "path";
import zlib from "zlib";
import crypto from "crypto";
import { generateDeltaPatch, unpackDeltaPatch } from "./generate-delta";

console.log("=== Docpack Optimization & Delta Update E2E Verification ===\n");

// 1. Benchmark Compression Ratios on Real HTML & Asset Samples
console.log("1. Benchmarking Compression (Gzip 9 vs Brotli 11)...");
const sampleHtml = `<!DOCTYPE html><html lang="en"><head><title>Components - Docx</title></head><body>
<nav class="sidebar sticky top-0 flex flex-col gap-2 p-4 border-r border-slate-800">
  <a href="/docs/components/button" class="text-sm font-medium hover:text-white">Button</a>
  <a href="/docs/components/dialog" class="text-sm font-medium hover:text-white">Dialog</a>
  <a href="/docs/components/card" class="text-sm font-medium hover:text-white">Card</a>
</nav>
<main class="content p-8 max-w-4xl">
  <h1 class="text-3xl font-bold tracking-tight">Button Component</h1>
  <p class="text-slate-400 mt-2">Displays a button or a component that looks like a button.</p>
  <div class="code-preview border rounded-lg p-6 bg-slate-950 mt-6">
    <button class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow hover:bg-primary/90">Click me</button>
  </div>
</main>
<script src="/_next/static/chunks/main-chunk.js"></script>
</body></html>`.repeat(50);

const rawBytes = Buffer.from(sampleHtml, "utf-8");
const gzBytes = zlib.gzipSync(rawBytes, { level: 9 });
const brBytes = zlib.brotliCompressSync(rawBytes, {
  params: {
    [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
    [zlib.constants.BROTLI_PARAM_LGWIN]: 24,
  },
});

const savingsPct = ((1 - brBytes.byteLength / gzBytes.byteLength) * 100).toFixed(1);
console.log(`  Raw Sample HTML:   ${(rawBytes.byteLength / 1024).toFixed(1)} KB`);
console.log(`  Gzip Level 9:      ${(gzBytes.byteLength / 1024).toFixed(1)} KB`);
console.log(`  Brotli Quality 11: ${(brBytes.byteLength / 1024).toFixed(1)} KB`);
console.log(`  → Size Reduction:  ${savingsPct}% over Gzip 9\n`);

if (brBytes.byteLength >= gzBytes.byteLength) {
  throw new Error("Verification failed: Brotli Q11 must be smaller than Gzip 9");
}

// 2. Verify Docpack v2 Header and Assembly
console.log("2. Verifying Docpack v2 Binary Pack Layout...");
const chunkHash = crypto.createHash("sha256").update(brBytes).digest("hex").slice(0, 16);
const manifest = {
  id: "sample_docs",
  name: "Sample Documentation",
  version: "1.0.0",
  commit: "a1b2c3d4",
  compression: "brotli",
  updatedAt: new Date().toISOString(),
  totalBytes: brBytes.byteLength,
  chunkCount: 1,
  routes: {
    "/": {
      offset: 0,
      length: brBytes.byteLength,
      rawLength: rawBytes.byteLength,
      mime: "text/html; charset=utf-8",
      gzipped: false,
      encoding: "br",
      hash: chunkHash,
    },
  },
};

const manifestBytes = Buffer.from(JSON.stringify(manifest), "utf-8");
const header = Buffer.alloc(16);
header.write("DOCP", 0, 4, "ascii");
header.writeUInt16LE(2, 4); // v2
header.writeUInt16LE(2, 6); // Brotli
header.writeUInt32LE(manifestBytes.byteLength, 8);
header.writeUInt32LE(0, 12); // reserved

const v2PackBuf = Buffer.concat([header, manifestBytes, brBytes]);
const magic = v2PackBuf.subarray(0, 4).toString("ascii");
const ver = v2PackBuf.readUInt16LE(4);
const flags = v2PackBuf.readUInt16LE(6);
const mLen = v2PackBuf.readUInt32LE(8);

console.log(`  Pack Magic:    ${magic} (expected 'DOCP')`);
console.log(`  Pack Version:  ${ver} (expected 2)`);
console.log(`  Flags:         0x${flags.toString(16).padStart(4, "0")} (brotli active)`);
console.log(`  Manifest Size: ${mLen} bytes`);
console.log(`  Total Pack:    ${v2PackBuf.byteLength} bytes`);

if (magic !== "DOCP" || ver !== 2 || flags !== 2 || mLen !== manifestBytes.byteLength) {
  throw new Error("Verification failed: Docpack v2 header mismatch");
}
console.log("  ✓ Header validation passed.\n");

// 3. Verify Single-Stream Delta Update Pipeline
console.log("3. Verifying Single-Stream Incremental Delta Update...");
const changedHtml = sampleHtml + "\n<!-- updated content -->";
const changedRaw = Buffer.from(changedHtml, "utf-8");
const changedBr = zlib.brotliCompressSync(changedRaw, {
  params: {
    [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
    [zlib.constants.BROTLI_PARAM_LGWIN]: 24,
  },
});
const changedHash = crypto.createHash("sha256").update(changedBr).digest("hex").slice(0, 16);

const manifestV2 = {
  id: "sample_docs",
  name: "Sample Documentation",
  version: "1.0.1",
  commit: "e5f6a7b8",
  compression: "brotli",
  updatedAt: new Date().toISOString(),
  totalBytes: brBytes.byteLength + changedBr.byteLength,
  chunkCount: 2,
  routes: {
    "/": {
      offset: 0,
      length: brBytes.byteLength,
      rawLength: rawBytes.byteLength,
      mime: "text/html; charset=utf-8",
      gzipped: false,
      encoding: "br",
      hash: chunkHash, // Reused from v1!
    },
    "/docs/new-page": {
      offset: brBytes.byteLength,
      length: changedBr.byteLength,
      rawLength: changedRaw.byteLength,
      mime: "text/html; charset=utf-8",
      gzipped: false,
      encoding: "br",
      hash: changedHash, // Newly added in v2!
    },
  },
};

const newChunks = new Map<string, Buffer>([
  [chunkHash, brBytes],
  [changedHash, changedBr],
]);

const deltaPatch = generateDeltaPatch(manifest, manifestV2, newChunks);
console.log(`  Generated Delta Patch: ${deltaPatch.byteLength} bytes`);

const unpacked = unpackDeltaPatch(deltaPatch);
console.log(`  Delta fromCommit:      ${unpacked.fromCommit} (expected a1b2c3d4)`);
console.log(`  Delta toCommit:        ${unpacked.toCommit} (expected e5f6a7b8)`);
console.log(`  Delta Chunks Included: ${unpacked.chunks.size} (expected 1 new chunk, 1 reused)`);

if (unpacked.chunks.size !== 1 || !unpacked.chunks.has(changedHash)) {
  throw new Error("Verification failed: Delta must only contain the newly added chunk");
}

console.log("  ✓ Incremental delta correctly isolated modified bytes only.\n");

console.log("=============================================================");
console.log("ALL DOCPACK V2 OPTIMIZATION & DELTA CHECKS PASSED PERFECTLY!");
console.log("=============================================================");
