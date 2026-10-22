import {
  type TranslationModelProgress,
  type TranslationTask,
} from "./types";
import {
  getCachedTranslations,
  setCachedTranslationsBatch,
} from "./cache";

// Common developer documentation terminology dictionary for fast instant translation
const DEV_DOCS_DICTIONARY: Record<string, string> = {
  Overview: "مرور کلی",
  Introduction: "معرفی",
  "Getting Started": "شروع به کار",
  "Quick Start": "شروع سریع",
  Installation: "نصب و راه‌اندازی",
  Usage: "نحوه استفاده",
  "Basic Usage": "استفاده مقدماتی",
  "Advanced Usage": "استفاده پیشرفته",
  Examples: "نمونه‌ها و مثال‌ها",
  Example: "مثال",
  "API Reference": "مرجع API",
  Reference: "مرجع",
  Configuration: "پیکربندی و تنظیمات",
  Options: "گزینه‌ها",
  Parameters: "پارامترها",
  Arguments: "آرگومان‌ها",
  Properties: "ویژگی‌ها (Properties)",
  Methods: "متدها (Methods)",
  Functions: "توابع",
  "Return Value": "مقدار بازگشتی",
  Returns: "بازمی‌گرداند",
  Description: "توضیحات",
  Types: "انواع و تایپ‌ها",
  Components: "کامپوننت‌ها",
  Hooks: "هوک‌ها",
  State: "وضعیت (State)",
  Props: "پراپ‌ها (Props)",
  Events: "رویدادها (Events)",
  Guides: "راهنماها",
  Tutorials: "آموزش‌ها",
  Tutorial: "آموزش",
  Architecture: "معماری سیستم",
  "Best Practices": "بهترین روش‌ها و الگوها",
  Troubleshooting: "عیب‌یابی و حل مشکلات",
  FAQ: "پرسش‌های متداول",
  "Frequently Asked Questions": "پرسش‌های متداول",
  Changelog: "تغییرات نسخه‌ها",
  "Migration Guide": "راهنمای مهاجرت",
  Contributing: "مشارکت در توسعه",
  License: "مجوز",
  Security: "امنیت",
  Performance: "کارایی و بهینه‌سازی",
  Deployment: "استقرار و پابلیش",
  Testing: "تست و آزمون",
  Features: "قابلیت‌ها و امکانات",
  Requirements: "پیش‌نیازها",
  Prerequisites: "پیش‌نیازها",
  "Table of Contents": "فهرست مطالب",
  "Next Steps": "مراحل بعدی",
  Summary: "خلاصه",
  Note: "نکته",
  Warning: "هشدار",
  Caution: "توجه",
  Important: "مهم",
  Tip: "ترفند",
};

const currentStatus: TranslationModelProgress = {
  status: "ready",
  percent: 100,
  message: "TWP Online Engine Ready with Permanent Offline Cache",
};

const statusListeners = new Set<(progress: TranslationModelProgress) => void>();

export function subscribeModelStatus(fn: (progress: TranslationModelProgress) => void) {
  statusListeners.add(fn);
  fn(currentStatus);
  return () => {
    statusListeners.delete(fn);
  };
}

export function getModelProgress(): TranslationModelProgress {
  return currentStatus;
}

export function initTranslationModel(): void {
  // Online engine is always ready
}

export async function deleteTranslationModel(): Promise<void> {
  // Purge any legacy 870MB local model files from CacheStorage to free disk space
  try {
    if (typeof window !== "undefined" && "caches" in window) {
      const keys = await window.caches.keys();
      for (const k of keys) {
        if (
          k.includes("transformers") ||
          k.includes("nllb") ||
          k.includes("onnx") ||
          k.includes("xenova")
        ) {
          await window.caches.delete(k);
        }
      }
      await window.caches.delete("transformers-cache");
    }
  } catch (err) {
    console.warn("Failed to delete legacy CacheStorage:", err);
  }

  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("docx_model_ready_v1");
    }
  } catch {}
}

const SEP = "\n\n⟦DOCX_SEP⟧\n\n";

