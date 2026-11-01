import { describe, expect, test } from "bun:test";
import { buildPack, parsePack, SEARCH_ROUTE, updateBytesFrom, type PackAsset } from "./docpack-v3";
import { chunkBoundaries, splitIntoChunks, CHUNK_MAX_BYTES } from "./chunker";
import { looksFingerprinted, normalizeHtml, stableAssetKey } from "./normalize-html";

const HTML = "text/html; charset=utf-8";

function sampleText(seed: number, length: number): string {
  const words = ["const", "render", "offline", "package", "module", "server", "client", "route", "cache", "update"];
  let out = "";
  let x = seed;
  while (out.length < length) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    out += `${words[x % words.length]}${x % 7} `;
  }
  return out;
}

function page(title: string, body: string, nav: string): PackAsset {
  const html = `<!doctype html><html><head><title>${title}</title></head><body><nav>${nav}</nav><main><h1>${title}</h1><p>${body}</p></main><footer>footer</footer></body></html>`;
  return { bytes: Buffer.from(html, "utf8"), mime: HTML };
}

function site(pages: number, navSeed: number, editPage = -1, editSeed = 0) {
  const nav = sampleText(navSeed, 6000);
  const assets = new Map<string, PackAsset>();
  for (let i = 0; i < pages; i++) {
    const body = sampleText(i === editPage ? 90_000 + editSeed : 1000 + i, 12_000);
    assets.set(`/docs/p${i}`, page(`Page ${i}`, body, nav));
  }
  assets.set("/app.css", { bytes: Buffer.from(sampleText(7, 4000)), mime: "text/css; charset=utf-8" });
  assets.set("/logo.png", { bytes: Buffer.from(Array.from({ length: 2048 }, (_, i) => (i * 31) % 251)), mime: "image/png" });
  return assets;
}

const base = { id: "demo", name: "Demo", version: "v1", origin: "https://demo.dev", entryPath: "/docs" };

describe("chunker", () => {
  test("boundaries cover the input and respect the maximum", () => {
    const buf = Buffer.from(sampleText(1, 200_000));
    const cuts = chunkBoundaries(buf);
    expect(cuts[cuts.length - 1]).toBe(buf.length);
    let prev = 0;
    for (const c of cuts) {
      expect(c).toBeGreaterThan(prev);
      expect(c - prev).toBeLessThanOrEqual(CHUNK_MAX_BYTES);
      prev = c;
    }
  });

  test("an edit only disturbs nearby chunks", () => {
    // Repetitive on purpose: this is the input that breaks a low-bit gear mask.
    let freshBytes = 0;
    const runs = 40;
    for (let seed = 1; seed <= runs; seed++) {
      const text = sampleText(seed, 120_000);
      const at = 20_000 + ((seed * 7919) % 80_000);
      const edited = `${text.slice(0, at)} inserted words here ${text.slice(at)}`;
      const known = new Set(splitIntoChunks(Buffer.from(text)).map((c) => c.toString("latin1")));
      for (const chunk of splitIntoChunks(Buffer.from(edited))) {
        if (!known.has(chunk.toString("latin1"))) freshBytes += chunk.length;
      }
    }
    expect(freshBytes / runs).toBeLessThan(120_000 * 0.1);
  });

  test("handles empty and tiny input", () => {
    expect(chunkBoundaries(Buffer.alloc(0))).toEqual([]);
    expect(splitIntoChunks(Buffer.from("x"))).toHaveLength(1);
  });
});

