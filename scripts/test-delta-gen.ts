import assert from "assert";
import { generateDeltaPatch, unpackDeltaPatch } from "./generate-delta";

const oldManifest = {
  id: "sample",
  name: "Sample Site",
  version: "1.0",
  commit: "11111111",
  routes: {
    "/a": { offset: 0, length: 5, mime: "text/plain", gzipped: false, hash: "aaaa111122223333" },
    "/b": { offset: 5, length: 5, mime: "text/plain", gzipped: false, hash: "bbbb111122223333" },
  },
};

const newManifest = {
  id: "sample",
  name: "Sample Site",
  version: "1.1",
  commit: "22222222",
  routes: {
    "/a": { offset: 0, length: 5, mime: "text/plain", gzipped: false, hash: "aaaa111122223333" }, // reused
    "/b": { offset: 5, length: 7, mime: "text/plain", gzipped: false, hash: "cccc111122223333" }, // changed!
  },
};

const newChunks = new Map<string, Buffer>([
  ["cccc111122223333", Buffer.from("chunks!")],
]);

const patchBuffer = generateDeltaPatch(oldManifest, newManifest, newChunks);
assert(patchBuffer.subarray(0, 4).toString("ascii") === "DPTC", "Magic must be DPTC");

const unpacked = unpackDeltaPatch(patchBuffer);
assert.strictEqual(unpacked.fromCommit, "11111111");
assert.strictEqual(unpacked.toCommit, "22222222");
assert.strictEqual(unpacked.manifest.commit, "22222222");
assert.strictEqual(unpacked.chunks.size, 1);
assert.strictEqual(unpacked.chunks.get("cccc111122223333")?.toString(), "chunks!");

console.log("✓ Delta patch generation and unpack verified successfully.");
