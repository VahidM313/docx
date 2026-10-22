import {
  type TranslationModelProgress,
  type TranslationModelStatus,
  type TranslationTask,
} from "./types";
import {
  getCachedTranslations,
  setCachedTranslationsBatch,
} from "./cache";

// Common developer documentation terminology dictionary for fast instant translation
const DEV_DOCS_DICTIONARY: Record<string, string> = {
  "Overview": "مرور کلی",
  "Introduction": "معرفی",
  "Getting Started": "شروع به کار",
  "Quick Start": "شروع سریع",
  "Installation": "نصب و راه‌اندازی",
  "Usage": "نحوه استفاده",
  "Basic Usage": "استفاده مقدماتی",
  "Advanced Usage": "استفاده پیشرفته",
  "Examples": "نمونه‌ها و مثال‌ها",
  "Example": "مثال",
  "API Reference": "مرجع API",
  "Reference": "مرجع",
  "Configuration": "پیکربندی و تنظیمات",
  "Options": "گزینه‌ها",
  "Parameters": "پارامترها",
  "Arguments": "آرگومان‌ها",
  "Properties": "ویژگی‌ها (Properties)",
  "Methods": "متدها (Methods)",
  "Functions": "توابع",
  "Return Value": "مقدار بازگشتی",
  "Returns": "بازمی‌گرداند",
  "Description": "توضیحات",
  "Types": "انواع و تایپ‌ها",
  "Components": "کامپوننت‌ها",
  "Hooks": "هوک‌ها",
  "State": "وضعیت (State)",
  "Props": "پراپ‌ها (Props)",
  "Events": "رویدادها (Events)",
  "Guides": "راهنماها",
  "Tutorials": "آموزش‌ها",
  "Tutorial": "آموزش",
  "Architecture": "معماری سیستم",
  "Best Practices": "بهترین روش‌ها و الگوها",
  "Troubleshooting": "عیب‌یابی و حل مشکلات",
  "FAQ": "پرسش‌های متداول",
  "Frequently Asked Questions": "پرسش‌های متداول",
  "Changelog": "تغییرات نسخه‌ها",
  "Migration Guide": "راهنمای مهاجرت",
  "Contributing": "مشارکت در توسعه",
  "License": "مجوز",
  "Security": "امنیت",
  "Performance": "کارایی و بهینه‌سازی",
  "Deployment": "استقرار و پابلیش",
  "Testing": "تست و آزمون",
  "Features": "قابلیت‌ها و امکانات",
  "Requirements": "پیش‌نیازها",
  "Prerequisites": "پیش‌نیازها",
  "Table of Contents": "فهرست مطالب",
  "Next Steps": "مراحل بعدی",
  "Summary": "خلاصه",
  "Note": "نکته",
  "Warning": "هشدار",
  "Caution": "توجه",
  "Important": "مهم",
  "Tip": "ترفند",
};

let worker: Worker | null = null;
let currentStatus: TranslationModelProgress = {
  status:
    typeof window !== "undefined" && localStorage.getItem("docx_model_ready_v1") === "true"
      ? "ready"
      : "not-downloaded",
  percent:
    typeof window !== "undefined" && localStorage.getItem("docx_model_ready_v1") === "true"
      ? 100
      : 0,
};

const statusListeners = new Set<(progress: TranslationModelProgress) => void>();

function updateStatus(progress: TranslationModelProgress) {
  currentStatus = progress;
  statusListeners.forEach((fn) => {
    try {
      fn(progress);
    } catch {}
  });
}

export async function checkCachedModelOnDisk(): Promise<boolean> {
  if (typeof window === "undefined" || !("caches" in window)) return false;
  try {
    const hasCache = await window.caches.has("transformers-cache");
    if (!hasCache) return false;
    const cache = await window.caches.open("transformers-cache");
    const requests = await cache.keys();
    const urls = requests.map((r) => r.url);
    const hasEncoder = urls.some((u) => u.includes("encoder_model"));
    const hasDecoder = urls.some((u) => u.includes("decoder_model"));
    if (hasEncoder && hasDecoder) {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("docx_model_ready_v1", "true");
      }
      updateStatus({
        status: "ready",
        percent: 100,
        message: "Meta NLLB-200 offline translation model ready",
      });
      return true;
    }
  } catch (err) {
    console.warn("Could not inspect CacheStorage:", err);
  }
  return false;
}