describe("normalizeHtml", () => {
  test("drops hydration data and analytics on static sites", () => {
    const html = `<head><script id="__NEXT_DATA__" type="application/json">{"buildId":"abc"}</script><script>gtag('x')</script><script>theme()</script><link rel="preload" href="/a.woff2"><meta property="og:title" content="t"></head>`;
    const out = normalizeHtml(html);
    expect(out).not.toContain("__NEXT_DATA__");
    expect(out).not.toContain("gtag");
    expect(out).not.toContain("preload");
    expect(out).not.toContain("og:title");
    expect(out).toContain("theme()");
  });

  test("keeps script data on SPA sites but still removes analytics", () => {
    const html = `<script id="__NEXT_DATA__" type="application/json">{}</script><script>gtag('x')</script>`;
    const out = normalizeHtml(html, { keepScripts: true });
    expect(out).toContain("__NEXT_DATA__");
    expect(out).not.toContain("gtag");
  });

  test("numbers random label ids without breaking their references", () => {
    const render = (a: string, b: string) =>
      `<span id="label-${a}">x</span><a aria-labelledby="label-${a}">y</a><i id="label-${b}"></i><p>label-language stays</p>`;
    const first = normalizeHtml(render("4p6wfl5dodh", "hl7jjsjfrre"));
    expect(first).toBe(normalizeHtml(render("lpkvbizru38", "u8ai0rth57h")));
    expect(first).toContain('id="label-0"');
    expect(first).toContain('aria-labelledby="label-0"');
    expect(first).toContain("label-language stays");
  });

  test("keeps code block indentation and ordinary scripts", () => {
    const code = `<pre><code><span>if</span>\n    <span>x</span></code></pre>`;
    expect(normalizeHtml(`<div>   \n  <p>a</p>   \n  ${code}</div>`)).toContain(code);
    const demo = `<script>const amplitude = 2; wave(amplitude)</script>`;
    expect(normalizeHtml(demo, { keepScripts: true })).toContain("wave(amplitude)");
  });

  test("stable asset keys ignore fingerprints but keep real identity", () => {
    expect(stableAssetKey("https://a.dev/css/style.236b38b41a882db7.css")).toBe(
      stableAssetKey("https://a.dev/css/style.d2cd954ca3ed0da8.css"),
    );
    expect(stableAssetKey("https://a.dev/x.css?v=1")).toBe(stableAssetKey("https://a.dev/x.css?v=2"));
    expect(stableAssetKey("https://a.dev/a.css")).not.toBe(stableAssetKey("https://a.dev/b.css"));
    expect(looksFingerprinted("/css/style.236b38b41a882db7.css")).toBe(true);
    expect(looksFingerprinted("/css/style.css")).toBe(false);
    expect(looksFingerprinted("/assets/main.js")).toBe(false);
  });
});

