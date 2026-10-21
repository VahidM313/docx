/** CDP helper: close open dialogs/drawers/palette via Escape + close buttons. */
const port = process.argv[2] || "9223";
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = targets.find((t: any) => t.type === "page" && !/devtools/i.test(t.url));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise<void>((res) => (ws.onopen = () => res()));
let nextId = 1;
const pending = new Map<number, (v: string) => void>();
ws.onmessage = (ev) => {
  const m = JSON.parse(String(ev.data));
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)!(JSON.stringify(m.result));
    pending.delete(m.id);
  }
};
const call = (method: string, params: any) =>
  new Promise<string>((r) => {
    const id = nextId++;
    pending.set(id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });
const evalJs = (expr: string) => call("Runtime.evaluate", { expression: expr, returnByValue: true });

await evalJs(
  `document.querySelectorAll('[role="dialog"] button').forEach(b => { if (b.querySelector('.lucide-x, svg.lucide-x')) b.click(); });` +
    `for (let i = 0; i < 3; i++) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));` +
    `document.activeElement && document.activeElement.blur && document.activeElement.blur();`
);
await new Promise((r) => setTimeout(r, 400));
const state = await evalJs(
  `JSON.stringify({ dialogs: document.querySelectorAll('[role="dialog"]').length, palette: !!document.querySelector('[cmdk-root]'), open: document.body.className.includes('overflow-hidden') })`
);
console.log("close-dialogs:", JSON.parse(JSON.parse(state).result?.value ?? state).dialogs, "dialogs remain");
process.exit(0);
