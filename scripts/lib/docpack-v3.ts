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
 *
 * Text chunks are compressed with zstd against a dictionary trained on the site, which
 * lets each small chunk share the markup its pages repeat. The dictionary is itself a
 * chunk, named by `meta.dict` and used by no route, so it travels with the pack and
 * updates fetch it like any other. It never changes once a pack has one, because
 * every stored chunk depends on it.
 *
 * Small text chunks are not stored one by one: compressed alone, a 4 KB piece cannot
 * use the pages around it, which left HTML two to three times larger than the same
 * text compressed together. They live in frames instead, about 1 MB of chunks
 * compressed as one entry ("4"). Each chunk keeps its own entry ("3") with no stored
 * bytes of its own; the index says which frame holds it and where (`f`, `o`). A
 * chunk is still the unit of identity, so a page shared by every build is stored
 * once, and a build's new chunks go into new frames on the tail, where updates
 * already look. A frame whose chunks have mostly left the pack is repacked.
 */
import crypto from "crypto";
import zlib from "zlib";
import { splitIntoChunks } from "./chunker";
import { trainDictionary } from "./zstd-dict";

export const DOCPACK_V3_VERSION = 3;
export const HEADER_BYTES = 32;
/** Older builds a client can get an update size for without fetching the index. */
export const MAX_TRACKED_GENERATIONS = 16;
/** In-pack route holding the page search index. */
export const SEARCH_ROUTE = "/__docx/search.json";
/** Chunk encodings in the index. */
const IDENTITY = "0";
const BROTLI = "1";
const ZSTD_DICT = "2";
/** A chunk stored inside a frame: no bytes of its own. */
const FRAMED = "3";
/** A frame: several chunks compressed together with the pack's dictionary. */
const FRAME = "4";
/** Raw bytes per frame. Measured on cppreference, redis and django: 1 MB frames
 * cut HTML to 47-71% of chunks compressed alone; 4 MB saved a little more. */
export const FRAME_RAW_BYTES = 1 << 20;
/** zstd level for frames: a frame is compressed once and read many times. */
const FRAME_LEVEL = 19;
/** A frame is repacked when less than this share of its bytes is still used. */
const MIN_LIVE_FRAME_SHARE = 0.5;
/** Part of every commit; changing the stored layout changes it. */
const LAYOUT_TAG = "frames\n";
/** Past this a file is a bundle, not a page, and brotli's larger window wins. */
const MAX_DICT_CHUNK_BYTES = 64 * 1024;
/** Below this a dictionary costs more than it saves. */
const MIN_DICT_TEXT_BYTES = 256 * 1024;
/** Level 19 takes ten times as long here for about 7% less. */
const ZSTD_LEVEL = 12;

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
  /** Id of the chunk holding the zstd dictionary, when the pack has one. */
  dict?: string;
  /** Raw bytes per frame, when small text chunks are stored in frames. */
  frame?: number;
}

export interface PackIndex {
  /** Chunk ids in data order. */
  c: string[];
  /** Stored length per chunk. */
  l: number[];
  /** Raw length per chunk. */
  r: number[];
  /** Encoding per chunk: "4" frame, "3" inside a frame, "2" zstd with the pack's dictionary, "1" brotli, "0" identity. */
  e: string;
  /** Distinct mime types. */
  m: string[];
  /** route -> [mime index, ...chunk indices] */
  p: Record<string, number[]>;
  /** Per chunk: 1 + index of the frame holding it, or 0. Present when the pack has frames. */
  f?: number[];
  /** Per chunk: where its raw bytes start inside its frame's raw bytes. */
  o?: number[];
}

