import fs from "fs";
const port = "9223";
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
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

// move renderer cursor onto the Bookmarks row of the open sidebar panel, then press/release
await call("Input.dispatchMouseEvent", { type: "mouseMoved", x: 29, y: 97, button: "none", pointerType: "mouse" });
await new Promise((r) => setTimeout(r, 300));
await call("Input.dispatchMouseEvent", { type: "mousePressed", x: 29, y: 97, button: "left", clickCount: 1, pointerType: "mouse" });
await new Promise((r) => setTimeout(r, 120));
await call("Input.dispatchMouseEvent", { type: "mouseReleased", x: 29, y: 97, button: "left", clickCount: 1, pointerType: "mouse" });
await new Promise((r) => setTimeout(r, 900));
const shot = await call("Page.captureScreenshot", { format: "png" });
fs.writeFileSync("_cdp-click-bookmarks.png", Buffer.from(JSON.parse(shot).data, "base64"));
const cnt = await call("Runtime.evaluate", { expression: "document.querySelectorAll('[role=dialog]').length", returnByValue: true });
console.log("eval raw:", cnt);
process.exit(0);
