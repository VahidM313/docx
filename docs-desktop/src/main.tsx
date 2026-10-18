import React from "react";
import { createRoot } from "react-dom/client";
import { Boot } from "./App";
import "./styles/globals.css";

const root = createRoot(document.getElementById("app-root")!);
root.render(<Boot />);

// Never fail to a silent white screen: surface early boot errors visually.
window.addEventListener("error", (e) => showBootError(e.error ?? e.message));
window.addEventListener("unhandledrejection", (e) => showBootError(e.reason));

let errShown = false;
function showBootError(err: unknown) {
  if (!document.getElementById("app-root")?.childElementCount && !errShown) {
    errShown = true;
    const el = document.createElement("pre");
    el.style.cssText =
      "position:fixed;inset:0;padding:24px;white-space:pre-wrap;font:12px/1.5 Consolas,monospace;background:#160f0f;color:#ffadc9;z-index:99999;overflow:auto";
    el.textContent = `Docx failed to start\n\n${String(
      (err as Error)?.stack ?? err,
    )}`;
    document.body.appendChild(el);
  }
  console.error(err);
}