describe("docpack v3", () => {
  test("round-trips every route byte for byte", () => {
    const assets = site(6, 11);
    assets.set(SEARCH_ROUTE, { bytes: Buffer.from(sampleText(3, 30_000)), mime: "application/json; charset=utf-8" });
    const { bytes } = buildPack({ ...base, assets });
    const pack = parsePack(bytes);
    for (const [route, asset] of assets) {
      expect(pack.readRoute(route)!.equals(asset.bytes)).toBe(true);
      expect(pack.mimeOf(route)).toBe(asset.mime);
    }
    expect(pack.meta.routeCount).toBe(assets.size);
    expect(pack.readRoute("/missing")).toBeUndefined();
  });

  test("shared page blocks are stored once", () => {
    const small = buildPack({ ...base, assets: site(3, 12) });
    const large = buildPack({ ...base, assets: site(30, 12) });
    const perPage = (large.bytes.byteLength - small.bytes.byteLength) / 27;
    // Each page has 12 KB of unique text; the 6 KB shared nav must not be paid again.
    expect(perPage).toBeLessThan(12_000);
  });

  test("an identical rebuild is reported as unchanged", () => {
    const first = buildPack({ ...base, assets: site(4, 13) });
    const second = buildPack({ ...base, assets: site(4, 13), previous: parsePack(first.bytes) });
    expect(second.unchanged).toBe(true);
    expect(second.meta.commit).toBe(first.meta.commit);
    expect(second.stats.newChunks).toBe(0);
  });

  test("one edited page only adds a small tail", () => {
    const first = buildPack({ ...base, assets: site(40, 14) });
    const second = buildPack({ ...base, assets: site(40, 14, 5, 1), previous: parsePack(first.bytes) });
    const pack = parsePack(second.bytes);
    expect(second.unchanged).toBe(false);
    expect(second.stats.newChunks).toBeGreaterThan(0);
    expect(second.stats.newBytes).toBeLessThan(second.meta.totalBytes * 0.1);

    // Everything the old build lacks sits contiguously at the end of the data section.
    const oldIds = new Set(parsePack(first.bytes).index.c);
    const firstNew = pack.index.c.findIndex((id) => !oldIds.has(id));
    expect(pack.index.c.slice(firstNew).every((id) => !oldIds.has(id))).toBe(true);
  });

  test("a client several builds behind finds its update in one tail", () => {
    let prev = buildPack({ ...base, assets: site(30, 15) });
    const firstCommit = prev.meta.commit;
    const firstIds = new Set(parsePack(prev.bytes).index.c);
    // Each build also reverts the previous edit, so chunks leave and come back.
    for (let i = 1; i <= 4; i++) {
      prev = buildPack({ ...base, assets: site(30, 15, i, i), previous: parsePack(prev.bytes) });
    }
    const pack = parsePack(prev.bytes);
    const missing = pack.index.c.reduce((sum, id, i) => (firstIds.has(id) ? sum : sum + pack.index.l[i]), 0);
    const estimate = updateBytesFrom(pack.meta, pack.dataStart, firstCommit)!;
    expect(pack.meta.generation).toBe(5);
    expect(estimate).toBeGreaterThanOrEqual(pack.dataStart + missing);
    expect(estimate).toBeLessThan(pack.bytes.byteLength * 0.25);
  });

  test("the update estimate is exact when no content came back", () => {
    let prev = buildPack({ ...base, assets: site(30, 15) });
    const firstCommit = prev.meta.commit;
    const firstIds = new Set(parsePack(prev.bytes).index.c);
    const assets = site(30, 15);
    for (let i = 1; i <= 3; i++) {
      assets.set(`/docs/p${i}`, page(`Page ${i}`, sampleText(70_000 + i, 12_000), sampleText(15, 6000)));
      prev = buildPack({ ...base, assets, previous: parsePack(prev.bytes) });
    }
    const pack = parsePack(prev.bytes);
    const missing = pack.index.c.reduce((sum, id, i) => (firstIds.has(id) ? sum : sum + pack.index.l[i]), 0);
    expect(updateBytesFrom(pack.meta, pack.dataStart, firstCommit)).toBe(pack.dataStart + missing);
    expect(updateBytesFrom(pack.meta, pack.dataStart, "unknown")).toBeUndefined();
  });

  test("dropped routes shrink the pack and survivors stay readable", () => {
    const first = buildPack({ ...base, assets: site(20, 16) });
    const assets = site(20, 16);
    assets.delete("/docs/p3");
    const second = buildPack({ ...base, assets, previous: parsePack(first.bytes) });
    const pack = parsePack(second.bytes);
    expect(second.meta.totalBytes).toBeLessThan(first.meta.totalBytes);
    expect(pack.readRoute("/docs/p3")).toBeUndefined();
    expect(pack.readRoute("/docs/p4")!.equals(assets.get("/docs/p4")!.bytes)).toBe(true);
  });

  test("carried routes survive a failed refetch", () => {
    const original = site(5, 17);
    const first = buildPack({ ...base, assets: original });
    const assets = site(5, 17);
    assets.delete("/docs/p2");
    const second = buildPack({
      ...base,
      assets,
      carriedRoutes: ["/docs/p2"],
      previous: parsePack(first.bytes),
    });
    expect(second.unchanged).toBe(true);
    expect(parsePack(second.bytes).readRoute("/docs/p2")!.equals(original.get("/docs/p2")!.bytes)).toBe(true);
  });

  test("rejects truncated and foreign files", () => {
    const { bytes } = buildPack({ ...base, assets: site(2, 18) });
    expect(() => parsePack(bytes.subarray(0, bytes.length - 10))).toThrow();
    expect(() => parsePack(Buffer.from("not a pack at all, definitely not a docpack header"))).toThrow();
  });
});
