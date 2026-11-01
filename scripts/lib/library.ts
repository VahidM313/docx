/**
 * The library: every docpack in one release asset.
 *
 * Layout:
 *
 *   offset  size  field
 *        0     4  magic "DOCL"
 *        4     2  version (1), little endian
 *        6     2  reserved
 *        8     4  directory length
 *       12     4  reserved
 *       16    16  directory hash (ASCII hex)
 *       32     -  directory (brotli JSON: what each pack is and where it sits)
 *        -     -  packs, back to back, each byte-identical to a standalone .docpack
 *
 * Clients never download this file as a whole. They read the directory from its
 * head and then only the byte ranges of the pack or chunks they need, so a release
 * needs no registry, no per-site file and no patch files.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { DOCPACK_V3_VERSION, HEADER_BYTES as PACK_HEADER_BYTES, updateBytesFrom, type PackMeta } from "./docpack-v3";

export const LIBRARY_VERSION = 1;
export const LIBRARY_HEADER_BYTES = 32;
export const LIBRARY_ASSET = "Docx-library.bin";
export const LIBRARY_URL = `https://github.com/VahidM313/docx/releases/download/packs-latest/${LIBRARY_ASSET}`;
/** GitHub refuses release assets of 2 GiB and up. */
export const MAX_LIBRARY_BYTES = 2 * 1024 ** 3 - 16 * 1024 ** 2;

const HEAD_PROBE_BYTES = 64 * 1024;
const COPY_BUFFER_BYTES = 1 << 20;

export interface LibraryEntry {
  id: string;
  name: string;
  version: string;
  commit: string;
  updatedAt: string;
  /** Where the pack starts, counted from the end of the directory. */
  offset: number;
  sizeBytes: number;
  chunkCount: number;
  routeCount: number;
  /** Older commit -> bytes a client on it must fetch. */
  gens: Record<string, number>;
  truncated?: boolean;
}

export interface LibraryDirectory {
  version: number;
  updatedAt: string;
  packs: Record<string, LibraryEntry>;
}

export interface Library {
  directory: LibraryDirectory;
  /** File offset of the first pack; entry offsets count from here. */
  dataStart: number;
}

export type ReadRange = (start: number, end: number) => Promise<Buffer>;

const hashOf = (bytes: Uint8Array) => crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 16);

export const fileReader = (filePath: string): ReadRange => {
  return async (start, end) => {
    const fd = fs.openSync(filePath, "r");
    try {
      const out = Buffer.alloc(end - start);
      const read = fs.readSync(fd, out, 0, out.length, start);
      return out.subarray(0, read);
    } finally {
      fs.closeSync(fd);
    }
  };
};

export const urlReader = (url: string): ReadRange => {
  return async (start, end) => {
    const res = await fetch(url, { headers: { Range: `bytes=${start}-${end - 1}` }, signal: AbortSignal.timeout(300_000) });
    if (res.status !== 206) throw new Error(`HTTP ${res.status} for a range of ${url}`);
    return Buffer.from(await res.arrayBuffer());
  };
};

export async function readLibrary(read: ReadRange): Promise<Library> {
  let head = await read(0, HEAD_PROBE_BYTES);
  if (head.length < LIBRARY_HEADER_BYTES || head.subarray(0, 4).toString("latin1") !== "DOCL") {
    throw new Error("not a docx library");
  }
  const version = head.readUInt16LE(4);
  if (version !== LIBRARY_VERSION) throw new Error(`unsupported library version ${version}`);
  const directoryLength = head.readUInt32LE(8);
  const dataStart = LIBRARY_HEADER_BYTES + directoryLength;
  if (head.length < dataStart) head = Buffer.concat([head, await read(head.length, dataStart)]);

  const compressed = head.subarray(LIBRARY_HEADER_BYTES, dataStart);
  if (hashOf(compressed) !== head.subarray(16, 32).toString("latin1")) throw new Error("library directory hash mismatch");
  return { directory: JSON.parse(zlib.brotliDecompressSync(compressed).toString("utf8")), dataStart };
}

