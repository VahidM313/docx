/**
 * One-shot CDP click: opens the first hub card (or clicks the first "Open"
 * button), waits, screenshots + geometry. Usage: bun scripts/cdp-click.ts [port]
 */
import fs from "fs";
const port = process.argv[2] || "9223";

const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = targets.find((t: any) => t.type === "page" && !/devtools/i.test(t.url));
if (!page) throw new Error("no page target");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise<void>((res) => (ws.onopen = () => res()));

let nextId = 1;
const pending = new Map<number, (v: string) => void>();
const logs: string[] = [];
ws.onmessage = (ev) => {
  const msg: any = JSON.parse(String(ev.data));
  if (msg.method === "Runtime.consoleAPICalled")
    logs.push(`[console.${msg.params.type}] ` + msg.params.args.map((a: any) => a.value ?? a.description).join(" "));
  else if (msg.method === "Runtime.exceptionThrown")
    logs.push(`[EXCEPTION] ${msg.params.exceptionDetails?.text}`);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)!(JSON.stringify(msg.result?.result?.value ?? msg.result));
    pending.delete(msg.id);
  }
};
const call = (method: string, params: any) =>
  new Promise<string>((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });

await call("Runtime.enable", {});
const clicked = await call("Runtime.evaluate", {
  expression: `(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Open');
    if (!btn) return 'no-open-button';
    btn.click();
    return 'clicked';
  })()`,
  returnByValue: true,
});
console.log("click:", JSON.parse(clicked));
await new Promise((r) => setTimeout(r, 2500));

const state = await call("Runtime.evaluate", {
  expression: `JSON.stringify((() => {
    const f = document.querySelector('#reader-panels-root iframe');
    const r = f ? f.getBoundingClientRect() : null;
    return { ifrBox: r ? [Math.round(r.top), Math.round(r.left), Math.round(r.width), Math.round(r.height)] : null };
  })())`,
  returnByValue: true,
});
console.log("state:", JSON.parse(state));

const shot = await call("Page.captureScreenshot", { format: "png" });
try {
  const data = JSON.parse(shot).data ?? JSON.parse(shot.replace(/^"|"$/g, "{}")).data;
  fs.writeFileSync("_click-shot.png", Buffer.from(data, "base64"));
  console.log("[screenshot] saved _click-shot.png");
} catch {
  console.log("[screenshot] failed:", String(shot).slice(0, 80));
}
console.log(logs.slice(0, 15).join("\n") || "(no console output)");
ws.close();
process.exit(0);
