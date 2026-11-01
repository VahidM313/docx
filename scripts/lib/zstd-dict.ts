/**
 * Trains a zstd dictionary from a pack's text.
 *
 * Pages of one site repeat the same navigation and markup, which compressing each 4 KB
 * chunk alone cannot see. This picks the stretches of text that recur across the most
 * chunks (the COVER method) and joins them, best last, because zstd reaches the end of
 * a dictionary with the shortest offsets. Bun can compress with a dictionary but has no
 * trainer, and raw bytes like these are a valid zstd dictionary.
 */

const DMER_BYTES = 8;
const SEGMENT_BYTES = 2048;
const TABLE_BITS = 22;
/** More text than this teaches the dictionary nothing new. */
const MAX_SAMPLE_BYTES = 48 * 1024 * 1024;

export const MAX_DICTIONARY_BYTES = 256 * 1024;

function hashAt(bytes: Uint8Array, i: number): number {
  const low = (bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24)) >>> 0;
  const high = (bytes[i + 4] | (bytes[i + 5] << 8) | (bytes[i + 6] << 16) | (bytes[i + 7] << 24)) >>> 0;
  return (Math.imul(low, 0x9e3779b1) ^ Math.imul(high, 0x85ebca77)) >>> (32 - TABLE_BITS);
}

export function trainDictionary(chunks: Buffer[], maxBytes = MAX_DICTIONARY_BYTES): Buffer {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const stride = Math.max(1, Math.ceil(total / MAX_SAMPLE_BYTES));
  const picked = chunks.filter((_, i) => i % stride === 0);
  const sample = Buffer.concat(picked);
  const size = Math.min(maxBytes, Math.floor(sample.length / 4));
  if (size < SEGMENT_BYTES) return Buffer.alloc(0);

  // How many chunks hold each short string: repeats within one chunk are already cheap
  const counts = new Uint32Array(1 << TABLE_BITS);
  const lastChunk = new Int32Array(1 << TABLE_BITS).fill(-1);
  const hashes = new Uint32Array(Math.max(0, sample.length - DMER_BYTES + 1));
  let at = 0;
  picked.forEach((chunk, c) => {
    const end = Math.min(at + chunk.length, hashes.length);
    for (let i = at; i < end; i++) {
      const h = hashAt(sample, i);
      hashes[i] = h;
      if (lastChunk[h] !== c) {
        lastChunk[h] = c;
        counts[h]++;
      }
    }
    at += chunk.length;
  });

  // One segment per stretch of the sample, so that one big page cannot fill the dictionary
  const segments = Math.ceil(size / SEGMENT_BYTES);
  const epoch = Math.floor(hashes.length / segments);
  const window = SEGMENT_BYTES - DMER_BYTES;
  if (epoch < SEGMENT_BYTES) return sample.subarray(0, size);

  const inWindow = new Uint16Array(1 << TABLE_BITS);
  const picks: { start: number; score: number }[] = [];
  for (let e = 0; e < segments; e++) {
    const first = e * epoch;
    const last = Math.min(first + epoch, hashes.length);
    let score = 0;
    let best = -1;
    let bestStart = first;
    for (let i = first; i < last; i++) {
      if (inWindow[hashes[i]]++ === 0) score += counts[hashes[i]];
      const start = i - window + 1;
      if (start < first) continue;
      if (score > best) {
        best = score;
        bestStart = start;
      }
      if (--inWindow[hashes[start]] === 0) score -= counts[hashes[start]];
    }
    // Clear what is left of the window; the chosen strings are now covered
    for (let i = Math.max(first, last - window + 1); i < last; i++) inWindow[hashes[i]] = 0;
    for (let i = bestStart; i < bestStart + window; i++) counts[hashes[i]] = 0;
    picks.push({ start: bestStart, score: best });
  }

  picks.sort((a, b) => a.score - b.score || a.start - b.start);
  const parts = picks.map(({ start }) => sample.subarray(start, start + SEGMENT_BYTES));
  const dictionary = Buffer.concat(parts);
  return Buffer.from(dictionary.subarray(Math.max(0, dictionary.length - size)));
}