/** Everything the directory says about a pack, read from the pack itself. */
function describePack(filePath: string, start: number, length: number): { entry: Omit<LibraryEntry, "offset">; meta: PackMeta } {
  const fd = fs.openSync(filePath, "r");
  try {
    const header = Buffer.alloc(PACK_HEADER_BYTES);
    fs.readSync(fd, header, 0, PACK_HEADER_BYTES, start);
    if (header.subarray(0, 4).toString("latin1") !== "DOCP" || header.readUInt16LE(4) !== DOCPACK_V3_VERSION) {
      throw new Error("not a v3 docpack");
    }
    const metaLength = header.readUInt32LE(8);
    const indexLength = header.readUInt32LE(12);
    const dataLength = Number(header.readBigUInt64LE(16));
    const headBytes = PACK_HEADER_BYTES + metaLength + indexLength;
    if (headBytes + dataLength !== length) throw new Error(`length ${length} does not match its header`);

    const metaBytes = Buffer.alloc(metaLength);
    fs.readSync(fd, metaBytes, 0, metaLength, start + PACK_HEADER_BYTES);
    const meta: PackMeta = JSON.parse(metaBytes.toString("utf8"));

    // A pack that fails here would fail on every client, so it must not be published.
    const hash = crypto.createHash("sha256");
    const buffer = Buffer.alloc(COPY_BUFFER_BYTES);
    for (let done = 0; done < dataLength; ) {
      const n = fs.readSync(fd, buffer, 0, Math.min(buffer.length, dataLength - done), start + headBytes + done);
      if (n === 0) throw new Error("truncated pack data");
      hash.update(buffer.subarray(0, n));
      done += n;
    }
    if (hash.digest("hex").slice(0, 32) !== meta.dataHash) throw new Error("pack data does not match its hash");

    const gens: Record<string, number> = {};
    for (const g of meta.gens) gens[g.commit] = updateBytesFrom(meta, headBytes, g.commit)!;
    return {
      meta,
      entry: {
        id: meta.id,
        name: meta.name,
        version: meta.version,
        commit: meta.commit,
        updatedAt: meta.updatedAt,
        sizeBytes: length,
        chunkCount: meta.chunkCount,
        routeCount: meta.routeCount,
        gens,
        ...(meta.truncated ? { truncated: true } : {}),
      },
    };
  } finally {
    fs.closeSync(fd);
  }
}

function copyRange(fromPath: string, start: number, length: number, out: number) {
  const fd = fs.openSync(fromPath, "r");
  try {
    const buffer = Buffer.alloc(COPY_BUFFER_BYTES);
    for (let done = 0; done < length; ) {
      const n = fs.readSync(fd, buffer, 0, Math.min(buffer.length, length - done), start + done);
      if (n === 0) throw new Error(`${fromPath} ended early`);
      fs.writeSync(out, buffer, 0, n);
      done += n;
    }
  } finally {
    fs.closeSync(fd);
  }
}

export interface ComposeInput {
  /** The sites a library may hold. Packs of anything else are dropped. */
  ids: string[];
  /** Holds `<id>.docpack` for each pack that changed. */
  packsDir: string;
  /** The published library, the source of every pack that did not change. */
  previousPath?: string | null;
  outPath: string;
  now?: Date;
}

export interface ComposeResult {
  packs: number;
  bytes: number;
  replaced: string[];
  kept: string[];
  /** Sites with no pack from this build or the previous library. */
  missing: string[];
}

/** Writes a new library, verifying every pack in it. Nothing is left at `outPath` on failure. */
export async function composeLibrary(input: ComposeInput): Promise<ComposeResult> {
  const previous = input.previousPath ? await readLibrary(fileReader(input.previousPath)) : null;
  const sources: { filePath: string; start: number; length: number; entry: Omit<LibraryEntry, "offset"> }[] = [];
  const result: ComposeResult = { packs: 0, bytes: 0, replaced: [], kept: [], missing: [] };

  for (const id of [...input.ids].sort()) {
    const fresh = path.join(input.packsDir, `${id}.docpack`);
    const old = previous?.directory.packs[id];
    let source: { filePath: string; start: number; length: number } | null = null;
    if (fs.existsSync(fresh)) {
      source = { filePath: fresh, start: 0, length: fs.statSync(fresh).size };
      result.replaced.push(id);
    } else if (old) {
      source = { filePath: input.previousPath!, start: previous!.dataStart + old.offset, length: old.sizeBytes };
      result.kept.push(id);
    }
    if (!source) {
      result.missing.push(id);
      continue;
    }
    const { entry } = describePack(source.filePath, source.start, source.length);
    if (entry.id !== id) throw new Error(`${path.basename(source.filePath)} holds ${entry.id}, not ${id}`);
    sources.push({ ...source, entry });
  }

  const packs: Record<string, LibraryEntry> = {};
  let offset = 0;
  for (const s of sources) {
    packs[s.entry.id] = { ...s.entry, offset };
    offset += s.length;
  }
  const directory: LibraryDirectory = {
    version: LIBRARY_VERSION,
    updatedAt: (input.now ?? new Date()).toISOString(),
    packs,
  };
  const compressed = zlib.brotliCompressSync(Buffer.from(JSON.stringify(directory), "utf8"), {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
  });

  const total = LIBRARY_HEADER_BYTES + compressed.length + offset;
  if (total > MAX_LIBRARY_BYTES) {
    throw new Error(`library would be ${(total / 1024 ** 3).toFixed(2)} GiB, over GitHub's asset limit`);
  }

  const header = Buffer.alloc(LIBRARY_HEADER_BYTES);
  header.write("DOCL", 0, "latin1");
  header.writeUInt16LE(LIBRARY_VERSION, 4);
  header.writeUInt32LE(compressed.length, 8);
  header.write(hashOf(compressed), 16, "latin1");

  const partial = `${input.outPath}.tmp`;
  const out = fs.openSync(partial, "w");
  try {
    fs.writeSync(out, header);
    fs.writeSync(out, compressed);
    for (const s of sources) copyRange(s.filePath, s.start, s.length, out);
  } catch (e) {
    fs.closeSync(out);
    fs.rmSync(partial, { force: true });
    throw e;
  }
  fs.closeSync(out);
  fs.renameSync(partial, input.outPath);

  return { ...result, packs: sources.length, bytes: total };
}
