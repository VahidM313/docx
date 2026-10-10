import fs from "fs";
import path from "path";

interface ManifestEntry {
  offset: number;
  length: number;
  mime: string;
  gzipped: boolean;
}

const MIME_MAP: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

const INJECTED_BYTES = Buffer.from(
  `<style id="docx-styled-scroll">
::-webkit-scrollbar {
  width: 8px !important;
  height: 8px !important;
}
::-webkit-scrollbar-track {
  background: #070709 !important;
}
::-webkit-scrollbar-thumb {
  background-color: #24242b !important;
  border-radius: 999px !important;
  border: 2px solid #070709 !important;
  min-height: 36px !important;
}
::-webkit-scrollbar-thumb:hover {
  background-color: #3a3a45 !important;
}
::-webkit-scrollbar-thumb:active {
  background-color: #50505f !important;
}
::-webkit-scrollbar-corner {
  background: transparent !important;
}
* {
  scrollbar-width: thin;
  scrollbar-color: #24242b #070709;
}
</style>
<script>
(function(){
  try {
    if (!localStorage.getItem('theme')) {
      localStorage.setItem('theme', 'dark');
    }
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    }
  } catch (e) {}

  window.addEventListener('keydown', function(e){
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){
      e.preventDefault();
      e.stopPropagation();
      window.parent.postMessage({ type: 'OPEN_UNIVERSAL_SEARCH' }, '*');
    }
  }, true);

  var lastLeftSent = 0;
  var lastTopSent = 0;
  window.addEventListener('mousemove', function(e){
    var now = Date.now();
    if (e.clientX <= 18 && now - lastLeftSent > 120) {
      lastLeftSent = now;
      window.parent.postMessage({ type: 'HOVER_LEFT_EDGE' }, '*');
    }
    if (e.clientY <= 10 && now - lastTopSent > 120) {
      lastTopSent = now;
      window.parent.postMessage({ type: 'HOVER_TOP_EDGE' }, '*');
    }
  }, { passive: true });

  window.addEventListener('mousedown', function(){
    window.parent.postMessage({ type: 'IFRAME_INTERACT' }, '*');
  }, { passive: true });

  document.addEventListener('click', function(e){
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if(!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var href = a.getAttribute('href');
    if(!href || href.startsWith('#') || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || a.getAttribute('target') === '_blank') return;
    e.preventDefault();
    e.stopPropagation();
    window.location.href = href;
  }, true);
})();
</script>`,
  "utf-8"
);

const chunks: Uint8Array[] = [];
let currentOffset = 0;
const manifest: Record<string, ManifestEntry> = {};

function addAsset(key: string, rawBytes: Buffer, ext: string) {
  if (manifest[key]) return;
  const mime = MIME_MAP[ext.toLowerCase()] || "application/octet-stream";

  const finalBytes = ext === ".html" ? Buffer.concat([rawBytes, INJECTED_BYTES]) : rawBytes;
  const gzLevel = finalBytes.byteLength > 600 * 1024 ? 6 : 9;
  const compressed = Bun.gzipSync(finalBytes, { level: gzLevel });
  const offset = currentOffset;
  const length = compressed.byteLength;

  chunks.push(compressed);
  currentOffset += length;

  manifest[key] = {
    offset,
    length,
    mime,
    gzipped: true,
  };
}

function walkStatic(dir: string, callback: (fullPath: string, relPath: string) => void, baseDir = dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "r" || entry.name === "showcase" || entry.name === "blog" || entry.name === "examples") continue;
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      walkStatic(fullPath, callback, baseDir);
    } else if (entry.isFile()) {
      callback(fullPath, relPath);
    }
  }
}

function packStaticAndPublic(prefix: "tw" | "sh", siteRoot: string) {
  const t0 = Date.now();
  const staticDir = path.join(siteRoot, ".next", "static");
  walkStatic(staticDir, (fullPath, relPath) => {
    const ext = path.extname(fullPath).toLowerCase();
    // Skip marketing showcase images inside .next/static/media (keep fonts & SVGs)
    if ([".jpg", ".jpeg", ".png", ".webp", ".avif"].includes(ext)) {
      if (fs.statSync(fullPath).size > 80 * 1024) return;
    }
    addAsset(`${prefix}:/_next/static/${relPath}`, fs.readFileSync(fullPath), ext);
  });

  const publicDir = path.join(siteRoot, "public");
  walkStatic(publicDir, (fullPath, relPath) => {
    const ext = path.extname(fullPath).toLowerCase();
    if (fs.statSync(fullPath).size > 120 * 1024) return;
    addAsset(`${prefix}:/${relPath}`, fs.readFileSync(fullPath), ext);
  });
  console.log(`Packed ${prefix} static+public in ${Date.now() - t0}ms`);
}

