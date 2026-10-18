/**
 * CDP hover test: moves the mouse to given coordinates, waits, screenshots.
 * Usage: bun scripts/cdp-hover.ts <port> <x,y> [waitMs=500] [outfile]
 */
import fs from "fs";
const port = process.argv[2] || "9223";
const pt = (process.argv[3] || "0,0").split(",").map(Number);
const wait = Number(process.argv[4] || 500);
const outfile = process.argv[5] || "_hover-shot.png";

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

await call("Runtime.enable", {});
await call("Input.dispatchMouseEvent", {
  type: "mouseMoved",
  x: pt[0],
  y: pt[1],
  button: "none",
  pointerType: "mouse",
});
await new Promise((r) => setTimeout(r, wait));
const shot = await call("Page.captureScreenshot", { format: "png" });
try {
  const data = JSON.parse(shot).data ?? JSON.parse(shot.replace(/^"|"$/g, "{}")).data;
  fs.writeFileSync(outfile, Buffer.from(data, "base64"));
  console.log(`hover@(${pt[0]},${pt[1]}) -> ${outfile}`);
} catch {
  console.log("screenshot failed");
}
process.exit(0);
