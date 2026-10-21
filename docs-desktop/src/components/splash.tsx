import * as React from "react";
import { useApp } from "../lib/store";
import { Progress } from "../ui";

export function Splash() {
  const app = useApp();
  const [gone, setGone] = React.useState(false);

  React.useEffect(() => {
    if (app.phase === "ready") {
      const t = window.setTimeout(() => setGone(true), 220);
      return () => window.clearTimeout(t);
    }
  }, [app.phase]);

  if (gone) return null;

  return (
    <div
      className={
        "fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background transition-opacity duration-200 " +
        (app.phase === "ready" ? "pointer-events-none opacity-0" : "opacity-100")
      }
    >
      <img src="/logo.png" alt="Docx" className="logo-glyph mb-4 h-16 w-16 object-contain" draggable={false} />
      <h1 className="text-xl font-bold tracking-tight">Docx</h1>
      <p className="mt-1 text-[12px] text-muted-foreground">Offline documentation hub</p>

      <div className="mt-6 w-60">
        <Progress value={app.splash.percent} className="h-1.5" />
        <p className="mt-2 text-center text-[11px] font-medium text-muted-foreground">{app.splash.text}</p>
      </div>
    </div>
  );
}
