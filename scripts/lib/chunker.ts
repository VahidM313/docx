/**
 * Content-defined chunking for documentation pages.
 *
 * A page is split where its *content* says so instead of at fixed offsets, so an
 * edit only disturbs the chunks around it. Two cut sources are combined:
 *
 *  1. Structural cuts at landmark tags (<nav>, <main>, <h2>, ...). These isolate
 *     the volatile <head> and make site-wide blocks such as sidebars byte-identical
 *     across pages, which is where most of the dedupe comes from.
 *  2. A gear-hash rolling cut (FastCDC-style normalized chunking) inside each
 *     structural segment, so long sections still resynchronize after an edit.
 *
 * The cut positions only matter to the pack builder: clients just see a list of
 * chunk ids per route, so these parameters can change without a format bump.
 */

export const CHUNK_MIN_BYTES = 1024;
export const CHUNK_AVG_BYTES = 4096;
export const CHUNK_MAX_BYTES = 16384;

/** Shortest segment a structural cut may create; denser cuts only add overhead. */
const MIN_STRUCTURAL_SEGMENT = 256;

const STRUCTURAL_TAGS =
  /<(?:\/head>|body\b|header\b|nav\b|\/nav>|main\b|article\b|aside\b|footer\b|\/footer>|h1\b|h2\b)/gi;

const GEAR = (() => {
  const table = new Uint32Array(256);
  let x = 0x9e3779b9;
  for (let i = 0; i < 256; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    table[i] = x;
  }
  return table;
})();

function rollingCuts(buf: Uint8Array, start: number, end: number, out: number[]) {
  // Test the top bits: bit k of a gear hash only sees the last k+1 bytes, so low
  // bits never fire on repetitive text and chunks would degrade to fixed-size cuts.
  const bits = Math.round(Math.log2(CHUNK_AVG_BYTES));
  const strictMask = (0xffffffff << (32 - (bits + 2))) >>> 0;
  const looseMask = (0xffffffff << (32 - (bits - 2))) >>> 0;

  let chunkStart = start;
  while (chunkStart < end) {
    const hardEnd = Math.min(chunkStart + CHUNK_MAX_BYTES, end);
    const normalPoint = Math.min(chunkStart + CHUNK_AVG_BYTES, end);
    let cut = hardEnd;
    let hash = 0;
    for (let i = chunkStart + CHUNK_MIN_BYTES; i < hardEnd; i++) {
      hash = ((hash << 1) + GEAR[buf[i]]) >>> 0;
      if ((hash & (i < normalPoint ? strictMask : looseMask)) === 0) {
        cut = i + 1;
        break;
      }
    }
    out.push(cut);
    chunkStart = cut;
  }
}

/** Returns the exclusive end offset of every chunk; the last one equals `buf.length`. */
export function chunkBoundaries(buf: Uint8Array, structural = true): number[] {
  const cuts: number[] = [];
  if (buf.length === 0) return cuts;

  let segmentStart = 0;
  if (structural) {
    // latin1 keeps string indices equal to byte offsets, including inside UTF-8 runs.
    const text = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength).toString("latin1");
    for (const match of text.matchAll(STRUCTURAL_TAGS)) {
      const at = match.index;
      if (at - segmentStart < MIN_STRUCTURAL_SEGMENT) continue;
      rollingCuts(buf, segmentStart, at, cuts);
      segmentStart = at;
    }
  }
  rollingCuts(buf, segmentStart, buf.length, cuts);
  return cuts;
}

export function splitIntoChunks(buf: Buffer, structural = true): Buffer[] {
  const out: Buffer[] = [];
  let start = 0;
  for (const end of chunkBoundaries(buf, structural)) {
    out.push(buf.subarray(start, end));
    start = end;
  }
  return out;
}
