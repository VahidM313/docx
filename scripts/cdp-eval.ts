/** CDP eval helper: bun scripts/cdp-eval.ts <port> <expression> | --file <path> [arg] */
import fs from "fs";
const port = process.argv[2] || "9223";
let expr = process.argv[3] || "1+1";
if (expr === "--file") expr = fs.readFileSync(process.argv[4], "utf8").trim();
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
const id = nextId++;
const out = await new Promise<string>((r) => {
  pending.set(id, r);
  ws.onopen?.();
  ws.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression: expr, returnByValue: true } }));
});
console.log(out);
process.exit(0);
