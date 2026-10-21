import { pipeline, env } from "@xenova/transformers";

// Configure transformers.js for browser environment
env.allowLocalModels = false;
env.useBrowserCache = true;

let translatorInstance: any = null;
let isInitializing = false;

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data || {};

  if (type === "INIT_MODEL") {
    if (translatorInstance) {
      self.postMessage({ type: "MODEL_STATUS", status: "ready", percent: 100 });
      return;
    }
    if (isInitializing) return;

    isInitializing = true;
    self.postMessage({
      type: "MODEL_STATUS",
      status: "downloading",
      percent: 0,
      message: "Initializing Meta NLLB-200 offline translation model…",
    });

    try {
      translatorInstance = await pipeline(
        "translation",
        "Xenova/nllb-200-distilled-600M",
        {
          quantized: true,
          progress_callback: (progress: any) => {
            if (progress.status === "progress" && progress.total) {
              const pct = Math.min(99, Math.round((progress.loaded / progress.total) * 100));
              self.postMessage({
                type: "MODEL_STATUS",
                status: "downloading",
                percent: pct,
                message: `Downloading model weights: ${pct}%`,
                totalBytes: progress.total,
                downloadedBytes: progress.loaded,
              });
            } else if (progress.status === "ready") {
              self.postMessage({
                type: "MODEL_STATUS",
                status: "ready",
                percent: 100,
                message: "Meta NLLB-200 translation model ready",
              });
            }
          },
        },
      );

      isInitializing = false;
      self.postMessage({ type: "MODEL_STATUS", status: "ready", percent: 100 });
    } catch (err: any) {
      isInitializing = false;
      self.postMessage({
        type: "MODEL_STATUS",
        status: "error",
        percent: 0,
        message: String(err?.message || err),
      });
    }
  } else if (type === "TRANSLATE_BATCH") {
    const { items } = payload as { items: { id: string; text: string; hash: string }[] };
    if (!items || !items.length) {
      self.postMessage({ type: "TRANSLATE_BATCH_DONE", results: {} });
      return;
    }

    if (!translatorInstance) {
      self.postMessage({
        type: "TRANSLATE_BATCH_ERROR",
        message: "Model not loaded",
      });
      return;
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
      } catch (err) {
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
