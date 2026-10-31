/**
 * Docpack v3 writer and reader.
 *
 * Layout:
 *
 *   offset  size  field
 *        0     4  magic "DOCP"
 *        4     2  version (3), little endian like every integer here
 *        6     2  flags (bit 1: brotli chunks)
 *        8     4  meta length
 *       12     4  index length
 *       16     8  data length
 *       24     8  reserved
 *       32     -  meta JSON (uncompressed, small, read for every pack at startup)
 *        -     -  index (brotli JSON: chunk table and route recipes, loaded on demand)
 *        -     -  data (stored chunks, back to back)
 *
 * The data section is ordered by generation: chunks that survive from the
 * previous build keep their relative order and new chunks go on the end. A
 * client that is any number of builds behind therefore finds nearly everything
 * it lacks in one contiguous tail of the same `.docpack`, which is why no
 * per-version patch files have to be published.
 *
 * Chunks are identified by the hash of their raw bytes, and the builder reuses
 * the stored bytes of known chunks. Compressor upgrades therefore never make
 * unchanged content look new.
 */
import crypto from "crypto";
import zlib from "zlib";
import { splitIntoChunks } from "./chunker";

export const DOCPACK_V3_VERSION = 3;
export const HEADER_BYTES = 32;
/** Older builds a client can get an update size for without fetching the index. */
export const MAX_TRACKED_GENERATIONS = 16;
/** In-pack route holding the page search index. */
export const SEARCH_ROUTE = "/__docx/search.json";

export interface PackGeneration {
  commit: string;
  /** Data offset where the chunks unknown to `commit` begin. */
  tail: number;
}

export interface PackMeta {
  id: string;
  name: string;
  version: string;
  origin: string;
  entryPath: string;
  /** Content id: equal commits mean byte-identical routes. */
  commit: string;
  updatedAt: string;
  totalBytes: number;
  chunkCount: number;
  routeCount: number;
  compression: "brotli";
  generation: number;
  dataHash: string;
  indexHash: string;
  gens: PackGeneration[];
  /** The crawl stopped at its page or time budget, so the site is partial. */
  truncated?: boolean;
}

export interface PackIndex {
  /** Chunk ids in data order. */
  c: string[];
  /** Stored length per chunk. */
  l: number[];
  /** Raw length per chunk. */
  r: number[];
  /** Encoding per chunk: "1" brotli, "0" identity. */
  e: string;
  /** Distinct mime types. */
  m: string[];
  /** route -> [mime index, ...chunk indices] */
  p: Record<string, number[]>;
}

export interface ParsedPack {
  meta: PackMeta;
  index: PackIndex;
  dataStart: number;
  /** Data offset per chunk, aligned with `index.c`. */
  offsets: number[];
  chunkIndex: Map<string, number>;
  bytes: Buffer;
  storedChunk(i: number): Buffer;
  /** Raw bytes of a route; undefined when the route does not exist. */
  readRoute(route: string): Buffer | undefined;
  mimeOf(route: string): string | undefined;
}

export interface PackAsset {
  bytes: Buffer;
  mime: string;
}

export interface BuildInput {
  id: string;
  name: string;
  version: string;
  origin: string;
  entryPath: string;
  assets: Map<string, PackAsset>;
  /** Routes copied from the previous pack as they are, e.g. pages a crawl failed to refetch. */
  carriedRoutes?: Iterable<string>;
  previous?: ParsedPack | null;
  truncated?: boolean;
  now?: Date;
}

export interface BuildOutput {
  unchanged: boolean;
  meta: PackMeta;
  bytes: Buffer;
  stats: {
    totalChunks: number;
    newChunks: number;
    newBytes: number;
    routes: number;
    /** Bytes a client on the previous build must fetch. */
    updateBytes: number;
  };
}

const sha256 = (b: Uint8Array) => crypto.createHash("sha256").update(b);
const chunkId = (raw: Uint8Array) => sha256(raw).digest("hex").slice(0, 16);

const brotli = (raw: Buffer, lgwin: number) =>
  zlib.brotliCompressSync(raw, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_LGWIN]: lgwin,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.byteLength,
    },
  });

const isHtml = (mime: string) => mime.startsWith("text/html");
const isCompressible = (mime: string) =>
  mime.startsWith("text/") || mime.includes("javascript") || mime.includes("json") || mime.includes("svg+xml");

function storedForm(raw: Buffer, mime: string): { stored: Buffer; encoding: "0" | "1" } {
  if (isCompressible(mime)) {
    const compressed = brotli(raw, raw.byteLength > 1 << 20 ? 24 : 22);
    if (compressed.byteLength < raw.byteLength) return { stored: compressed, encoding: "1" };
  }
  return { stored: raw, encoding: "0" };
}

