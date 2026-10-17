import fs from "fs";
import path from "path";

const dir = path.resolve("packs");
const packs: Record<string, any> = {};

for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith(".manifest.json")) continue;
  const m = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
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
  };
}

const registry = {
  version: 1,
  updatedAt: new Date().toISOString(),
  packs,
};

const regPath = path.join(dir, "registry.json");
fs.writeFileSync(regPath, JSON.stringify(registry, null, 2));
console.log(`Updated packs/registry.json with ${Object.keys(packs).length} packs!`);

const localAppData = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "docx") : null;
if (localAppData && fs.existsSync(localAppData)) {
  fs.writeFileSync(path.join(localAppData, "registry.json"), JSON.stringify(registry, null, 2));
  console.log(`Updated LocalAppData/docx/registry.json with ${Object.keys(packs).length} packs!`);
}
