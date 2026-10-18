/** Reset pins to all-false and reload. bun scripts/cdp-reset-pins.ts <port> */
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
    pending.get(m.id)!(JSON.stringify(m.result?.result?.value ?? m.result));
    pending.delete(m.id);
  }
};
const call = (method: string, params: any) =>
  new Promise<string>((r) => {
    const id = nextId++;
    pending.set(id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });
await call("Runtime.enable", {});
let r = await call("Runtime.evaluate", {
  expression: `localStorage.setItem('docx_ui_pins_v1', JSON.stringify({topbar:false, sidebar:false, tabs:false})); "ok"`,
  returnByValue: true,
});
console.log("pins:", r);
await call("Page.enable", {});
await call("Page.reload", {});
await new Promise((res) => setTimeout(res, 2500));
process.exit(0);
