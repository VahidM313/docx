/** Probe: what element is under given CSS points + real click sanity test. */
import fs from "fs";
const port = "9223";
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = targets.find((t: any) => t.type === "page" && !/devtools/i.test(t.url));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise<void>((res) => (ws.onopen = () => res()));
let nextId = 1;
const pending = new Map<number, (v: string) => void>();
ws.onmessage = (ev) => {
  const m = JSON.parse(String(ev.data));
  if (m.id && pending.has(m.id)) { pending.get(m.id)!(JSON.stringify(m.result)); pending.delete(m.id); }
};
const call = (method: string, params: any) =>
  new Promise<string>((r) => { const id = nextId++; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const evalJs = (expr: string) =>
  call("Runtime.evaluate", { expression: expr, returnByValue: true }).then((s) => {
    try { return JSON.parse(s).result?.value; } catch { return s; }
  });

for (const [x, y] of [[70, 832], [70, 104], [30, 400]]) {
  const el = await evalJs(
    `(() => { const e = document.elementFromPoint(${x},${y}); return e ? (e.tagName + "|" + String(e.className).slice(0,50) + "|" + (e.textContent||"").slice(0,30)) : null; })()`
  );
  console.log(`elementFromPoint(${x},${y}):`, el);
}

// real-click sanity: report window focus state.
console.log("hasFocus:", await evalJs(`document.hasFocus()`));
process.exit(0);
