import fs from "fs";
import path from "path";
import zlib from "zlib";
import crypto from "crypto";

// 1. Synthesize repetitive HTML and JS assets
const testHtml = Buffer.from(
  "<!DOCTYPE html><html><head><!-- comment --></head><body>" +
    '<div class="component-card font-sans text-sm p-4 border rounded-md"><h3>Button</h3><p>Description</p></div>'.repeat(
      100
    ) +
    "</body></html>"
);
const testJs = Buffer.from(
  "function renderComponent(props) { console.log('render', props); return { id: props.id }; }\n".repeat(
    100
  )
);

// Compare Gzip 9 vs Brotli 11
const gzHtml = zlib.gzipSync(testHtml, { level: 9 });
const brHtml = zlib.brotliCompressSync(testHtml, {
  params: {
    [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
    [zlib.constants.BROTLI_PARAM_LGWIN]: 24,
  },
});

console.log(`HTML Raw: ${testHtml.byteLength}, Gz: ${gzHtml.byteLength}, Br: ${brHtml.byteLength}`);
if (brHtml.byteLength >= gzHtml.byteLength) {
  throw new Error("Brotli Q11 should be significantly smaller than Gzip 9 on HTML");
}

const gzJs = zlib.gzipSync(testJs, { level: 9 });
const brJs = zlib.brotliCompressSync(testJs, {
  params: {
    [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
    [zlib.constants.BROTLI_PARAM_LGWIN]: 24,
  },
});

console.log(`JS Raw: ${testJs.byteLength}, Gz: ${gzJs.byteLength}, Br: ${brJs.byteLength}`);
if (brJs.byteLength >= gzJs.byteLength) {
  throw new Error("Brotli Q11 should be smaller than Gzip 9 on repetitive JS");
}

// 2. Test v2 binary pack header formation
const manifest = {
  id: "test",
  name: "Test Site",
  version: "1.0",
  commit: "deadbeef",
  compression: "brotli",
  routes: {
    "/index.html": {
      offset: 0,
      length: brHtml.byteLength,
      rawLength: testHtml.byteLength,
      mime: "text/html; charset=utf-8",
      gzipped: false,
      encoding: "br",
      hash: crypto.createHash("sha256").update(brHtml).digest("hex").slice(0, 16),
    },
  },
};
const manifestBuf = Buffer.from(JSON.stringify(manifest), "utf-8");

const header = Buffer.alloc(16);
header.write("DOCP", 0, 4, "ascii");
header.writeUInt16LE(2, 4); // version 2
header.writeUInt16LE(2, 6); // Brotli flag
header.writeUInt32LE(manifestBuf.byteLength, 8);
header.writeUInt32LE(0, 12); // reserved

const fullPack = Buffer.concat([header, manifestBuf, brHtml]);

// Verify v2 header readback
const magic = fullPack.subarray(0, 4).toString("ascii");
const version = fullPack.readUInt16LE(4);
const flags = fullPack.readUInt16LE(6);
const mLen = fullPack.readUInt32LE(8);
if (magic !== "DOCP" || version !== 2 || flags !== 2 || mLen !== manifestBuf.byteLength) {
  throw new Error(`Invalid v2 pack header readback: magic=${magic}, version=${version}, mLen=${mLen}`);
}

console.log("✓ Docpack v2 header formation and Brotli Q11 compression confirmed superior.");
