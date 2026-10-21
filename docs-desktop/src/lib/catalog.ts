// Site catalog helpers over the generated sites.json (single source of truth).
import catalog from "../../sites.json";

export type SiteCategory = string;

export interface SiteBrand {
  id: string;
  order: number;
  name: string;
  version: string;
  category: string;
  color: string;
  bgTint: string;
  description: string;
  svg: string;
  origin?: string;
  entryPath: string;
  embedded?: boolean;
  defaultRoutes?: { label: string; path: string }[];
}

export const SITE_CATEGORIES = catalog.categories as string[];

export const SITES = (catalog.sites as unknown as SiteBrand[]).sort(
  (a, b) =>
    (catalog.categories as string[]).indexOf(a.category) -
      (catalog.categories as string[]).indexOf(b.category) || a.order - b.order,
);

export const SITE_MAP: Record<string, SiteBrand> = Object.fromEntries(SITES.map((s) => [s.id, s]));

/** Embedded packs (built from local source workspaces, not crawled). */
export const EMBEDDED_SITE_IDS = ["tailwind", "shadcn"];

const LETTER_TILE_SVG = (letter: string, color: string) =>
  `<svg viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="7" fill="${color}"/><text x="12" y="17" font-family="Segoe UI, sans-serif" font-size="12.5" font-weight="700" fill="#fff" text-anchor="middle">${letter.toUpperCase()}</text></svg>`;

/** Release CDN base for registry-linked assets (icons, packs). */
export const RELEASE_BASE_URL = "https://github.com/VahidM313/docx/releases/download/packs-latest";

/**
 * Full icon chain (hybrid favicon strategy):
 *   curated catalog SVG  →  build-time captured PNG (release CDN), if any  →  letter tile.
 */
export const SITE_ICON_URL = (siteId: string, remoteIconFile?: string, remoteIconEtag?: string) =>
  remoteIconFile ? `${RELEASE_BASE_URL}/${remoteIconFile}${remoteIconEtag ? `?v=${remoteIconEtag}` : ""}` : null;

let iconFailures = new Set<string>();

/** Fallback-aware icon: PNG from CDN, catalog SVG, letter tile — all inside one <span>. */
export function getSiteIconHtml(siteId: string, remoteIconFile?: string, remoteIconEtag?: string): string {
  const png = SITE_ICON_URL(siteId, remoteIconFile, remoteIconEtag);
  const s = SITE_MAP[siteId];
  const svg = s?.svg ?? LETTER_TILE_SVG((s?.name ?? siteId).charAt(0), s?.color ?? "#6366f1");
  if (!png || iconFailures.has(siteId)) return svg;
  return `<img src="${png}" loading="lazy" onerror="this.remove()" style="width:100%;height:100%;object-fit:contain" alt="${siteId}">`;
}

export function getBrand(siteId: string): SiteBrand {
  return (
    SITE_MAP[siteId] ?? {
      id: siteId,
      order: 9999,
      name: siteId,
      version: "latest",
      category: "Backend, Auth & APIs",
      color: "#6366f1",
      bgTint: "rgba(99, 102, 241, 0.14)",
      description: `Offline documentation pack for ${siteId}.`,
      svg: LETTER_TILE_SVG(siteId.charAt(0), "#6366f1"),
      entryPath: "/",
    }
  );
}

export function getEntryPath(siteId: string): string {
  const b = getBrand(siteId);
  return b.defaultRoutes?.[0]?.path || b.entryPath || "/";
}

export function getSiteOrigin(siteId: string): string {
  return getBrand(siteId).origin ?? "";
}

export function countByCategory(sites: { brand: SiteBrand }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of sites) counts[s.brand.category] = (counts[s.brand.category] ?? 0) + 1;
  return counts;
}

/** Resolves the adaptive brand color for light and dark themes */
export function getAdaptiveBrandColor(color: string, isDark: boolean): string {
  const c = (color || "").trim().toLowerCase();
  if (c === "#ffffff" || c === "#fff" || c === "white") {
    return isDark ? "#ffffff" : "#09090b";
  }
  if (c === "#000000" || c === "#000" || c === "black" || c === "#09090b") {
    return isDark ? "#ffffff" : "#09090b";
  }
  if (!isDark && (c === "#fef08a" || c === "#facc15" || c === "#fde047")) {
    return "#ca8a04";
  }
  return color || (isDark ? "#ffffff" : "#09090b");
}

/** Returns the SVG markup adapted with correct theme colors and contrast */
export function getAdaptiveSiteSvg(brand: SiteBrand, isDark: boolean): string {
  let svg = brand?.svg || "";
  const color = getAdaptiveBrandColor(brand?.color, isDark);
  if (!isDark) {
    svg = svg.replace(/fill="#fff(fff)?"/gi, `fill="${color}"`);
    svg = svg.replace(/stroke="#fff(fff)?"/gi, `stroke="${color}"`);
  } else {
    svg = svg.replace(/fill="#000(000)?"/gi, `fill="${color}"`);
    svg = svg.replace(/stroke="#000(000)?"/gi, `stroke="${color}"`);
  }
  return svg;
}