const tStart = Date.now();
packStaticAndPublic("tw", "d:/Dev/crawl/tailwindcss-site");
packStaticAndPublic("sh", "d:/Dev/crawl/shadcn-site/apps/v4");

const searchIndex = JSON.parse(fs.readFileSync("d:/Dev/crawl/search-index.json", "utf-8"));

const twAppDir = "d:/Dev/crawl/tailwindcss-site/.next/server/app";
const shAppDir = "d:/Dev/crawl/shadcn-site/apps/v4/.next/server/app";

const extraTwRoutes = [
  "/index",
  "/docs/installation/using-vite",
  "/docs/installation/using-postcss",
  "/docs/installation/tailwind-cli",
  "/docs/installation/play-cdn",
  "/docs/installation/framework-guides",
  "/docs/installation/framework-guides/nextjs",
  "/docs/installation/framework-guides/vite",
  "/docs/installation/framework-guides/astro",
  "/docs/installation/framework-guides/remix",
  "/docs/installation/framework-guides/nuxt",
  "/docs/installation/framework-guides/sveltekit",
  "/docs/installation/framework-guides/laravel/vite",
];

for (const r of extraTwRoutes) {
  const htmlFile = path.join(twAppDir, `${r}.html`);
  if (fs.existsSync(htmlFile)) {
    const cleanRoute = r === "/index" ? "/" : r;
    addAsset(`tw:${cleanRoute}`, fs.readFileSync(htmlFile), ".html");
  }
}

for (const r of ["/index", "/docs", "/blocks", "/colors"]) {
  const htmlFile = path.join(shAppDir, `${r}.html`);
  if (fs.existsSync(htmlFile)) {
    const cleanRoute = r === "/index" ? "/" : r;
    addAsset(`sh:${cleanRoute}`, fs.readFileSync(htmlFile), ".html");
  }
}

let htmlCount = 0;
for (const item of searchIndex) {
  if (item.site === "tailwind") {
    const htmlFile = path.join(twAppDir, `${item.path}.html`);
    if (fs.existsSync(htmlFile)) {
      addAsset(`tw:${item.path}`, fs.readFileSync(htmlFile), ".html");
      htmlCount++;
    }
  } else if (item.site === "shadcn") {
    const rawRel = item.id.replace(/^shadcn:/, "").replace(/^\(root\)\//, "");
    if (rawRel.startsWith("components/base/") || rawRel.startsWith("components/aria/")) {
      continue;
    }
    const htmlFile = path.join(shAppDir, "docs", `${rawRel}.html`);
    if (fs.existsSync(htmlFile)) {
      const route = `/docs/${rawRel}`;
      addAsset(`sh:${route}`, fs.readFileSync(htmlFile), ".html");
      htmlCount++;
      if (rawRel.startsWith("components/radix/")) {
        const slug = rawRel.replace("components/radix/", "");
        manifest[`sh:/docs/components/${slug}`] = manifest[`sh:${route}`];
        manifest[`sh:/docs/components/base/${slug}`] = manifest[`sh:${route}`];
        manifest[`sh:/docs/components/aria/${slug}`] = manifest[`sh:${route}`];
      }
    }
  }
  if (htmlCount > 0 && htmlCount % 50 === 0) {
    console.log(`Packed ${htmlCount} HTML pages (${((Date.now() - tStart) / 1000).toFixed(1)}s)...`);
  }
}

if (manifest["tw:/docs/installation/using-vite"]) {
  manifest["tw:/docs"] = manifest["tw:/docs/installation/using-vite"];
  manifest["tw:/docs/installation"] = manifest["tw:/docs/installation/using-vite"];
}

console.log(`All ${htmlCount} HTML pages packed in ${Date.now() - tStart}ms`);

const manifestJson = Buffer.from(JSON.stringify(manifest), "utf-8");
const header = Buffer.alloc(4);
header.writeUInt32LE(manifestJson.length, 0);

const outPath = "d:/Dev/crawl/docs-desktop/src-tauri/assets.pack";
const finalBuffer = Buffer.concat([header, manifestJson, ...chunks.map((c) => Buffer.from(c.buffer, c.byteOffset, c.byteLength))]);
fs.writeFileSync(outPath, finalBuffer);

const totalMB = (finalBuffer.byteLength / (1024 * 1024)).toFixed(2);
console.log(
  `Successfully packed ${Object.keys(manifest).length} routes/assets into ${outPath} (${totalMB} MB) in ${Date.now() - tStart}ms`
);
