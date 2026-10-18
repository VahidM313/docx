/** Read the app's debug title (cursor poll state). bun scripts/title.ts <port> */
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
console.log(
  await call("Runtime.evaluate", { expression: `document.title`, returnByValue: true }),
);
process.exit(0);
