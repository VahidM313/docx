// Site catalog adapter — thin re-derivation over the generated `sites.json`.
//
// `docs-desktop/sites.json` is generated from the atomic per-site sources in
// `docs-desktop/sites.d/*.json` by `scripts/gen-catalog.ts`. Edit those files,
// not the JSON, and never this file's data.
//
// The exported shape (SiteBrand / SITE_BRANDS / getSiteBrand) is kept
// compatible with the pre-catalog brands module so the rest of the app
// continues to compile unchanged.

import catalog from "../sites.json";

export type SiteCategory =
  | "Frontend & UI"
  | "React Ecosystem"
  | "Vue Ecosystem"
  | "Web Frameworks & Tools"
  | "TanStack Suite"
  | "Backend, Auth & APIs"
  | "Databases & SQL"
  | "AI & Machine Learning"
  | "Python Ecosystem"
  | "Rust Ecosystem"
  | "Go (Golang)"
  | "C & C++ Ecosystem"
  | "DevOps & Cloud"
  | "Architecture & Design"
  | (string & {});

/** Fixated display order for hub grouping; mirrors sites.d/_catalog.json. */
export const SITE_CATEGORIES = catalog.categories as SiteCategory[];

export interface SiteBrand {
  id: string;
  name: string;
  version: string;
  category: SiteCategory;
  color: string;
  bgTint: string;
  description: string;
  svg: string;
  defaultRoutes?: { label: string; path: string }[];
}

interface CatalogSiteEntry {
  id: string;
  name: string;
  version: string;
  category: string;
  color: string;
  bgTint: string;
  description: string;
  svg: string;
  defaultRoutes?: { label: string; path: string }[];
  [k: string]: unknown;
}

function toBrand(s: CatalogSiteEntry): SiteBrand {
  return {
    id: s.id,
    name: s.name,
    version: s.version,
    category: s.category,
    color: s.color,
    bgTint: s.bgTint,
    description: s.description,
    svg: s.svg,
    defaultRoutes: s.defaultRoutes,
  };
}

export const SITE_BRANDS: Record<string, SiteBrand> = Object.fromEntries(
  (catalog.sites as CatalogSiteEntry[]).map((s) => [s.id, toBrand(s)]),
);

const UNKNOWN_FALLBACK_CATEGORY: SiteCategory = "Backend, Auth & APIs";

export function getSiteBrand(
  siteId: string,
  fallbackName?: string,
  fallbackVer?: string
): SiteBrand {
  const known = SITE_BRANDS[siteId];
  if (known) return known;
  return {
    id: siteId,
    name: fallbackName || siteId,
    version: fallbackVer || "latest",
    category: UNKNOWN_FALLBACK_CATEGORY,
    color: "#38bdf8",
    bgTint: "rgba(56, 189, 248, 0.14)",
    description: `Offline documentation pack for ${fallbackName || siteId}.`,
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20V22H6.5A2.5 2.5 0 0 1 4 19.5V4.5A2.5 2.5 0 0 1 6.5 2Z"/></svg>`,
  };
}