if (typeof window !== "undefined") {
  void checkCachedModelOnDisk();
}

function getWorker(): Worker | null {
  if (typeof window === "undefined") return null;
  if (!worker) {
    try {
      worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (e: MessageEvent) => {
        const { type, status, percent, message, totalBytes, downloadedBytes } = e.data || {};
        if (type === "MODEL_STATUS") {
          updateStatus({
            status: status as TranslationModelStatus,
            percent: percent || 0,
            message,
            totalBytes,
            downloadedBytes,
          });
        }
      };
      worker.onerror = (err) => {
        console.error("Translation worker error:", err);
        updateStatus({
          status: "error",
          percent: 0,
          message: "Worker failed to initialize",
        });
      };
    } catch (e) {
      console.warn("Could not create translation Web Worker:", e);
    }
  }
  return worker;
}

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
  const w = getWorker();
  if (!w) return;
  w.postMessage({ type: "INIT_MODEL" });
}

export async function deleteTranslationModel(): Promise<void> {
  // 1. Delete browser caches (transformers.js stores weights in CacheStorage)
  try {
    if (typeof window !== "undefined" && "caches" in window) {
      const keys = await window.caches.keys();
      for (const k of keys) {
        if (k.includes("transformers") || k.includes("nllb") || k.includes("onnx") || k.includes("xenova")) {
          await window.caches.delete(k);
        }
      }
      await window.caches.delete("transformers-cache");
    }
  } catch (err) {
    console.warn("Failed to delete CacheStorage:", err);
  }

  // 2. Clear persisted ready flag in localStorage
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("docx_model_ready_v1");
    }
  } catch {}

  // 3. Terminate active worker
  if (worker) {
    try {
      worker.postMessage({ type: "DELETE_MODEL" });
      worker.terminate();
    } catch {}
    worker = null;
  }

  // 4. Reset engine state and notify subscribers
  updateStatus({
    status: "not-downloaded",
    percent: 0,
    message: undefined,
    downloadedBytes: 0,
    totalBytes: 0,
  });
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

  // 1. Check persistent IndexedDB/localStorage cache
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

  // 3. Translate uncached items using background worker
  if (uncachedItems.length > 0) {
    const w = getWorker();
    if (w) {
      const initialDone = items.length - uncachedItems.length;
      const workerResults = await new Promise<Record<string, { translated: string; hash: string }>>(
        (resolve) => {
          const handler = (e: MessageEvent) => {
            if (e.data?.type === "TRANSLATE_ITEM_PROGRESS" && e.data.payload) {
              const { id, translated, hash, completed } = e.data.payload;
              results[id] = { translated, hash };
              if (onProgress) {
                const totalCompleted = initialDone + completed;
                onProgress(
                  { [id]: { translated, hash } },
                  {
                    completed: totalCompleted,
                    total: items.length,
                    percent: Math.round((totalCompleted / items.length) * 100),
                  },
                );
              }
            } else if (e.data?.type === "TRANSLATE_BATCH_DONE") {
              w.removeEventListener("message", handler);
              resolve(e.data.results || {});
            } else if (e.data?.type === "TRANSLATE_BATCH_ERROR") {
              w.removeEventListener("message", handler);
              resolve({});
            }
          };
          w.addEventListener("message", handler);
          w.postMessage({
            type: "TRANSLATE_BATCH",
            payload: { items: uncachedItems },
          });

          // 120s timeout fallback for large neural batches
          setTimeout(() => {
            w.removeEventListener("message", handler);
            resolve({});
          }, 120000);
        },
      );

      for (const [id, res] of Object.entries(workerResults)) {
        results[id] = res;
      }
    }
  }

  // 4. Batch save newly generated translations to persistent cache
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
