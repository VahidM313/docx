import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface DeltaUnpacked {
  fromCommit: string;
  toCommit: string;
  manifest: any;
  chunks: Map<string, Buffer>;
}

export function generateDeltaPatch(
  oldManifest: any,
  newManifest: any,
  newChunksByHash: Map<string, Buffer>
): Buffer {
  const fromCommit = (oldManifest.commit || "").padEnd(8, " ").slice(0, 8);
  const toCommit = (newManifest.commit || "").padEnd(8, " ").slice(0, 8);

  // Find unique chunk hashes required by newManifest that were absent in oldManifest
  const oldHashes = new Set<string>();
  for (const entry of Object.values<any>(oldManifest.routes || {})) {
    if (entry.hash) oldHashes.add(entry.hash);
  }

  const missingHashes = new Set<string>();
  for (const entry of Object.values<any>(newManifest.routes || {})) {
    if (entry.hash && !oldHashes.has(entry.hash)) {
      missingHashes.add(entry.hash);
    }
  }

  const manifestBytes = Buffer.from(JSON.stringify(newManifest), "utf-8");

  // Chunk blocks
  const chunkBuffers: Buffer[] = [];
  for (const hash of missingHashes) {
    const chunkData = newChunksByHash.get(hash);
    if (!chunkData) {
      throw new Error(`Missing chunk data for hash ${hash}`);
    }
    const chunkHdr = Buffer.alloc(20);
    chunkHdr.write(hash.padEnd(16, " ").slice(0, 16), 0, 16, "ascii");
    chunkHdr.writeUInt32LE(chunkData.byteLength, 16);
    chunkBuffers.push(chunkHdr, chunkData);
  }

  // Header: DPTC (4) + fromCommit (8) + toCommit (8) + manifestLen (4) = 24 bytes
  const header = Buffer.alloc(24);
  header.write("DPTC", 0, 4, "ascii");
  header.write(fromCommit, 4, 8, "ascii");
  header.write(toCommit, 12, 8, "ascii");
  header.writeUInt32LE(manifestBytes.byteLength, 20);

  const chunkCountBuf = Buffer.alloc(4);
  chunkCountBuf.writeUInt32LE(missingHashes.size, 0);

  return Buffer.concat([header, manifestBytes, chunkCountBuf, ...chunkBuffers]);
}

export function unpackDeltaPatch(patch: Buffer): DeltaUnpacked {
  if (patch.byteLength < 28) {
    throw new Error("Invalid delta patch: buffer too short");
  }
  const magic = patch.subarray(0, 4).toString("ascii");
  if (magic !== "DPTC") {
    throw new Error(`Invalid delta patch magic: ${magic}`);
  }
  const fromCommit = patch.subarray(4, 12).toString("ascii").trim();
  const toCommit = patch.subarray(12, 20).toString("ascii").trim();
  const manifestLen = patch.readUInt32LE(20);

  const manifestStart = 24;
  const manifestEnd = manifestStart + manifestLen;
  if (patch.byteLength < manifestEnd + 4) {
    throw new Error("Truncated delta patch manifest");
  }

  const manifest = JSON.parse(patch.subarray(manifestStart, manifestEnd).toString("utf-8"));
  const chunkCount = patch.readUInt32LE(manifestEnd);

  const chunks = new Map<string, Buffer>();
  let offset = manifestEnd + 4;

  for (let i = 0; i < chunkCount; i++) {
    if (offset + 20 > patch.byteLength) {
      throw new Error("Truncated chunk header in delta patch");
    }
    const hash = patch.subarray(offset, offset + 16).toString("ascii").trim();
    const len = patch.readUInt32LE(offset + 16);
    offset += 20;

    if (offset + len > patch.byteLength) {
      throw new Error(`Truncated chunk data in delta patch for hash ${hash}`);
    }
    chunks.set(hash, patch.subarray(offset, offset + len));
    offset += len;
  }

  return { fromCommit, toCommit, manifest, chunks };
}
