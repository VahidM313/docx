// Universal search over the static index + per-pack extra entries.
import { SITE_MAP, getBrand } from "./catalog";
import { Tauri } from "./tauri";

export interface SearchEntry {
  id?: string;
  site: string;
  siteName?: string;
  title: string;
  category?: string;
  description?: string;
  preview?: string;
  path: string;
  keywords?: string[];
  headings?: string[];
}

let baseIndex: SearchEntry[] = [];
const extraBySite: Record<string, boolean> = {};
let loaded = false;

const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function tokenize(q: string): string[] {
  return q.toLowerCase().split(/\s+/).filter(Boolean);
}

function scoreEntry(entry: SearchEntry, tokens: string[], filterSite?: string): number {
  if (filterSite && entry.site !== filterSite) return 0;
  const title = entry.title.toLowerCase();
  const desc = (entry.preview ?? entry.description ?? "").toLowerCase();
  const site = entry.site.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (title.startsWith(t)) score += 26;
    else if (title.includes(t)) score += 16;
    if (entry.keywords?.some((k) => k.toLowerCase().includes(t))) score += 5;
    if (entry.headings?.some((h) => h.toLowerCase().includes(t))) score += 4;
    if (desc.includes(t)) score += 3;
    if (site.includes(t)) score += 2;
  }
  return score;
}

export async function loadSearchIndex(onProgress?: (n: number) => void) {
  try {
    const res = await fetch("/search-index.json");
    if (res.ok) {
      const data = await res.json();
      const entries: SearchEntry[] = Array.isArray(data) ? data : (data.entries ?? []);
      baseIndex = entries.filter((e) => e && e.site && e.title !== undefined && e.path);
    }
  } catch {}
  onProgress?.(baseIndex.length);
}

export async function ensureExtraEntries(siteId: string) {
  if (!SITE_MAP[siteId] || extraBySite[siteId]) return;
  extraBySite[siteId] = true;
  try {
    const extra = await Tauri.getExtraSearchEntries(siteId);
    for (const e of extra) {
      baseIndex.push({
        site: siteId,
        siteName: getBrand(siteId).name,
        title: e.title,
        path: e.path,
        preview: e.preview,
        category: e.category ?? "Reference",
      });
    }
  } catch {}
}

/** Preload per-pack entries for every installed pack (background, deferred so
 *  it never floods the IPC queue or stalls the boot path). */
export async function preloadInstalledSites(packs: { id: string }[]) {
  await new Promise((r) => window.setTimeout(r, 2800));
  const BATCH = 6;
  for (let i = 0; i < packs.length; i += BATCH) {
    await Promise.allSettled(packs.slice(i, i + BATCH).map((p) => ensureExtraEntries(p.id)));
    await new Promise((r) => window.setTimeout(r, 150));
  }
}

export function indexedCount(): number {
  return baseIndex.length;
}

export function search(query: string, filterSite?: string, limit = 120): { entry: SearchEntry; score: number }[] {
  const tokens = tokenize(query);
  if (!tokens.length) return [];
  const seen = new Map<string, { entry: SearchEntry; score: number }>();
  const key = (e: SearchEntry) => `${e.site}|${e.path}`;
  for (const entry of baseIndex) {
    const score = scoreEntry(entry, tokens, filterSite);
    if (score <= 0) continue;
    const k = key(entry);
    const prev = seen.get(k);
    if (!prev || prev.score < score) seen.set(k, { entry, score });
  }
  return [...seen.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function highlight(text: string, query: string): string {
  const tokens = tokenize(query).slice(0, 4);
  if (!tokens.length) return escapeHtml(text);
  const rx = new RegExp(`(${tokens.map(escapeRegex).join("|")})`, "gi");
  return escapeHtml(text).replace(rx, "<mark class='hlq'>$1</mark>");
}

export function escapeHtml(str: string): string {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
