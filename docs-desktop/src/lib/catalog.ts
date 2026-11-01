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
  hasBuiltinPersian?: boolean;
  defaultRoutes?: { label: string; path: string }[];
}

export const SITE_CATEGORIES = catalog.categories as string[];

export const CAT_LABEL: Record<string, string> = {
  "Frontend & UI": "Frontend",
  "React Ecosystem": "React",
  "Vue Ecosystem": "Vue",
  "Web Frameworks & Tools": "Frameworks",
  "TanStack Suite": "TanStack",
  "Backend, Auth & APIs": "Backend",
  "Databases & SQL": "Databases",
  "AI & Machine Learning": "AI/ML",
  "Python Ecosystem": "Python",
  "Rust Ecosystem": "Rust",
  "Go (Golang)": "Go",
  "C & C++ Ecosystem": "C/C++",
  "Languages & Compilers": "Languages",
  "Graphics & Game APIs": "Graphics",
  "GUI": "GUI",
  "DevOps & Cloud": "DevOps",
  "Architecture & Design": "Design",
};

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

/** Sites with no captured icon in `public/icons`. */
const SITES_WITHOUT_PNG = new Set(["cobra", "matplotlib", "ninja", "odin"]);

/**
 * Icon chain: PNG captured by `scripts/capture-icons.ts` and shipped with the app,
 * then the curated catalog SVG, then a letter tile. The catalog is compiled in too,
 * so a new site brings its icon in the same app update, and icons work offline.
 */
export function getSiteIconHtml(siteId: string): string {
  const s = SITE_MAP[siteId];
  if (s && !SITES_WITHOUT_PNG.has(siteId)) {
    return `<img src="/icons/${siteId}.png" loading="lazy" style="width:100%;height:100%;object-fit:contain" alt="${siteId}">`;
  }
  return s?.svg ?? LETTER_TILE_SVG((s?.name ?? siteId).charAt(0), s?.color ?? "#6366f1");
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