export interface ParsedPack {
  meta: PackMeta;
  index: PackIndex;
  dataStart: number;
  /** Data offset per chunk, aligned with `index.c`. */
  offsets: number[];
  chunkIndex: Map<string, number>;
  bytes: Buffer;
  dictionary: Buffer | null;
  storedChunk(i: number): Buffer;
  /** Raw bytes of a chunk. */
  rawChunk(i: number): Buffer;
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
  /** Same content in the same stored form: there is nothing to publish. */
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

const EMPTY = Buffer.alloc(0);
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
/** The dictionary compresses like text, but not against itself. */
const DICTIONARY_MIME = "text/x-zstd-dictionary";
/** A chunk that was brotli once is compressible, whatever route it came from. */
const BROTLI_CHUNK_MIME = "text/plain";
const isCompressible = (mime: string) =>
  mime.startsWith("text/") || mime.includes("javascript") || mime.includes("json") || mime.includes("svg+xml");

function storedForm(raw: Buffer, mime: string, dictionary: Buffer | null): { stored: Buffer; encoding: string } {
  if (isCompressible(mime)) {
    const compressed =
      dictionary && raw.byteLength <= MAX_DICT_CHUNK_BYTES
        ? zlib.zstdCompressSync(raw, { dictionary, params: { [zlib.constants.ZSTD_c_compressionLevel]: ZSTD_LEVEL } })
        : brotli(raw, raw.byteLength > 1 << 20 ? 24 : 22);
    if (compressed.byteLength < raw.byteLength) {
      return { stored: compressed, encoding: dictionary && raw.byteLength <= MAX_DICT_CHUNK_BYTES ? ZSTD_DICT : BROTLI };
    }
  }
  return { stored: raw, encoding: IDENTITY };
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
  let dictionary: Buffer | null = null;
  // Reading a page touches a few frames; a build walking pages in order reuses them.
  const frames = new Map<number, Buffer>();
  const frameRaw = (i: number) => {
    let raw = frames.get(i);
    if (raw) {
      frames.delete(i);
    } else {
      raw = zlib.zstdDecompressSync(storedChunk(i), { dictionary: dictionary! });
      if (frames.size >= 32) frames.delete(frames.keys().next().value!);
    }
    frames.set(i, raw);
    return raw;
  };
  const rawChunk = (i: number): Buffer => {
    const stored = storedChunk(i);
    if (index.e[i] === BROTLI) return zlib.brotliDecompressSync(stored);
    if (index.e[i] === ZSTD_DICT) return zlib.zstdDecompressSync(stored, { dictionary: dictionary! });
    if (index.e[i] === FRAME) return frameRaw(i);
    if (index.e[i] === FRAMED) {
      const frame = (index.f?.[i] ?? 0) - 1;
      if (frame < 0 || index.e[frame] !== FRAME) throw new Error(`chunk ${index.c[i]} has no frame`);
      const at = index.o![i];
      return frameRaw(frame).subarray(at, at + index.r[i]);
    }
    return stored;
  };
  if (meta.dict) {
    const at = chunkIndex.get(meta.dict);
    if (at === undefined) throw new Error("the pack's dictionary chunk is missing");
    dictionary = rawChunk(at);
  }

  return {
    meta,
    index,
    dataStart: indexEnd,
    offsets,
    chunkIndex,
    bytes,
    dictionary,
    storedChunk,
    rawChunk,
    mimeOf: (route) => {
      const recipe = index.p[route];
      return recipe ? index.m[recipe[0]] : undefined;
    },
    readRoute: (route) => {
      const recipe = index.p[route];
      if (!recipe) return undefined;
      return Buffer.concat(recipe.slice(1).map(rawChunk));
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

  // 2. The commit identifies content, so an identical crawl publishes nothing. It also
  // names the layout: the move into frames keeps every route, and clients must still
  // see it as an update, or they would keep the old layout and misjudge later ones.
  const fingerprint = sha256(
    Buffer.from(
      LAYOUT_TAG +
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

  // 3. A pack keeps its dictionary for life. One without is trained now, and its old
  // chunks are stored afresh, which is the only build that moves every chunk.
  let dictionary = prev?.dictionary ?? null;
  let reencoded = false;
  if (!dictionary) {
    const text: Buffer[] = [];
    prev?.index.c.forEach((id, i) => {
      if (used.has(id) && prev.index.e[i] === BROTLI && prev.index.r[i] <= MAX_DICT_CHUNK_BYTES) text.push(prev.rawChunk(i));
    });
    for (const id of used) {
      const source = incoming.get(id);
      if (source && isCompressible(source.mime) && source.raw.byteLength <= MAX_DICT_CHUNK_BYTES) text.push(source.raw);
    }
    if (text.reduce((sum, chunk) => sum + chunk.byteLength, 0) >= MIN_DICT_TEXT_BYTES) {
      dictionary = trainDictionary(text);
      reencoded = !!prev;
    }
  }
  const dictionaryId = dictionary ? chunkId(dictionary) : undefined;
  if (dictionary) {
    used.add(dictionaryId!);
    if (!prev?.chunkIndex.has(dictionaryId!)) incoming.set(dictionaryId!, { raw: dictionary, mime: DICTIONARY_MIME });
  }
  const compress = (raw: Buffer, mime: string) => storedForm(raw, mime, mime === DICTIONARY_MIME ? null : dictionary);

  // 4. Lay chunks out by generation: survivors in their old order, then new ones.
  // With a dictionary, small text goes into frames rather than being stored alone.
  const framing = !!dictionary;
  const frameable = (rawLength: number, mime: string) =>
    framing && mime !== DICTIONARY_MIME && isCompressible(mime) && rawLength <= MAX_DICT_CHUNK_BYTES;
  type Placed = {
    id: string;
    stored: Buffer;
    rawLength: number;
    encoding: string;
    prevOffset: number;
    /** For a chunk inside a frame: the frame's id and where the chunk starts in it. */
    frame?: string;
    at?: number;
  };
  const placed: Placed[] = [];
  // Previous chunks that move into new frames, with their raw bytes.
  const reframed = new Map<string, Buffer>();
  if (prev) {
    // A previous frame stays while at least half of its bytes are still used;
    // otherwise its live chunks are framed again with this build's new ones.
    const keptFrames = new Set<number>();
    if (prev.index.f) {
      const live = new Map<number, number>();
      prev.index.c.forEach((id, i) => {
        const frame = prev.index.f![i] - 1;
        if (frame >= 0 && used.has(id)) live.set(frame, (live.get(frame) ?? 0) + prev.index.r[i]);
      });
      for (const [frame, bytes] of live) if (bytes >= MIN_LIVE_FRAME_SHARE * prev.index.r[frame]) keptFrames.add(frame);
    }
    prev.index.c.forEach((id, i) => {
      const encoding = prev.index.e[i];
      const rawLength = prev.index.r[i];
      if (encoding === FRAME) {
        if (keptFrames.has(i)) placed.push({ id, stored: prev.storedChunk(i), rawLength, encoding, prevOffset: prev.offsets[i] });
        return;
      }
      if (!used.has(id)) return;
      if (encoding === FRAMED) {
        const frame = prev.index.f![i] - 1;
        if (keptFrames.has(frame)) {
          placed.push({ id, stored: EMPTY, rawLength, encoding, prevOffset: -1, frame: prev.index.c[frame], at: prev.index.o![i] });
        } else {
          reframed.set(id, prev.rawChunk(i));
        }
        return;
      }
      // Packs from before frames, or before their dictionary, move their small text into frames once.
      if (framing && id !== dictionaryId && (encoding === ZSTD_DICT || encoding === BROTLI) && rawLength <= MAX_DICT_CHUNK_BYTES) {
        reframed.set(id, prev.rawChunk(i));
        return;
      }
      placed.push({ id, stored: prev.storedChunk(i), rawLength, encoding, prevOffset: prev.offsets[i] });
    });
  }
  const carriedOver = new Set(placed.map((p) => p.id));

  let newChunks = 0;
  let newBytes = 0;
  const toFrame: { id: string; raw: Buffer }[] = [];
  // `used` iterates in route order, which keeps the bytes of a build deterministic
  // and puts the chunks of one page in the same frame.
  for (const id of used) {
    if (carriedOver.has(id)) continue;
    const old = reframed.get(id);
    if (old) {
      toFrame.push({ id, raw: old });
      continue;
    }
    const source = incoming.get(id);
    if (!source) throw new Error(`no source bytes for chunk ${id}`);
    newChunks++;
    if (frameable(source.raw.byteLength, source.mime)) {
      toFrame.push({ id, raw: source.raw });
      continue;
    }
    const { stored, encoding } = compress(source.raw, source.mime);
    placed.push({ id, stored, rawLength: source.raw.byteLength, encoding, prevOffset: -1 });
    newBytes += stored.byteLength;
  }

  const groups: { id: string; raw: Buffer }[][] = [];
  let fill = 0;
  for (const chunk of toFrame) {
    if (!groups.length || fill + chunk.raw.byteLength > FRAME_RAW_BYTES) {
      groups.push([]);
      fill = 0;
    }
    groups[groups.length - 1].push(chunk);
    fill += chunk.raw.byteLength;
  }
  const placedIds = new Set(placed.map((p) => p.id));
  for (const group of groups) {
    const raw = Buffer.concat(group.map((c) => c.raw));
    const frameId = chunkId(raw);
    // A frame of one chunk would share that chunk's id; one chunk is stored alone.
    if (group.length === 1 || used.has(frameId) || placedIds.has(frameId)) {
      for (const chunk of group) {
        const { stored, encoding } = compress(chunk.raw, BROTLI_CHUNK_MIME);
        placed.push({ id: chunk.id, stored, rawLength: chunk.raw.byteLength, encoding, prevOffset: -1 });
        newBytes += stored.byteLength;
      }
      continue;
    }
    const stored = zlib.zstdCompressSync(raw, {
      dictionary: dictionary!,
      params: { [zlib.constants.ZSTD_c_compressionLevel]: FRAME_LEVEL },
    });
    placed.push({ id: frameId, stored, rawLength: raw.byteLength, encoding: FRAME, prevOffset: -1 });
    placedIds.add(frameId);
    let at = 0;
    for (const chunk of group) {
      placed.push({ id: chunk.id, stored: EMPTY, rawLength: chunk.raw.byteLength, encoding: FRAMED, prevOffset: -1, frame: frameId, at });
      at += chunk.raw.byteLength;
    }
    newBytes += stored.byteLength;
  }

  // 5. Write the sections.
  const offsets = new Map<string, number>();
  let dataLen = 0;
  const data = sha256(new Uint8Array(0));
  for (const chunk of placed) {
    offsets.set(chunk.id, offsets.size);
    data.update(chunk.stored);
    dataLen += chunk.stored.byteLength;
  }
  const framed = placed.some((p) => p.encoding === FRAMED);

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
    ...(framed
      ? {
          f: placed.map((p) => (p.frame ? offsets.get(p.frame)! + 1 : 0)),
          o: placed.map((p) => p.at ?? 0),
        }
      : {}),
  };
  const indexBytes = brotli(Buffer.from(JSON.stringify(index), "utf8"), 22);

  // 6. Remap generation tails onto the new layout.
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
    ...(dictionaryId ? { dict: dictionaryId } : {}),
    ...(framed ? { frame: FRAME_RAW_BYTES } : {}),
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
    unchanged: prev?.meta.commit === fingerprint && !reencoded && reframed.size === 0,
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
