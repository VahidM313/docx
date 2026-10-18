/**
 * One-shot CDP probe: evaluates a small status script and takes a screenshot
 * of the Docx window over WebView2 remote debugging.
 *
 * Usage: bun scripts/cdp-probe.ts [port=9223]
 */
import fs from "fs";
const port = process.argv[2] || "9223";

const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = targets.find((t: any) => t.type === "page" && !/devtools/i.test(t.url));
if (!page) throw new Error("no page target: " + JSON.stringify(targets.map((t: any) => [t.type, t.url])));
console.log("attached:", page.url);

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise<void>((res) => (ws.onopen = () => res()));

let nextId = 1;
const pending = new Map<number, (v: string) => void>();
const logs: string[] = [];

ws.onmessage = (ev) => {
  const msg: any = JSON.parse(String(ev.data));
  if (msg.method === "Runtime.consoleAPICalled") {
    logs.push(`[console.${msg.params.type}] ` + msg.params.args.map((a: any) => a.value ?? a.description).join(" "));
  } else if (msg.method === "Runtime.exceptionThrown") {
    const d = msg.params.exceptionDetails;
    logs.push(`[EXCEPTION] ${(d.exception?.description ?? d.text).slice(0, 500)}`);
  }
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
const state = await call("Runtime.evaluate", {
  expression: `JSON.stringify({
    ready: document.readyState,
    rootChildren: (document.getElementById('app-root') ?? {children:[]}).children.length,
    bodyText: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 220)
  })`,
  returnByValue: true,
});
console.log("[page]", state);

const shot = await call("Page.captureScreenshot", { format: "png" });
try {
  const data = JSON.parse(shot).data ?? JSON.parse(shot.replace(/^"|"$/g, "{}")).data;
  fs.writeFileSync("_probe-shot.png", Buffer.from(data, "base64"));
  console.log("[screenshot] saved _probe-shot.png");
} catch {
  console.log("[screenshot] failed:", String(shot).slice(0, 80));
}

await new Promise((r) => setTimeout(r, 4000));
console.log(logs.slice(0, 40).join("\n") || "(no console output)");
process.exit(0);
