import fs from "fs";

const p = "docs-desktop/src-tauri/tauri.conf.json";
const json = JSON.parse(fs.readFileSync(p, "utf-8"));
json.app.windows[0].dragDropEnabled = false;
fs.writeFileSync(p, JSON.stringify(json, null, 2) + "\n", "utf-8");
console.log("Updated tauri.conf.json with dragDropEnabled: false");