export function parsePack(bytes: Buffer): ParsedPack {
  if (bytes.byteLength < HEADER_BYTES || bytes.subarray(0, 4).toString("latin1") !== "DOCP") {
    throw new Error("not a docpack");
  }
  const version = bytes.readUInt16LE(4);
  if (version !== DOCPACK_V3_VERSION) throw new Error(`unsupported docpack version ${version}`);
  const metaLen = bytes.readUInt32LE(8);
  const indexLen = bytes.readUInt32LE(12);
  const metaEnd = HEADER_BYTES + metaLen;
  const indexEnd = metaEnd + indexLen;
  const dataLen = Number(bytes.readBigUInt64LE(16));
  if (bytes.byteLength < indexEnd + dataLen) throw new Error("truncated docpack");

  const meta: PackMeta = JSON.parse(bytes.subarray(HEADER_BYTES, metaEnd).toString("utf8"));
  const index: PackIndex = JSON.parse(zlib.brotliDecompressSync(bytes.subarray(metaEnd, indexEnd)).toString("utf8"));

  const offsets = new Array<number>(index.c.length);
  let at = 0;
  for (let i = 0; i < index.c.length; i++) {
    offsets[i] = at;
    at += index.l[i];
  }
  const chunkIndex = new Map(index.c.map((id, i) => [id, i]));
  const storedChunk = (i: number) =>
    bytes.subarray(indexEnd + offsets[i], indexEnd + offsets[i] + index.l[i]);

  return {
    meta,
    index,
    dataStart: indexEnd,
    offsets,
    chunkIndex,
    bytes,
    storedChunk,
    mimeOf: (route) => {
      const recipe = index.p[route];
      return recipe ? index.m[recipe[0]] : undefined;
    },
    readRoute: (route) => {
      const recipe = index.p[route];
      if (!recipe) return undefined;
      return Buffer.concat(
        recipe.slice(1).map((i) => {
          const stored = storedChunk(i);
          return index.e[i] === "1" ? zlib.brotliDecompressSync(stored) : stored;
        }),
      );
    },
  };
}

