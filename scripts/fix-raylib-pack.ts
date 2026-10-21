import fs from "fs";
import path from "path";
import zlib from "zlib";
import crypto from "crypto";

const modules = [
  { id: "core", file: "raylib_core.c" },
  { id: "shapes", file: "raylib_shapes.c" },
  { id: "textures", file: "raylib_textures.c" },
  { id: "text", file: "raylib_text.c" },
  { id: "models", file: "raylib_models.c" },
  { id: "audio", file: "raylib_audio.c" },
  { id: "structs", file: "raylib_structs.c" },
  { id: "colors", file: "raylib_colors.c" },
];

async function fetchFile(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: status ${res.status}`);
  return await res.text();
}

async function main() {
  console.log("=== Fixing Raylib Documentation Pack ===");

  // 1. Fetch all C modules for English
  const cDataEn: Record<string, string> = {};
  for (const mod of modules) {
    const url = `https://www.raylib.com/cheatsheet/en/${mod.file}`;
    console.log(`Fetching ${url}...`);
    cDataEn[mod.id] = await fetchFile(url);
  }
  const raymathEn = await fetchFile("https://www.raylib.com/cheatsheet/en/raylib_raymath.c");

  // 2. Fetch cheatsheet HTML pages
  let cheatsheetHtml = await fetchFile("https://www.raylib.com/cheatsheet/cheatsheet.html");
  let raymathHtml = await fetchFile("https://www.raylib.com/cheatsheet/raymath_cheatsheet.html");

  // 3. Pre-populate English cheatsheet HTML with code
  for (const mod of modules) {
    const code = cDataEn[mod.id];
    // Replace <div id="core"><pre><code class="cpp"></code></pre></div>
    const regex = new RegExp(`(<div id="${mod.id}">\\s*<pre><code class="cpp">)[\\s\\S]*?(<\\/code><\\/pre>\\s*<\\/div>)`, "i");
    const escapedCode = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    cheatsheetHtml = cheatsheetHtml.replace(regex, `$1${escapedCode}$2`);
  }

  // Pre-populate raymath HTML
  const raymathEscaped = raymathEn
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  cheatsheetHtml = cheatsheetHtml.replace(
    /(<div id="math">\s*<pre><code class="cpp">)[\s\S]*?(<\/code><\/pre>\s*<\/div>)/i,
    `$1${raymathEscaped}$2`
  );
  raymathHtml = raymathHtml.replace(
    /(<div id="math">\s*<pre><code class="cpp">)[\s\S]*?(<\/code><\/pre>\s*<\/div>)/i,
    `$1${raymathEscaped}$2`
  );

  // 4. Inject clean responsive styling & dark mode support for pre code
  const customCss = `
  <style id="docx-raylib-fix">
    pre code {
      display: block !important;
      white-space: pre !important;
      overflow-x: auto !important;
      font-family: 'JetBrains Mono', Consolas, monospace !important;
      font-size: 12px !important;
      line-height: 1.5 !important;
      padding: 12px !important;
      border-radius: 6px !important;
    }
    body.darkmode pre code,
    html.docx-smart-dark pre code {
      background-color: #121316 !important;
      color: #e2e8f0 !important;
      border-color: #27272a !important;
    }
    body.darkmode #header,
    html.docx-smart-dark #header {
      background-color: #0b0c0e !important;
      color: #f8fafc !important;
    }
    html.docx-smart-dark body {
      background-color: #090a0c !important;
      color: #f1f5f9 !important;
    }
  </style>
  `;
  cheatsheetHtml = cheatsheetHtml.replace("</head>", `${customCss}</head>`);
  raymathHtml = raymathHtml.replace("</head>", `${customCss}</head>`);

  // Remove broken external CDN script that throws hljs ReferenceError
  cheatsheetHtml = cheatsheetHtml.replace(/<script src="[^"]*highlight\.min\.js"><\/script>/gi, "");
  raymathHtml = raymathHtml.replace(/<script src="[^"]*highlight\.min\.js"><\/script>/gi, "");

  // 5. Build raw asset map
  const rawAssets = new Map<string, { bytes: Buffer; mime: string }>();

  function addAsset(routePath: string, content: string | Buffer, mime: string) {
    const bytes = typeof content === "string" ? Buffer.from(content, "utf-8") : content;
    rawAssets.set(routePath, { bytes, mime });
  }

  addAsset("/", cheatsheetHtml, "text/html; charset=utf-8");
  addAsset("/docs", cheatsheetHtml, "text/html; charset=utf-8");
  addAsset("/cheatsheet/cheatsheet.html", cheatsheetHtml, "text/html; charset=utf-8");
  addAsset("/cheatsheet/raymath_cheatsheet.html", raymathHtml, "text/html; charset=utf-8");

  // Add individual C files
  for (const mod of modules) {
    addAsset(`/cheatsheet/en/${mod.file}`, cDataEn[mod.id], "text/plain; charset=utf-8");
    addAsset(`/en/${mod.file}`, cDataEn[mod.id], "text/plain; charset=utf-8");
  }
  addAsset("/cheatsheet/en/raylib_raymath.c", raymathEn, "text/plain; charset=utf-8");
  addAsset("/en/raylib_raymath.c", raymathEn, "text/plain; charset=utf-8");

  // 6. Compress each asset with Brotli Q11 and build chunks
  const compressedChunks: Buffer[] = [];
  const routes: Record<string, any> = {};
  let currentOffset = 0;

  for (const [routePath, asset] of rawAssets.entries()) {
    const br = zlib.brotliCompressSync(asset.bytes, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
        [zlib.constants.BROTLI_PARAM_LGWIN]: 24,
      },
    });
    compressedChunks.push(br);
    routes[routePath] = {
      offset: currentOffset,
      length: br.byteLength,
      rawLength: asset.bytes.byteLength,
      mime: asset.mime,
      gzipped: false,
      encoding: "br",
      hash: crypto.createHash("sha256").update(br).digest("hex").slice(0, 16),
    };
    currentOffset += br.byteLength;
  }

  const manifest = {
    id: "raylib",
    name: "Raylib Cheatsheet & API",
    version: "v5.5",
    commit: crypto.createHash("sha256").update(Date.now().toString()).digest("hex").slice(0, 8),
    updatedAt: new Date().toISOString(),
    totalBytes: currentOffset,
    chunkCount: rawAssets.size,
    compression: "brotli",
    routes,
  };

  const manifestBuf = Buffer.from(JSON.stringify(manifest), "utf-8");

  // v2 Header: 16 bytes
  const header = Buffer.alloc(16);
  header.write("DOCP", 0, 4, "ascii");
  header.writeUInt16LE(2, 4); // v2
  header.writeUInt16LE(2, 6); // Brotli flag
  header.writeUInt32LE(manifestBuf.byteLength, 8);
  header.writeUInt32LE(0, 12);

  const fullPack = Buffer.concat([header, manifestBuf, ...compressedChunks]);

  // Write to packs/ and AppData/
  const outPacks = path.resolve("packs");
  const appData = path.resolve("C:/Users/vahid/AppData/Local/docx");

  fs.writeFileSync(path.join(outPacks, "raylib.docpack"), fullPack);
  fs.writeFileSync(path.join(outPacks, "raylib.manifest.json"), JSON.stringify(manifest, null, 2));

  if (fs.existsSync(appData)) {
    fs.writeFileSync(path.join(appData, "raylib.docpack"), fullPack);
    fs.writeFileSync(path.join(appData, "raylib.manifest.json"), JSON.stringify(manifest, null, 2));
  }

  console.log(`✓ Pack generated successfully! Total size: ${fullPack.byteLength} bytes.`);
}

main().catch(console.error);
