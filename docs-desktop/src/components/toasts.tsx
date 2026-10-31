import * as React from "react";
import { useApp } from "../lib/store";
import { getBrand } from "../lib/catalog";
import { CheckCircle2, AlertTriangle, Info, X, Loader2 } from "lucide-react";

const MAX_VISIBLE_DOWNLOADS = 3;

export function ToastHost() {
  const app = useApp();
  return (
    <div className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom,0px)+4.25rem)] right-3 z-[120] flex w-[min(320px,calc(100vw-24px))] flex-col gap-2 md:bottom-3">
      {app.toasts.map((t) => {
        const Icon =
          t.kind === "success" ? CheckCircle2 : t.kind === "error" ? AlertTriangle : t.kind === "progress" ? Loader2 : Info;
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-2.5 rounded-md border border-border bg-popover px-3 py-2 shadow-lift animate-fade-in"
          >
            <Icon
              size={16}
              className={
                "shrink-0 " +
                (t.kind === "success"
                  ? "text-success"
                  : t.kind === "error"
                    ? "text-danger"
                    : t.kind === "progress"
                      ? "animate-spin text-brand"
                      : "text-muted-foreground")
              }
            />
            <span className="min-w-0 flex-1 line-clamp-3 text-[12.5px] font-medium">{t.message}</span>
            {t.kind !== "progress" && (
              <button
                onClick={() => app.dropToast(t.id)}
                aria-label="Dismiss"
                className="grid h-5 w-5 place-items-center rounded text-muted-foreground transition-colors hover:text-foreground pointer-coarse:h-9 pointer-coarse:w-9"
              >
                <X size={11} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Floating HUD while packs download: bottom-left, or under the header on phones,
 *  where the bottom of the screen belongs to navigation. */
export function DownloadHud() {
  const app = useApp();
  const active = Object.entries(app.downloads);
  if (!active.length) return null;
  return (
    <div className="pointer-events-none fixed left-3 top-[calc(env(safe-area-inset-top,0px)+3.5rem)] z-[110] w-[calc(100vw-24px)] rounded-md border border-border bg-popover p-3 shadow-lift md:pointer-events-auto md:safe-bottom md:top-auto md:bottom-3 md:w-[280px]">
      <div className="mb-2 flex items-center justify-between text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
        <span className="text-brand">Downloads</span>
        <span className="tabular-nums">
          {active.filter(([, p]) => p.percent >= 100).length}/{active.length} done
        </span>
      </div>
      <div className="space-y-2">
        {active.slice(0, MAX_VISIBLE_DOWNLOADS).map(([id, p]) => (
          <div key={id}>
            <div className="flex items-center gap-1.5 text-[11.5px]">
              <span className="truncate font-medium">{getBrand(id).name}</span>
              <span className="ml-auto tabular-nums text-muted-foreground">{Math.round(p.percent)}%</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-brand transition-[width] duration-300"
                style={{ width: `${Math.max(3, p.percent)}%` }}
              />
            </div>
          </div>
        ))}
        {active.length > MAX_VISIBLE_DOWNLOADS && (
          <div className="text-[11px] text-muted-foreground">+{active.length - MAX_VISIBLE_DOWNLOADS} more</div>
        )}
      </div>
    </div>
  );
}
