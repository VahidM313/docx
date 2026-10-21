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
  status: "not-downloaded",
  percent: 0,
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

export async function translateTasks(
  items: TranslationTask[],
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

  // 3. Translate uncached items using background worker if model is ready
  if (uncachedItems.length > 0) {
    const w = getWorker();
    if (w && currentStatus.status === "ready") {
      const workerResults = await new Promise<Record<string, { translated: string; hash: string }>>(
        (resolve) => {
          const handler = (e: MessageEvent) => {
            if (e.data?.type === "TRANSLATE_BATCH_DONE") {
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

          // 30s timeout fallback
          setTimeout(() => {
            w.removeEventListener("message", handler);
            resolve({});
          }, 30000);
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
