import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useApp } from "../lib/store";
import { getBrand } from "../lib/catalog";
import { CheckCircle2, AlertTriangle, Info, X, Loader2 } from "lucide-react";

export function ToastHost() {
  const app = useApp();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[120] flex w-80 flex-col gap-2">
      <AnimatePresence>
        {app.toasts.map((t) => {
          const Icon =
            t.kind === "success" ? CheckCircle2 : t.kind === "error" ? AlertTriangle : t.kind === "progress" ? Loader2 : Info;
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 30, transition: { duration: 0.18 } }}
              className="pointer-events-auto flex items-center gap-3 rounded-xl border border-border bg-popover px-3.5 py-2.5 shadow-lift"
            >
              <Icon
                size={16}
                className={
                  "shrink-0 " +
                  (t.kind === "success"
                    ? "text-emerald-500"
                    : t.kind === "error"
                      ? "text-red-500"
                      : t.kind === "progress"
                        ? "animate-spin grad-text"
                        : "text-muted-foreground")
                }
              />
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{t.message}</span>
              {t.kind !== "progress" && (
                <button
                  onClick={() => app.dropToast(t.id)}
                  className="grid h-5 w-5 place-items-center rounded text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X size={11} />
                </button>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/** Floating HUD while packs download (bottom-left). */
export function DownloadHud() {
  const app = useApp();
  const active = Object.entries(app.downloads);
  return (
    <AnimatePresence>
      {active.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-4 left-4 z-[110] w-72 rounded-2xl border border-border bg-popover/95 p-3 shadow-lift backdrop-blur"
        >
          <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <span className="grad-text">Sync engine</span>
            <span className="tabular-nums">
              {active.filter(([, p]) => p.percent >= 100).length}/{active.length} done
            </span>
          </div>
          <div className="space-y-2">
            {active.slice(0, 5).map(([id, p]) => (
              <div key={id}>
                <div className="flex items-center gap-1.5 text-[11.5px]">
                  <span className="truncate font-medium">{getBrand(id).name}</span>
                  <span className="ml-auto tabular-nums text-muted-foreground">{Math.round(p.percent)}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="grad-bg h-full"
                    animate={{ width: `${Math.max(3, p.percent)}%` }}
                    transition={{ ease: "easeOut", duration: 0.35 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
