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
const extraKeys = new Set<string>();
let basePromise: Promise<void> | null = null;

const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function tokenize(q: string): string[] {
  return q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
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

/** Load the small built-in index once, on demand (never during boot). */
export function ensureBaseIndex(): Promise<void> {
  if (basePromise) return basePromise;
  basePromise = (async () => {
    try {
      const res = await fetch("/search-index.json");
      if (res.ok) {
        const data = await res.json();
        const entries: SearchEntry[] = Array.isArray(data) ? data : (data.entries ?? []);
        baseIndex = entries.filter((e) => e && e.site && e.title !== undefined && e.path);
        for (const e of baseIndex) extraKeys.add(`${e.site}|${e.path}`);
      }
    } catch {
      /* offline search degrades to the deep per-site indexes */
    }
  })();
  return basePromise;
}

/** Back-compat alias. */
export const loadSearchIndex = ensureBaseIndex;

/**
 * Merge one pack's deep search entries.
 *
 * Important: the Rust command is site-scoped. Previously it returned every
 * installed pack and the caller appended that full payload once per site,
 * multiplying the index by the number of installed packs.
 */
export async function ensureExtraEntries(siteId: string) {
  if (!SITE_MAP[siteId] || extraBySite[siteId]) return;
  extraBySite[siteId] = true;
  try {
    const extra = await Tauri.getExtraSearchEntries(siteId);
    const brand = getBrand(siteId);
    let added = 0;
    for (const e of extra) {
      if (!e || !e.path) continue;
      const key = `${siteId}|${e.path}`;
      if (extraKeys.has(key)) continue;
      extraKeys.add(key);
      baseIndex.push({
        site: siteId,
        siteName: brand.name,
        title: e.title,
        path: e.path,
        preview: e.preview,
        category: e.category ?? "Reference",
      });
      added += 1;
      if (added >= 12000) break; // hard cap per pack — keeps search memory bounded
    }
  } catch {
    extraBySite[siteId] = false;
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
