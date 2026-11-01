/**
 * Builds docs on this machine, for sites that refuse GitHub's runners.
 *
 *   bun run docs:local                  every site marked `localBuild`
 *   bun run docs:local cppreference     only these sites (comma separated)
 *
 *   --no-publish    build only; packs stay in .local-packs/
 *   --pages <n>     stop a site after n pages (default 20000)
 *   --minutes <n>   stop a site after n minutes (default 360)
 *
 * Only the changed packs are uploaded, to the docpacks-v3 release. A short workflow run
 * then writes them into the library, so nothing here moves the whole library.
 * Needs `gh auth login`. A site that also blocks this network keeps its published copy.
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { parseArgs } from "util";
import { extractPacks, LIBRARY_URL, urlReader, readLibrary } from "./lib/library";

const LOCAL_PACKS_TAG = "docpacks-v3";
const WORKFLOW = "update-docs.yml";
const WORK_DIR = path.resolve(import.meta.dir, "../.local-packs");

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    "no-publish": { type: "boolean", default: false },
    pages: { type: "string", default: "20000" },
    minutes: { type: "string", default: "360" },
  },
});

// The crawler reads its limits once, when it is imported
process.env.DOCX_PAGE_CAP_FLOOR = values.pages;
process.env.DOCX_CRAWL_BUDGET_MINUTES = values.minutes;
const { SITE_CATALOG, buildDocpackForSite, closeBrowser } = await import("./ci-build-site");

function gh(...args: string[]) {
  const run = spawnSync("gh", args, { stdio: "inherit" });
  if (run.error) throw new Error(`gh is not available: ${run.error.message}`);
  if (run.status !== 0) throw new Error(`gh ${args[0]} ${args[1]} failed`);
}

const ids = positionals.length
  ? positionals.flatMap((arg) => arg.split(",")).map((id) => id.trim()).filter(Boolean)
  : SITE_CATALOG.filter((site) => site.localBuild).map((site) => site.id);

const unknown = ids.filter((id) => !SITE_CATALOG.some((site) => site.id === id));
if (unknown.length) throw new Error(`Unknown site ids: ${unknown.join(", ")}`);
if (ids.length === 0) throw new Error("No sites to build.");

const publish = !values["no-publish"];
if (publish) gh("auth", "status");

fs.rmSync(WORK_DIR, { recursive: true, force: true });
fs.mkdirSync(WORK_DIR, { recursive: true });

// The published pack is the base: its chunks are reused and it guards against a short crawl
await extractPacks(await readLibrary(urlReader(LIBRARY_URL)), urlReader(LIBRARY_URL), ids, WORK_DIR);

const built: string[] = [];
const unchanged: string[] = [];
const kept: string[] = [];
for (const id of ids) {
  const result = await buildDocpackForSite(id, WORK_DIR);
  ({ built, unchanged, kept })[result].push(id);
}
await closeBrowser();

console.log(`\nBuilt: ${built.join(", ") || "none"}`);
if (unchanged.length) console.log(`Unchanged: ${unchanged.join(", ")}`);
if (kept.length) console.warn(`Not updated, the crawl came back short or empty: ${kept.join(", ")}`);

if (built.length === 0) {
  console.log("Nothing to publish.");
} else if (!publish) {
  console.log(`Packs are in ${WORK_DIR}. Nothing was published.`);
} else {
  gh("release", "upload", LOCAL_PACKS_TAG, ...built.map((id) => path.join(WORK_DIR, `${id}.docpack`)), "--clobber");
  gh("workflow", "run", WORKFLOW, "--ref", "main", "-f", `sites=local:${built.join(",")}`);
  console.log(`Uploaded to ${LOCAL_PACKS_TAG}. The workflow is writing them into the library.`);
  console.log("Watch it with: gh run list --workflow update-docs.yml --limit 1");
}

process.exit(kept.length > 0 ? 1 : 0);