async function translateSingleOnline(text: string): Promise<string> {
  // 1. Primary: Google Translate GTX endpoint (TWP standard)
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=fa&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = (await res.json()) as unknown as [Array<[string, string]>];
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const full = data[0].map((x) => x[0]).join("");
        if (full) return full;
      }
    }
  } catch {}

  // 2. Fallback: Google client5 endpoint
  try {
    const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=fa&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = (await res.json()) as unknown as [string | [string, string]];
      if (Array.isArray(data)) {
        const item = data[0];
        const resText = Array.isArray(item) ? item[0] : String(item);
        if (resText) return resText;
      }
    }
  } catch {}

  return text;
}

async function translateChunkOnline(texts: string[]): Promise<string[]> {
  if (texts.length === 1) {
    const single = await translateSingleOnline(texts[0]);
    return [single];
  }

  // Batch attempt using TWP-style separator
  try {
    const joined = texts.join(SEP);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=fa&dt=t&q=${encodeURIComponent(joined)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = (await res.json()) as unknown as [Array<[string, string]>];
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const full = data[0].map((x) => x[0]).join("");
        const parts = full.split(/⟦\s*DOCX_SEP\s*⟧/);
        if (parts.length === texts.length) {
          return parts.map((p) => p.trim());
        }
      }
    }
  } catch {}

  // Fallback: translate individually
  const results: string[] = [];
  for (const t of texts) {
    results.push(await translateSingleOnline(t));
  }
  return results;
}

export type TranslationProgressCallback = (
  chunk: Record<string, { translated: string; hash: string }>,
  progress: { completed: number; total: number; percent: number },
) => void;

export async function translateTasks(
  items: TranslationTask[],
  onProgress?: TranslationProgressCallback,
): Promise<Record<string, { translated: string; hash: string }>> {
  if (!items.length) return {};

  const results: Record<string, { translated: string; hash: string }> = {};

  // 1. Check persistent IndexedDB/localStorage cache (0ms instant retrieval)
  const hashes = items.map((i) => i.hash);
  const cachedMap = await getCachedTranslations(hashes);

  const uncachedItems: TranslationTask[] = [];

  for (const item of items) {
    if (cachedMap[item.hash]) {
      results[item.id] = {
        translated: cachedMap[item.hash],
        hash: item.hash,
      };
    } else {
      // 2. Check technical terminology dictionary
      const exactMatch = DEV_DOCS_DICTIONARY[item.text.trim()];
      if (exactMatch) {
        results[item.id] = {
          translated: exactMatch,
          hash: item.hash,
        };
      } else {
        uncachedItems.push(item);
      }
    }
  }

  // If we already have instant translations (from cache or dictionary), flush them immediately!
  if (onProgress && Object.keys(results).length > 0) {
    const instantCompleted = Object.keys(results).length;
    onProgress(results, {
      completed: instantCompleted,
      total: items.length,
      percent: Math.round((instantCompleted / items.length) * 100),
    });
  }

  // 3. Translate uncached items using fast TWP online engine in chunks
  if (uncachedItems.length > 0) {
    const CHUNK_SIZE = 5;
    const initialDone = items.length - uncachedItems.length;
    let newlyCompleted = 0;

    for (let i = 0; i < uncachedItems.length; i += CHUNK_SIZE) {
      const chunk = uncachedItems.slice(i, i + CHUNK_SIZE);
      const texts = chunk.map((c) => c.text);
      const translatedTexts = await translateChunkOnline(texts);

      const chunkResult: Record<string, { translated: string; hash: string }> = {};
      for (let j = 0; j < chunk.length; j++) {
        const item = chunk[j];
        const translated = translatedTexts[j] || item.text;
        chunkResult[item.id] = { translated, hash: item.hash };
        results[item.id] = { translated, hash: item.hash };
      }

      newlyCompleted += chunk.length;
      if (onProgress) {
        const totalCompleted = initialDone + newlyCompleted;
        onProgress(chunkResult, {
          completed: totalCompleted,
          total: items.length,
          percent: Math.round((totalCompleted / items.length) * 100),
        });
      }
    }
  }

  // 4. Batch save newly generated translations to persistent IndexedDB cache & localStorage
  const newlyCached: { hash: string; original: string; translated: string }[] = [];
  for (const item of items) {
    if (results[item.id] && !cachedMap[item.hash]) {
      newlyCached.push({
        hash: item.hash,
        original: item.text,
        translated: results[item.id].translated,
      });
    }
  }

  if (newlyCached.length > 0) {
    setCachedTranslationsBatch(newlyCached).catch(() => {});
  }

  return results;
}
