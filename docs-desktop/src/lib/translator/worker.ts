import { pipeline, env } from "@xenova/transformers";

// Configure transformers.js for browser environment
env.allowLocalModels = false;
env.useBrowserCache = true;

type TranslationPipeline = (
  text: string,
  options?: Record<string, unknown>,
) => Promise<Array<{ translation_text?: string }>>;

let translatorInstance: TranslationPipeline | null = null;
let isInitializing = false;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

// Per-file progress tracker to prevent erratic percentage jumps
const fileProgressMap = new Map<string, { loaded: number; total: number }>();
let maxReportedPercent = 0;

function computeOverallProgress(file: string, loaded: number, total: number) {
  fileProgressMap.set(file, { loaded, total });
  let sumLoaded = 0;
  let sumTotal = 0;
  for (const f of fileProgressMap.values()) {
    sumLoaded += f.loaded;
    sumTotal += f.total;
  }
  // Calculate percentage across all known files
  let pct = sumTotal > 0 ? Math.round((sumLoaded / sumTotal) * 100) : 0;
  // Monotonic clamp: never jump backwards (e.g. 40 -> 30)
  pct = Math.min(99, Math.max(maxReportedPercent, pct));
  maxReportedPercent = pct;

  const currentFileMb = (loaded / (1024 * 1024)).toFixed(1);
  const totalFileMb = (total / (1024 * 1024)).toFixed(1);
  const fileName = file.split("/").pop() || file;

  return {
    percent: pct,
    message: `Downloading ${fileName} (${currentFileMb} MB / ${totalFileMb} MB · ${pct}%)`,
    loadedBytes: sumLoaded,
    totalBytes: sumTotal,
  };
}

async function createPipelineWithFallback(): Promise<TranslationPipeline> {
  const hosts = ["https://huggingface.co/", "https://hf-mirror.com/"];
  let lastErr: unknown = null;

  for (const host of hosts) {
    try {
      env.remoteHost = host;
      const hostLabel = host.includes("mirror") ? "Fast Mirror (hf-mirror.com)" : "HuggingFace";
      self.postMessage({
        type: "MODEL_STATUS",
        status: "downloading",
        percent: maxReportedPercent,
        message: `Connecting to ${hostLabel}…`,
      });

      const instance = (await pipeline(
        "translation",
        "Xenova/nllb-200-distilled-600M",
        {
          quantized: true,
          progress_callback: (progress: { status?: string; total?: number; loaded?: number; file?: string; name?: string }) => {
            if (progress.status === "progress" && progress.total && progress.loaded !== undefined) {
              const file = progress.file || progress.name || "model weights";
              const { percent, message, loadedBytes, totalBytes } = computeOverallProgress(
                file,
                progress.loaded,
                progress.total,
              );
              self.postMessage({
                type: "MODEL_STATUS",
                status: "downloading",
                percent,
                message,
                totalBytes,
                downloadedBytes: loadedBytes,
              });
            }
            // Do NOT emit status: "ready" here. transformers.js emits progress.status === "ready"
            // for EACH individual asset file. The pipeline is only ready once pipeline(...) resolves.
          },
        },
      )) as unknown as TranslationPipeline;

      return instance;
    } catch (err: unknown) {
      lastErr = err;
      console.warn(`Failed loading model from ${host}:`, err);
    }
  }

  if (lastErr instanceof Error) {
    throw lastErr;
  }
  throw new Error(typeof lastErr === "string" ? lastErr : "Failed to download model from all mirrors");
}

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data || {};

  if (type === "INIT_MODEL") {
    if (translatorInstance) {
      self.postMessage({ type: "MODEL_STATUS", status: "ready", percent: 100 });
      return;
    }
    if (isInitializing) return;

    isInitializing = true;
    maxReportedPercent = 0;
    fileProgressMap.clear();

    self.postMessage({
      type: "MODEL_STATUS",
      status: "downloading",
      percent: 0,
      message: "Initializing Meta NLLB-200 offline translation model…",
    });

    try {
      translatorInstance = await createPipelineWithFallback();
      isInitializing = false;
      self.postMessage({
        type: "MODEL_STATUS",
        status: "ready",
        percent: 100,
        message: "Meta NLLB-200 offline translation model ready",
      });
    } catch (err: unknown) {
      isInitializing = false;
      const errMsg = err instanceof Error ? err.message : String(err);
      self.postMessage({
        type: "MODEL_STATUS",
        status: "error",
        percent: 0,
        message: errMsg,
      });
    }
  } else if (type === "DELETE_MODEL") {
    translatorInstance = null;
    isInitializing = false;
    maxReportedPercent = 0;
    fileProgressMap.clear();

    try {
      if (typeof caches !== "undefined") {
        const cacheKeys = await caches.keys();
        for (const key of cacheKeys) {
          await caches.delete(key);
        }
      }
    } catch (err) {
      console.warn("Failed to delete caches in worker:", err);
    }

    self.postMessage({
      type: "MODEL_STATUS",
      status: "not-downloaded",
      percent: 0,
      message: "Model deleted",
    });
  } else if (type === "TRANSLATE_BATCH") {
    const { items } = payload as { items: { id: string; text: string; hash: string }[] };
    if (!items || !items.length) {
      self.postMessage({ type: "TRANSLATE_BATCH_DONE", results: {} });
      return;
    }

    if (!translatorInstance) {
      if (!isInitializing) {
        isInitializing = true;
        try {
          self.postMessage({
            type: "MODEL_STATUS",
            status: "downloading",
            percent: 0,
            message: "Loading translation model…",
          });
          translatorInstance = await createPipelineWithFallback();
          isInitializing = false;
          self.postMessage({
            type: "MODEL_STATUS",
            status: "ready",
            percent: 100,
            message: "Meta NLLB-200 offline translation model ready",
          });
        } catch (err: unknown) {
          isInitializing = false;
          const errMsg = err instanceof Error ? err.message : String(err);
          self.postMessage({
            type: "MODEL_STATUS",
            status: "error",
            percent: 0,
            message: errMsg,
          });
          self.postMessage({
            type: "TRANSLATE_BATCH_ERROR",
            message: "Model not loaded: " + errMsg,
          });
          return;
        }
      } else {
        const start = Date.now();
        for (let i = 0; i < 180; i++) {
          if (!isInitializing || translatorInstance || Date.now() - start >= 45000) break;
          await sleep(250);
        }
        if (!translatorInstance) {
          self.postMessage({
            type: "TRANSLATE_BATCH_ERROR",
            message: "Model initialization timed out",
          });
          return;
        }
      }
    }

    const results: Record<string, { translated: string; hash: string }> = {};

    for (const item of items) {
      try {
        const out = await translatorInstance(item.text, {
          src_lang: "eng_Latn",
          tgt_lang: "pes_Arab",
          max_new_tokens: 256,
        });

        const translatedText = out?.[0]?.translation_text || item.text;
        results[item.id] = {
          translated: translatedText,
          hash: item.hash,
        };
      } catch {
        results[item.id] = {
          translated: item.text,
          hash: item.hash,
        };
      }
    }

    self.postMessage({
      type: "TRANSLATE_BATCH_DONE",
      results,
    });
  }
};
