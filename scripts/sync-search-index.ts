import fs from "fs";
import path from "path";

const extraPath = path.resolve("docs-desktop/public/extra-search-index.json");
const current = JSON.parse(fs.readFileSync(extraPath, "utf8"));
const existingKeys = new Set(current.map((e: any) => `${e.site}:${e.path}`));

let added = 0;
for (const siteId of ["mdn_css", "mdn_html"]) {
  const sPath = path.resolve("packs", `${siteId}.search.json`);
  if (fs.existsSync(sPath)) {
    const entries = JSON.parse(fs.readFileSync(sPath, "utf8"));
    for (const item of entries) {
      const key = `${item.site || siteId}:${item.path}`;
      if (!existingKeys.has(key)) {
        existingKeys.add(key);
        current.push({
          title: item.title,
          category: item.category || (siteId === "mdn_css" ? "MDN CSS" : "MDN HTML"),
          path: item.path,
          site: siteId,
          headings: item.headings || [],
          preview: item.description || item.title,
        });
        added++;
      }
    }
  }
}

fs.writeFileSync(extraPath, JSON.stringify(current));
console.log(`Added ${added} entries to extra-search-index.json (now total ${current.length} entries)!`);

const distExtra = path.resolve("docs-desktop/dist/extra-search-index.json");
if (fs.existsSync(path.dirname(distExtra))) {
  fs.writeFileSync(distExtra, JSON.stringify(current));
  console.log("Updated docs-desktop/dist/extra-search-index.json as well!");
}
