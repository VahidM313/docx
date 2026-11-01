/**
 * Works with the published library.
 *
 *   bun scripts/library.ts ids
 *       Prints the ids of the published packs as a JSON array.
 *   bun scripts/library.ts extract <id,id,...> <dir>
 *       Writes those packs to <dir> with range requests, without fetching the rest.
 *       A pack the library does not hold yet is skipped.
 *   bun scripts/library.ts compose <packs-dir> <out> [previous-library]
 *       Builds a new library from changed packs plus the previous library.
 */
import fs from "fs";
import path from "path";
import { SITE_CATALOG } from "./ci-build-site";
import { composeLibrary, LIBRARY_URL, readLibrary, urlReader, type Library } from "./lib/library";

async function publishedLibrary(): Promise<Library | null> {
  try {
    return await readLibrary(urlReader(LIBRARY_URL));
  } catch (e: any) {
    if (String(e?.message).startsWith("HTTP 404")) return null;
    throw e;
  }
}

const [command, ...args] = process.argv.slice(2);

if (command === "ids") {
  const library = await publishedLibrary();
  console.log(JSON.stringify(Object.keys(library?.directory.packs ?? {})));
} else if (command === "extract") {
  const [ids, dir] = args;
  if (!ids || !dir) throw new Error("usage: library.ts extract <id,id,...> <dir>");
  fs.mkdirSync(dir, { recursive: true });
  const library = await publishedLibrary();
  const read = urlReader(LIBRARY_URL);
  for (const id of ids.split(",")) {
    const entry = library?.directory.packs[id];
    if (!entry) {
      console.log(`${id}: not in the library yet`);
      continue;
    }
    const start = library!.dataStart + entry.offset;
    fs.writeFileSync(path.join(dir, `${id}.docpack`), await read(start, start + entry.sizeBytes));
    console.log(`${id}: ${entry.sizeBytes} bytes, commit ${entry.commit}`);
  }
} else if (command === "compose") {
  const [packsDir, outPath, previousPath] = args;
  if (!packsDir || !outPath) throw new Error("usage: library.ts compose <packs-dir> <out> [previous-library]");
  const result = await composeLibrary({
    ids: SITE_CATALOG.map((s) => s.id),
    packsDir,
    outPath,
    previousPath: previousPath && fs.existsSync(previousPath) ? previousPath : null,
  });
  console.log(`Library: ${result.packs} packs, ${(result.bytes / 1024 ** 2).toFixed(1)} MB`);
  console.log(`  ${result.replaced.length} replaced: ${result.replaced.join(", ")}`);
  console.log(`  ${result.kept.length} kept from the previous library`);
  if (result.missing.length) console.warn(`  ${result.missing.length} missing: ${result.missing.join(", ")}`);
} else {
  throw new Error("usage: library.ts ids | extract | compose");
}
