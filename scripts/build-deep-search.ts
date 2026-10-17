import fs from "fs";
import path from "path";
import { gzipSync, gunzipSync } from "zlib";
import { createHash } from "crypto";

const APPDATA_DIR = "C:/Users/vahid/AppData/Local/docx";
const REPO_PACKS_DIR = path.resolve(import.meta.dir, "..", "packs");

function fnv1aHex(buf: Buffer): string {
  let hash = 0xcbf29ce484222325n;
  for (let i = 0; i < buf.length; i++) {
    hash ^= BigInt(buf[i]);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#039;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " "));
}

// 1. Enrich cppreference.docpack with high-value standalone C++ symbol pages
async function enrichCppReferenceDocpack() {
  const packPath = path.join(APPDATA_DIR, "cppreference.docpack");
  if (!fs.existsSync(packPath)) return;

  const buf = fs.readFileSync(packPath);
  const manifestLen = buf.readUInt32LE(0);
  const manifest = JSON.parse(buf.subarray(4, 4 + manifestLen).toString("utf8"));
  const dataStart = 4 + manifestLen;

  const extraRoutes = [
    "/cpp/io/cout",
    "/cpp/io/cin",
    "/cpp/io/cerr",
    "/cpp/io/clog",
    "/cpp/io/manip/endl",
    "/cpp/io/manip/flush",
    "/cpp/io/manip/setw",
    "/cpp/io/manip/setprecision",
    "/cpp/io/manip/fixed",
    "/cpp/io/manip/boolalpha",
    "/cpp/io/basic_istream",
    "/cpp/io/basic_iostream",
    "/cpp/io/basic_ifstream",
    "/cpp/io/basic_ofstream",
    "/cpp/io/basic_fstream",
    "/cpp/io/basic_stringstream",
    "/cpp/io/basic_istringstream",
    "/cpp/io/basic_ostringstream",
    "/cpp/io/print",
    "/cpp/io/println",
    "/cpp/io/c/printf",
    "/cpp/io/c/scanf",
    "/cpp/io/c/fopen",
    "/cpp/header/iostream",
    "/cpp/header/vector",
    "/cpp/header/string",
    "/cpp/header/algorithm",
    "/cpp/header/memory",
    "/cpp/header/map",
    "/cpp/header/unordered_map",
    "/cpp/header/set",
    "/cpp/header/fstream",
    "/cpp/header/sstream",
    "/cpp/header/iomanip",
    "/cpp/header/cmath",
    "/cpp/header/cstdio",
    "/cpp/header/cstdlib",
    "/cpp/header/cstring",
    "/cpp/header/thread",
    "/cpp/header/mutex",
    "/cpp/header/utility",
    "/cpp/header/optional",
    "/cpp/header/variant",
    "/cpp/header/format",
    "/cpp/algorithm/sort",
    "/cpp/algorithm/find",
    "/cpp/algorithm/binary_search",
    "/cpp/algorithm/lower_bound",
    "/cpp/algorithm/upper_bound",
    "/cpp/algorithm/transform",
    "/cpp/algorithm/for_each",
    "/cpp/algorithm/copy",
    "/cpp/algorithm/min",
    "/cpp/algorithm/max",
    "/cpp/algorithm/swap",
    "/cpp/algorithm/count",
    "/cpp/algorithm/accumulate",
    "/cpp/memory/unique_ptr",
    "/cpp/memory/shared_ptr",
    "/cpp/memory/weak_ptr",
    "/cpp/memory/make_unique",
    "/cpp/memory/make_shared",
    "/cpp/string/basic_string/getline",
    "/cpp/string/basic_string/to_string",
    "/cpp/string/basic_string/stol",
    "/cpp/utility/move",
    "/cpp/utility/forward",
    "/cpp/utility/pair",
    "/cpp/thread/thread",
    "/cpp/thread/jthread",
    "/cpp/thread/mutex",
    "/cpp/thread/lock_guard",
    "/cpp/thread/unique_lock",
    "/cpp/thread/condition_variable",
    "/cpp/thread/async",
    "/cpp/thread/future",
  ];

  const missingRoutes = extraRoutes.filter((r) => !manifest.routes[r] && !manifest.routes[`/w${r}`]);
  if (missingRoutes.length === 0) {
    console.log("✓ cppreference.docpack already has all extra standalone symbol routes.");
    return;
  }

  console.log(`⚡ Fetching ${missingRoutes.length} high-value C++ symbol pages for cppreference.docpack...`);

  // Collect existing chunks
  const chunks: Buffer[] = [buf.subarray(dataStart)];
  let currentOffset = buf.length - dataStart;
  let added = 0;

  const concurrency = 3;
  let idx = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (idx < missingRoutes.length) {
      const route = missingRoutes[idx++];
      if (!route) break;
      const url = `https://en.cppreference.com/w${route}`;
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml",
          },
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          let html = await res.text();
          // Normalize internal /w/cpp/... links to /cpp/... so they match existing cppreference routes
          html = html.replace(/href="\/w\/(cpp\/[^"]+)"/g, 'href="/$1"');
          html = html.replace(/href="https?:\/\/en\.cppreference\.com\/w\/(cpp\/[^"]+)"/g, 'href="/$1"');
          const gz = gzipSync(Buffer.from(html, "utf8"), { level: 9 });
          const hash = fnv1aHex(gz);
          const entry = {
            offset: currentOffset,
            length: gz.length,
            mime: "text/html; charset=utf-8",
            gzipped: true,
            hash,
          };
          chunks.push(gz);
          currentOffset += gz.length;
          manifest.routes[route] = entry;
          manifest.routes[`/w${route}`] = entry;
          added++;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 120));
    }
  });

  await Promise.all(workers);

  if (added > 0) {
    const dataBuf = Buffer.concat(chunks);
    const uniqueOffsets = new Set(Object.values(manifest.routes).map((r: any) => r.offset));
    manifest.totalBytes = dataBuf.length;
    manifest.chunkCount = uniqueOffsets.size;
    manifest.updatedAt = new Date().toISOString();

    const manifestBytes = Buffer.from(JSON.stringify(manifest), "utf8");
    const header = Buffer.alloc(4);
    header.writeUInt32LE(manifestBytes.length, 0);
    const finalPack = Buffer.concat([header, manifestBytes, dataBuf]);

    fs.writeFileSync(packPath, finalPack);
    fs.writeFileSync(path.join(APPDATA_DIR, "cppreference.manifest.json"), JSON.stringify(manifest, null, 2));
    if (fs.existsSync(REPO_PACKS_DIR)) {
      fs.writeFileSync(path.join(REPO_PACKS_DIR, "cppreference.docpack"), finalPack);
      fs.writeFileSync(path.join(REPO_PACKS_DIR, "cppreference.manifest.json"), JSON.stringify(manifest, null, 2));
    }
    console.log(`✓ Added ${added} standalone C++ symbol pages to cppreference.docpack (now ${Object.keys(manifest.routes).length} routes).`);
  }
}