export function buildPack(input: BuildInput): BuildOutput {
  const prev = input.previous ?? null;

  // 1. Turn every route into a recipe of raw chunk ids.
  const recipes = new Map<string, { mime: string; ids: string[] }>();
  const incoming = new Map<string, { raw: Buffer; mime: string }>();

  const routeOrder = [...input.assets.keys()].sort();
  for (const route of routeOrder) {
    const asset = input.assets.get(route)!;
    const pieces =
      isHtml(asset.mime) || route === SEARCH_ROUTE
        ? splitIntoChunks(asset.bytes, isHtml(asset.mime))
        : asset.bytes.byteLength
          ? [asset.bytes]
          : [];
    const ids = pieces.map((piece) => {
      const id = chunkId(piece);
      if (!incoming.has(id)) incoming.set(id, { raw: piece, mime: asset.mime });
      return id;
    });
    recipes.set(route, { mime: asset.mime, ids });
  }

  if (prev) {
    for (const route of input.carriedRoutes ?? []) {
      if (recipes.has(route)) continue;
      const recipe = prev.index.p[route];
      if (!recipe) continue;
      recipes.set(route, {
        mime: prev.index.m[recipe[0]],
        ids: recipe.slice(1).map((i) => prev.index.c[i]),
      });
    }
  }

  // 2. The commit identifies content, so an identical crawl publishes nothing.
  const fingerprint = sha256(
    Buffer.from(
      [...recipes.entries()]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([route, r]) => `${route}\0${r.mime}\0${r.ids.join(",")}`)
        .join("\n"),
      "utf8",
    ),
  )
    .digest("hex")
    .slice(0, 16);

  const used = new Set<string>();
  for (const r of recipes.values()) for (const id of r.ids) used.add(id);

  // 3. Lay chunks out by generation: survivors in their old order, then new ones.
  type Placed = { id: string; stored: Buffer; rawLength: number; encoding: string; prevOffset: number };
  const placed: Placed[] = [];
  if (prev) {
    prev.index.c.forEach((id, i) => {
      if (!used.has(id)) return;
      placed.push({
        id,
        stored: prev.storedChunk(i),
        rawLength: prev.index.r[i],
        encoding: prev.index.e[i],
        prevOffset: prev.offsets[i],
      });
    });
  }
  const carriedOver = new Set(placed.map((p) => p.id));

  let newChunks = 0;
  let newBytes = 0;
  // `used` iterates in route order, which keeps the bytes of a build deterministic.
  for (const id of used) {
    if (carriedOver.has(id)) continue;
    const source = incoming.get(id);
    if (!source) throw new Error(`no source bytes for chunk ${id}`);
    const { stored, encoding } = storedForm(source.raw, source.mime);
    placed.push({ id, stored, rawLength: source.raw.byteLength, encoding, prevOffset: -1 });
    newChunks++;
    newBytes += stored.byteLength;
  }

  // 4. Write the sections.
  const offsets = new Map<string, number>();
  let dataLen = 0;
  const data = sha256(new Uint8Array(0));
  for (const chunk of placed) {
    offsets.set(chunk.id, offsets.size);
    data.update(chunk.stored);
    dataLen += chunk.stored.byteLength;
  }

  const mimes = [...new Set([...recipes.values()].map((r) => r.mime))].sort();
  const mimeIndex = new Map(mimes.map((m, i) => [m, i]));
  const routes: Record<string, number[]> = {};
  for (const route of [...recipes.keys()].sort()) {
    const r = recipes.get(route)!;
    routes[route] = [mimeIndex.get(r.mime)!, ...r.ids.map((id) => offsets.get(id)!)];
  }
  const index: PackIndex = {
    c: placed.map((p) => p.id),
    l: placed.map((p) => p.stored.byteLength),
    r: placed.map((p) => p.rawLength),
    e: placed.map((p) => p.encoding).join(""),
    m: mimes,
    p: routes,
  };
  const indexBytes = brotli(Buffer.from(JSON.stringify(index), "utf8"), 22);

  // 5. Remap generation tails onto the new layout.
  const remapTail = (oldTail: number) =>
    placed.reduce((sum, c) => (c.prevOffset >= 0 && c.prevOffset < oldTail ? sum + c.stored.byteLength : sum), 0);
  const gens: PackGeneration[] = prev
    ? [...prev.meta.gens, { commit: prev.meta.commit, tail: prev.meta.totalBytes }]
        .filter((g) => g.commit !== fingerprint)
        .slice(-MAX_TRACKED_GENERATIONS)
        .map((g) => ({ commit: g.commit, tail: remapTail(g.tail) }))
    : [];

  const meta: PackMeta = {
    id: input.id,
    name: input.name,
    version: input.version,
    origin: input.origin,
    entryPath: input.entryPath,
    commit: fingerprint,
    updatedAt: (input.now ?? new Date()).toISOString(),
    totalBytes: dataLen,
    chunkCount: placed.length,
    routeCount: recipes.size,
    compression: "brotli",
    generation: (prev?.meta.generation ?? 0) + 1,
    dataHash: data.digest("hex").slice(0, 32),
    indexHash: sha256(indexBytes).digest("hex").slice(0, 16),
    gens,
    ...(input.truncated ? { truncated: true } : {}),
  };
  const metaBytes = Buffer.from(JSON.stringify(meta), "utf8");

  const header = Buffer.alloc(HEADER_BYTES);
  header.write("DOCP", 0, "latin1");
  header.writeUInt16LE(DOCPACK_V3_VERSION, 4);
  header.writeUInt16LE(2, 6);
  header.writeUInt32LE(metaBytes.byteLength, 8);
  header.writeUInt32LE(indexBytes.byteLength, 12);
  header.writeBigUInt64LE(BigInt(dataLen), 16);

  const headBytes = HEADER_BYTES + metaBytes.byteLength + indexBytes.byteLength;
  const bytes = Buffer.concat([header, metaBytes, indexBytes, ...placed.map((p) => p.stored)]);
  const lastGen = gens[gens.length - 1];

  return {
    unchanged: prev?.meta.commit === fingerprint,
    meta,
    bytes,
    stats: {
      totalChunks: placed.length,
      newChunks,
      newBytes,
      routes: recipes.size,
      updateBytes: lastGen ? headBytes + dataLen - lastGen.tail : bytes.byteLength,
    },
  };
}

/**
 * Download size for a client on `commit`, or undefined if it is too old to track.
 * Exact unless a chunk left the pack and later returned: it then sits on the tail
 * although the client still has it, so this is an upper bound the update never exceeds.
 */
export function updateBytesFrom(meta: PackMeta, headBytes: number, commit: string): number | undefined {
  const gen = meta.gens.find((g) => g.commit === commit);
  return gen ? headBytes + meta.totalBytes - gen.tail : undefined;
}
