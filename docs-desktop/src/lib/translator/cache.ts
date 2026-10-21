/**
 * Persistent Translation Cache for Docx using IndexedDB with fallback to localStorage.
 * Enables 0ms offline retrieval for previously translated text.
 */

const DB_NAME = "docx_translation_cache_v1";
const STORE_NAME = "translations";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.reject(new Error("IndexedDB not supported"));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "hash" });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

/** Fast, consistent 32-bit FNV-1a string hash */
export function hashText(str: string): string {
  const normalized = str.trim().replace(/\s+/g, " ");
  let h = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    h ^= normalized.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export interface CachedTranslationRecord {
  hash: string;
  original: string;
  translated: string;
  updatedAt: number;
}

export async function getCachedTranslation(hash: string): Promise<string | null> {
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(hash);
      req.onsuccess = () => resolve(req.result?.translated ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    // localStorage fallback
    try {
      const item = localStorage.getItem(`docx_tr_${hash}`);
      return item ? JSON.parse(item).translated : null;
    } catch {
      return null;
    }
  }
}

export async function getCachedTranslations(hashes: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  if (!hashes.length) return result;

  try {
    const db = await getDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      let pending = hashes.length;

      for (const hash of hashes) {
        const req = store.get(hash);
        req.onsuccess = () => {
          if (req.result?.translated) {
            result[hash] = req.result.translated;
          }
          if (--pending === 0) resolve();
        };
        req.onerror = () => {
          if (--pending === 0) resolve();
        };
      }
    });
  } catch {
    for (const hash of hashes) {
      try {
        const item = localStorage.getItem(`docx_tr_${hash}`);
        if (item) {
          result[hash] = JSON.parse(item).translated;
        }
      } catch {}
    }
  }

  return result;
}

export async function setCachedTranslation(
  hash: string,
  original: string,
  translated: string,
): Promise<void> {
  const record: CachedTranslationRecord = {
    hash,
    original,
    translated,
    updatedAt: Date.now(),
  };

  try {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const req = tx.objectStore(STORE_NAME).put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    try {
      localStorage.setItem(`docx_tr_${hash}`, JSON.stringify(record));
    } catch {}
  }
}

export async function setCachedTranslationsBatch(
  entries: { hash: string; original: string; translated: string }[],
): Promise<void> {
  if (!entries.length) return;

  try {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const now = Date.now();

      for (const entry of entries) {
        store.put({
          hash: entry.hash,
          original: entry.original,
          translated: entry.translated,
          updatedAt: now,
        });
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    for (const entry of entries) {
      try {
        localStorage.setItem(
          `docx_tr_${entry.hash}`,
          JSON.stringify({
            hash: entry.hash,
            original: entry.original,
            translated: entry.translated,
            updatedAt: Date.now(),
          }),
        );
      } catch {}
    }
  }
}

export async function getTranslationCacheStats(): Promise<{ count: number; estimatedBytes: number }> {
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const countReq = store.count();

      countReq.onsuccess = () => {
        const count = countReq.result || 0;
        // Estimated ~300 bytes per average paragraph record
        resolve({ count, estimatedBytes: count * 300 });
      };
      countReq.onerror = () => resolve({ count: 0, estimatedBytes: 0 });
    });
  } catch {
    let count = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        if (localStorage.key(i)?.startsWith("docx_tr_")) count++;
      }
    } catch {}
    return { count, estimatedBytes: count * 300 };
  }
}

export async function clearTranslationCache(): Promise<void> {
  try {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const req = tx.objectStore(STORE_NAME).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {}

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("docx_tr_")) keysToRemove.push(key);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}
}