function cleanPageTitle(rawTitle: string, siteName: string): string {
  let t = decodeHtmlEntities(rawTitle);
  t = t
    .replace(/\s*[|—–-]\s*(cppreference\.com|Learn C\+\+|The Rust Programming Language|Rust Documentation|React|Vue\.js|Angular|Next\.js|TypeScript|Python [\d.]+ documentation|MDN Web Docs|MDN|Go Documentation|Tailwind CSS|shadcn\/ui|Documentation|Docs)\s*$/i, "")
    .trim();
  return t || siteName;
}

function humanizeCategory(route: string, siteName: string): string {
  const segs = route
    .split("#")[0]
    .split("/")
    .filter((s) => s && s !== "docs" && s !== "w" && s !== "en" && s !== "stable" && s !== "latest");
  if (segs.length >= 2) {
    return `${siteName} › ${segs[0].replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`;
  }
  return siteName;
}

function extractDeepEntriesForSite(siteId: string, packBuf: Buffer): any[] {
  if (packBuf.length < 8) return [];
  const manifestLen = packBuf.readUInt32LE(0);
  if (packBuf.length < 4 + manifestLen) return [];
  const manifest = JSON.parse(packBuf.subarray(4, 4 + manifestLen).toString("utf8"));
  const dataStart = 4 + manifestLen;
  const siteName: string = manifest.name || siteId;

  const entries: any[] = [];
  const seenCanonRoutes = new Set<string>();
  const seenEntryKeys = new Set<string>();

  const routeKeys = Object.keys(manifest.routes || {}).sort((a, b) => a.length - b.length);

  for (const route of routeKeys) {
    const meta = manifest.routes[route];
    if (!meta || !String(meta.mime || "").includes("html")) continue;
    if (
      route.includes("_static/") ||
      route.includes("_assets/") ||
      route.endsWith(".js") ||
      route.endsWith(".css")
    ) {
      continue;
    }

    // Deduplicate `/foo/` vs `/foo` and `/w/cpp/...` vs `/cpp/...`
    const canon = (route.replace(/^\/w\/cpp\//, "/cpp/").replace(/\/+$/, "") || "/").toLowerCase();
    if (seenCanonRoutes.has(canon)) continue;
    seenCanonRoutes.add(canon);

    const start = dataStart + meta.offset;
    const end = start + meta.length;
    if (end > packBuf.length) continue;

    let html = "";
    try {
      const slice = packBuf.subarray(start, end);
      html = (meta.gzipped ? gunzipSync(slice) : slice).toString("utf8");
    } catch {
      continue;
    }
    if (!html || html.length < 40) continue;

    // 1. Extract <title> or <h1>
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const rawTitle = titleMatch ? stripTags(titleMatch[1]) : h1Match ? stripTags(h1Match[1]) : "";
    const title = cleanPageTitle(rawTitle, siteName);
    if (title.toLowerCase().includes("404") || title.toLowerCase().includes("page not found")) continue;

    // Strip script, style, svg, nav, footer for clean content extraction
    const bodyHtml = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ");

    // 2. Extract headings (h1, h2, h3, h4) and section anchors
    const headings: string[] = [];
    const headingSeen = new Set<string>();
    const sectionAnchors: { id: string; text: string }[] = [];

    const headingRegex = /<h([1-4])([^>]*)>([\s\S]*?)<\/h\1>/gi;
    let hm: RegExpExecArray | null;
    while ((hm = headingRegex.exec(bodyHtml)) !== null) {
      const attrs = hm[2] || "";
      const hText = stripTags(hm[3]).replace(/^[#§¶]+|\s*[#§¶]+$/g, "").trim();
      if (!hText || hText.length < 2 || hText.length > 110) continue;
      const hLower = hText.toLowerCase();
      if (!headingSeen.has(hLower)) {
        headingSeen.add(hLower);
        if (headings.length < 35) headings.push(hText);
      }
      const idMatch = attrs.match(/\bid=["']([^"']+)["']/i) || hm[3].match(/\bid=["']([^"']+)["']/i);
      if (idMatch && idMatch[1] && (hm[1] === "2" || hm[1] === "3")) {
        sectionAnchors.push({ id: idMatch[1], text: hText });
      }
    }

    // 3. Extract code symbols / identifiers from <code>, <tt>, <dt>, .t-dsc-member-div
    const symbolSet = new Set<string>();
    // Add words from title and route
    for (const w of `${title} ${route}`.toLowerCase().split(/[^a-z0-9_:+!.-]+/)) {
      if (w.length >= 2 && w.length <= 40) symbolSet.add(w);
    }
    for (const h of headings) {
      for (const w of h.toLowerCase().split(/[^a-z0-9_:+!.-]+/)) {
        if (w.length >= 2 && w.length <= 40) symbolSet.add(w);
      }
    }

    const codeRegex = /<(?:code|tt|dt)\b[^>]*>([\s\S]{1,120}?)<\/(?:code|tt|dt)>/gi;
    let cm: RegExpExecArray | null;
    while ((cm = codeRegex.exec(bodyHtml)) !== null && symbolSet.size < 110) {
      const codeText = stripTags(cm[1]).trim();
      if (!codeText || codeText.length < 2 || codeText.length > 55) continue;
      // Extract clean symbol tokens (e.g. std::cout, cout, println!, useState, Vec::new)
      const tokens = codeText.split(/[\s(),;={}<>\[\]"'`]+/).filter(Boolean);
      for (const tok of tokens.slice(0, 4)) {
        const cleanTok = tok.replace(/^[:.]+|[:.]+$/g, "").toLowerCase();
        if (cleanTok.length >= 2 && cleanTok.length <= 42 && /^[a-z_@#$-][a-z0-9_:$!.-]*$/i.test(cleanTok)) {
          symbolSet.add(cleanTok);
          if (cleanTok.includes("::")) {
            const shortSym = cleanTok.split("::").pop();
            if (shortSym && shortSym.length >= 2) symbolSet.add(shortSym);
          }
        }
      }
    }

    // 4. Extract lead paragraph / description text
    let description = "";
    const metaDescMatch =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    if (metaDescMatch && metaDescMatch[1]) {
      description = decodeHtmlEntities(metaDescMatch[1]);
    }

    const pRegex = /<p\b[^>]*>([\s\S]{20,600}?)<\/p>/gi;
    let pm: RegExpExecArray | null;
    const pSnippets: string[] = [];
    while ((pm = pRegex.exec(bodyHtml)) !== null && pSnippets.length < 3) {
      const pt = stripTags(pm[1]);
      if (pt.length >= 35 && !pt.toLowerCase().startsWith("table of contents")) {
        pSnippets.push(pt);
      }
    }
    const bodyPreview = pSnippets.join(" ").slice(0, 240);
    if (!description || description.length < 30) {
      description = bodyPreview || `${title} — ${siteName} documentation`;
    } else if (bodyPreview && !description.includes(bodyPreview.slice(0, 35))) {
      description = `${description} — ${bodyPreview}`.slice(0, 280);
    }

    const category = humanizeCategory(route, siteName);
    const cleanRoute = route.startsWith("/w/cpp/") ? route.slice(2) : route;

    const mainKey = `${siteId}:${cleanRoute}`;
    if (!seenEntryKeys.has(mainKey)) {
      seenEntryKeys.add(mainKey);
      entries.push({
        id: mainKey,
        site: siteId,
        siteName,
        title,
        category,
        description,
        path: cleanRoute,
        url: cleanRoute,
        headings: headings.slice(0, 25),
        keywords: Array.from(symbolSet).slice(0, 90),
      });
    }

    // 5. Special deep symbol extraction for cppreference `<tr class="t-dsc">` rows
    if (siteId === "cppreference") {
      const dscRegex = /<tr[^>]+class=["'][^"']*\bt-dsc\b[^"']*["'][^>]*>([\s\S]{1,2500}?)<\/tr>/gi;
      let dm: RegExpExecArray | null;
      while ((dm = dscRegex.exec(bodyHtml)) !== null) {
        const rowHtml = dm[1];
        const linkMatch = rowHtml.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
        if (!linkMatch) continue;
        let symHref = linkMatch[1].replace(/^https?:\/\/en\.cppreference\.com\/w/, "").replace(/^\/w\//, "/");
        if (!symHref.startsWith("/cpp/")) continue;

        const tds = [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];
        const symNamesRaw = tds[0] ? stripTags(tds[0][1]) : stripTags(linkMatch[2]);
        const symDescRaw = tds[1] ? stripTags(tds[1][1]) : "";

        const symNames = symNamesRaw
          .replace(/\(since C\+\+\d+\)|\(until C\+\+\d+\)|\(deprecated[^)]*\)|\(C\+\+\d+\)/gi, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (!symNames || symNames.length < 2 || symNames.length > 80) continue;

        const firstSym = symNames.split(/[\s,/()]+/).find((s) => s.length >= 2) || symNames;
        // If standalone route exists in manifest, point directly to it; otherwise point to current page #firstSym
        const targetPath =
          manifest.routes[symHref] || manifest.routes[`/w${symHref}`]
            ? symHref
            : `${cleanRoute}#${encodeURIComponent(firstSym)}`;

        const symEntryKey = `${siteId}:sym:${firstSym.toLowerCase()}:${cleanRoute}`;
        if (seenEntryKeys.has(symEntryKey)) continue;
        seenEntryKeys.add(symEntryKey);

        const symTitle = symNames.startsWith("std::") ? symNames : `std::${symNames} (${title})`;
        const symKeywords = [
          firstSym.toLowerCase(),
          `std::${firstSym.toLowerCase()}`,
          ...symNames.toLowerCase().split(/[^a-z0-9_:+!.-]+/).filter((w) => w.length >= 2),
        ];

        entries.push({
          id: symEntryKey,
          site: siteId,
          siteName,
          title: symTitle,
          category: `${siteName} › ${title}`,
          description: symDescRaw ? `${symNames} — ${symDescRaw}` : `${symNames} in ${title} (${siteName})`,
          path: targetPath,
          url: targetPath,
          headings: [symNames, title],
          keywords: Array.from(new Set(symKeywords)),
        });
      }
    }
  }

  return entries;
}

await enrichCppReferenceDocpack();

const packFiles = fs.readdirSync(APPDATA_DIR).filter((f) => f.endsWith(".docpack"));
let totalEntries = 0;
let coutTotal = 0;

for (const file of packFiles) {
  const siteId = file.replace(/\.docpack$/, "");
  const packPath = path.join(APPDATA_DIR, file);
  const buf = fs.readFileSync(packPath);
  const siteEntries = extractDeepEntriesForSite(siteId, buf);
  if (siteEntries.length === 0) continue;

  totalEntries += siteEntries.length;
  for (const item of siteEntries) {
    if (
      item.title.toLowerCase().includes("cout") ||
      (item.keywords && item.keywords.includes("cout")) ||
      item.description.toLowerCase().includes("cout")
    ) {
      coutTotal++;
    }
  }

  const searchJson = JSON.stringify(siteEntries);
  fs.writeFileSync(path.join(APPDATA_DIR, `${siteId}.search.json`), searchJson);
  if (fs.existsSync(REPO_PACKS_DIR)) {
    fs.writeFileSync(path.join(REPO_PACKS_DIR, `${siteId}.search.json`), searchJson);
  }
}

console.log(`✅ Built deep search index across ${packFiles.length} docpacks: ${totalEntries} rich entries (${coutTotal} entries matching 'cout')!`);
