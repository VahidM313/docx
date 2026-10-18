import fs from "fs";
import path from "path";
import crypto from "crypto";

const dir = path.resolve("packs");
const iconsDir = path.resolve("docs-desktop", "catalog", "icons");
const localAppData = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "docx") : null;
const packs: Record<string, any> = {};

const scanDirs = [dir];
if (localAppData && fs.existsSync(localAppData)) scanDirs.push(localAppData);

/** Short content hash of the captured icon so clients know when to re-fetch it. */
function iconMeta(id: string): { iconFile?: string; iconETag?: string } {
  const png = path.join(iconsDir, `${id}.icon.png`);
  if (!fs.existsSync(png)) return {};
  const hash = crypto
    .createHash("sha256")
    .update(fs.readFileSync(png))
    .digest("hex")
    .slice(0, 16);
  return { iconFile: `${id}.icon.png`, iconETag: hash };
}

for (const d of scanDirs) {
  for (const f of fs.readdirSync(d)) {
    if (!f.endsWith(".manifest.json")) continue;
    if (f.startsWith("system_design")) continue;
    const m = JSON.parse(fs.readFileSync(path.join(d, f), "utf8"));
    if (!m.commit || m.commit === "e3b0c442" || !m.totalBytes) continue;
    packs[m.id] = {
      id: m.id,
      name: m.name,
      version: m.version,
      commit: m.commit,
      updatedAt: m.updatedAt,
      sizeMB: Number((m.totalBytes / (1024 * 1024)).toFixed(2)),
      totalBytes: m.totalBytes,
      chunkCount: m.chunkCount,
      routeCount: Object.keys(m.routes || {}).length,
      manifestFile: `${m.id}.manifest.json`,
      packFile: `${m.id}.docpack`,
      searchFile: `${m.id}.search.json`,
      ...iconMeta(m.id),
    };
  }
}

const registry = {
  version: 2,
  updatedAt: new Date().toISOString(),
  packs,
};

const regPath = path.join(dir, "registry.json");
fs.writeFileSync(regPath, JSON.stringify(registry, null, 2));
console.log(`Updated packs/registry.json with ${Object.keys(packs).length} packs!`);

if (localAppData && fs.existsSync(localAppData)) {
  fs.writeFileSync(path.join(localAppData, "registry.json"), JSON.stringify(registry, null, 2));
  console.log(`Updated LocalAppData/docx/registry.json with ${Object.keys(packs).length} packs!`);
}
