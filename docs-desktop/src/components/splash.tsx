import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useApp } from "../lib/store";
import { Progress } from "../ui";

export function Splash() {
  const app = useApp();
  const [gone, setGone] = React.useState(false);

  React.useEffect(() => {
    if (app.phase === "ready") {
      const t = window.setTimeout(() => setGone(true), 480);
      return () => window.clearTimeout(t);
    }
  }, [app.phase]);

  const steps = ["Initializing offline engine", "Reading local packs", "Syncing with releases", "Warming up UI"];

  return (
    <AnimatePresence>
      {!gone && (
        <motion.div
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background"
          exit={{ opacity: 0, filter: "blur(6px)", scale: 1.02 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        >
          {/* aurora */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div className="aurora-blob h-64 w-80 animate-float" style={{ background: "var(--grad-a)", top: "18%", left: "20%" }} />
            <div className="aurora-blob h-72 w-96 animate-float" style={{ background: "var(--grad-b)", top: "34%", right: "16%", animationDelay: "1.2s" }} />
            <div className="aurora-blob h-52 w-72 animate-float" style={{ background: "var(--grad-c)", bottom: "12%", left: "40%", animationDelay: "2.4s" }} />
          </div>

          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="relative mb-5"
          >
            <div className="grad-border grid h-20 w-20 place-items-center rounded-3xl border border-border bg-card shadow-lift">
              <span className="grad-bg grid h-12 w-12 place-items-center rounded-2xl shadow-soft">
                <img src="/logo.png" alt="Docx" className="h-9 w-9" draggable={false} />
              </span>
            </div>
            <motion.span
              className="absolute -inset-2 rounded-3xl border border-[var(--grad-b)]/40"
              animate={{ scale: [1, 1.15, 1], opacity: [0.7, 0, 0.7] }}
              transition={{ repeat: Infinity, duration: 2.2 }}
            />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-black tracking-tight"
          >
            Doc<span className="grad-text">x</span>
          </motion.h1>
          <p className="mt-1 text-[12px] text-muted-foreground">123 documentation sites · fully offline</p>

          <div className="mt-7 w-64">
            <Progress value={app.splash.percent} className="h-2" />
            <motion.p
              key={app.splash.text}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-2 text-center text-[11px] font-medium text-muted-foreground"
            >
              {app.splash.text}
            </motion.p>
          </div>

          <motion.div
            className="absolute bottom-8 text-[10px] tracking-wide text-muted-foreground/70"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 2.6 }}
          >
            {steps[2]}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
