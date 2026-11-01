import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";
import { buildPack, parsePack, type PackAsset } from "./docpack-v3";
import { composeLibrary, fileReader, LIBRARY_HEADER_BYTES, readLibrary } from "./library";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "docx-library-"));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const html = (text: string) => ({ bytes: Buffer.from(`<html><body><p>${text}</p></body></html>`), mime: "text/html; charset=utf-8" });

function pack(id: string, text: string, previous?: Buffer) {
  const assets = new Map<string, PackAsset>([["/", html(`${id} ${text}`)], ["/a", html(`${id} page a`)]]);
  const built = buildPack({
    id,
    name: id,
    version: "v1",
    origin: "https://example.com",
    entryPath: "/",
    assets,
    previous: previous ? parsePack(previous) : null,
  });
  return built.bytes;
}

function write(name: string, bytes: Uint8Array) {
  const file = path.join(dir, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
  return file;
}

async function slices(file: string) {
  const { directory, dataStart } = await readLibrary(fileReader(file));
  const bytes = fs.readFileSync(file);
  const packs: Record<string, Buffer> = {};
  for (const [id, e] of Object.entries(directory.packs)) {
    packs[id] = bytes.subarray(dataStart + e.offset, dataStart + e.offset + e.sizeBytes);
  }
  return { directory, dataStart, packs, bytes };
}

describe("library", () => {
  test("holds each pack byte for byte at the offset its directory gives", async () => {
    const a = pack("alpha", "first");
    const b = pack("beta", "second");
    write("in/alpha.docpack", a);
    write("in/beta.docpack", b);
    const out = path.join(dir, "lib.bin");

    const result = await composeLibrary({ ids: ["beta", "alpha"], packsDir: path.join(dir, "in"), outPath: out });

    expect(result.packs).toBe(2);
    expect(result.bytes).toBe(fs.statSync(out).size);
    const { packs, directory, dataStart } = await slices(out);
    expect(packs.alpha.equals(a)).toBe(true);
    expect(packs.beta.equals(b)).toBe(true);
    expect(dataStart).toBeGreaterThan(LIBRARY_HEADER_BYTES);
    expect(directory.packs.alpha.commit).toBe(parsePack(a).meta.commit);
  });

  test("replaces only changed packs and keeps the rest of the previous library", async () => {
    const a = pack("alpha", "first");
    const b = pack("beta", "second");
    write("one/alpha.docpack", a);
    write("one/beta.docpack", b);
    const first = path.join(dir, "first.bin");
    await composeLibrary({ ids: ["alpha", "beta"], packsDir: path.join(dir, "one"), outPath: first });

    const b2 = pack("beta", "second, edited", b);
    write("two/beta.docpack", b2);
    const second = path.join(dir, "second.bin");
    const result = await composeLibrary({ ids: ["alpha", "beta"], packsDir: path.join(dir, "two"), previousPath: first, outPath: second });

    expect(result.replaced).toEqual(["beta"]);
    expect(result.kept).toEqual(["alpha"]);
    const { packs, directory } = await slices(second);
    expect(packs.alpha.equals(a)).toBe(true);
    expect(packs.beta.equals(b2)).toBe(true);
    // The directory carries real update sizes, so nothing has to probe a pack to show them.
    const oldCommit = parsePack(b).meta.commit;
    expect(directory.packs.beta.gens[oldCommit]).toBeGreaterThan(0);
    expect(directory.packs.beta.gens[oldCommit]).toBeLessThan(b2.length + 1);
  });

  test("drops sites that left the catalog and reports sites that have no pack", async () => {
    write("one/alpha.docpack", pack("alpha", "first"));
    write("one/retired.docpack", pack("retired", "gone"));
    const first = path.join(dir, "first.bin");
    await composeLibrary({ ids: ["alpha", "retired"], packsDir: path.join(dir, "one"), outPath: first });

    fs.mkdirSync(path.join(dir, "empty"));
    const second = path.join(dir, "second.bin");
    const result = await composeLibrary({ ids: ["alpha", "brand_new"], packsDir: path.join(dir, "empty"), previousPath: first, outPath: second });

    expect(Object.keys((await slices(second)).directory.packs)).toEqual(["alpha"]);
    expect(result.missing).toEqual(["brand_new"]);
  });

  test("refuses a pack whose data does not match its hash", async () => {
    const a = Buffer.from(pack("alpha", "first"));
    a[a.length - 1] ^= 0xff;
    write("in/alpha.docpack", a);
    const out = path.join(dir, "lib.bin");

    await expect(composeLibrary({ ids: ["alpha"], packsDir: path.join(dir, "in"), outPath: out })).rejects.toThrow("hash");
    expect(fs.existsSync(out)).toBe(false);
    expect(fs.existsSync(`${out}.tmp`)).toBe(false);
  });

  test("refuses a pack published under another site's name", async () => {
    write("in/alpha.docpack", pack("beta", "second"));
    const out = path.join(dir, "lib.bin");
    await expect(composeLibrary({ ids: ["alpha"], packsDir: path.join(dir, "in"), outPath: out })).rejects.toThrow("holds beta");
  });

  test("refuses a damaged directory", async () => {
    write("in/alpha.docpack", pack("alpha", "first"));
    const out = path.join(dir, "lib.bin");
    await composeLibrary({ ids: ["alpha"], packsDir: path.join(dir, "in"), outPath: out });
    const bytes = fs.readFileSync(out);
    bytes[LIBRARY_HEADER_BYTES + 2] ^= 0xff;
    fs.writeFileSync(out, bytes);

    await expect(readLibrary(fileReader(out))).rejects.toThrow("hash mismatch");
  });

  test("reads a directory larger than the head probe", async () => {
    const big = pack("alpha", "first");
    const ids = Array.from({ length: 3000 }, (_, i) => `site_${crypto.randomUUID()}_${i}`);
    for (const id of ids.slice(0, 2500)) write(`in/${id}.docpack`, pack(id, id));
    write("in/alpha.docpack", big);
    const out = path.join(dir, "lib.bin");
    await composeLibrary({ ids: ["alpha", ...ids.slice(0, 2500)], packsDir: path.join(dir, "in"), outPath: out });

    const { directory, dataStart } = await readLibrary(fileReader(out));
    expect(Object.keys(directory.packs).length).toBe(2501);
    expect(dataStart).toBeGreaterThan(64 * 1024);
  }, 60_000);
});
