/**
 * Strips markup that is dead weight in an offline copy and that changes on every
 * deploy of the source site.
 *
 * Measured on real crawls, almost all "changed" pages differed only in these
 * parts: build ids, RSC payloads, analytics snippets, ad cookies, preload hints.
 * Removing them shrinks packs and stops every redeploy from looking like a full
 * content update.
 *
 * The crawler already removes external <script src> tags from static sites, so
 * hydration payloads have no reader left. SPA sites keep their scripts and need
 * `keepScripts`, otherwise their bundles would lose the data they boot from.
 */

// Matches analytics APIs and hosts rather than bare product names: "amplitude" is
// also an ordinary variable in a graphics demo.
const NOISE_SCRIPT =
  /googletagmanager|google-analytics|gtag\(|dataLayer|ezstandalone|ezoic|__ez|\bapbct|ctPublic|hotjar|clarity\.ms|plausible(?:\.io|\()|usefathom|fathom\.track|mixpanel\.(?:init|track)|cdn\.amplitude|amplitude\.(?:init|track|getInstance)|OneTrust|cookielaw|_gaq|cloudflareinsights|__cfBeacon|wpdiscuzAjaxObj|GoogleDevelopersObject/;

const HYDRATION_SCRIPT = /__next_f|__NEXT_DATA__|TURBOPACK|__NUXT|__remixContext|__sveltekit/;

export interface NormalizeOptions {
  keepScripts?: boolean;
}

export function normalizeHtml(html: string, opts: NormalizeOptions = {}): string {
  const keepScripts = opts.keepScripts ?? false;

  html = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, (tag, attrs: string, body: string) => {
    if (NOISE_SCRIPT.test(attrs) || NOISE_SCRIPT.test(body)) return "";
    if (keepScripts) return tag;
    if (/\btype=["']?application\/(?:ld\+)?json/i.test(attrs)) return "";
    if (HYDRATION_SCRIPT.test(attrs) || HYDRATION_SCRIPT.test(body)) return "";
    return tag;
  });

  if (!keepScripts) {
    // These hints point at files that were never packed, so each one would only
    // trigger a failed lookup and a pointless network attempt in the reader.
    html = html.replace(/<link\b[^>]*\brel=["']?(?:preload|prefetch|modulepreload|dns-prefetch|preconnect)\b[^>]*>/gi, "");
  }

  html = html.replace(
    /<meta\b[^>]*(?:property=["']?(?:og:|article:)|name=["']?(?:twitter:|csrf|generator|next-size-adjust))[^>]*>/gi,
    "",
  );
  html = html.replace(/\sdata-dpl-id=["'][^"']*["']/g, "");
  html = html.replace(/<input\b[^>]*name=["']?\$ACTION_[^>]*>/g, "");

  html = html.replace(/<!--(?!\[if)[\s\S]*?-->/g, "");
  html = html.replace(/\snonce=["'][^"']*["']/gi, "");

  // Random per-render ids (MDN's aria labels). Numbered per page so that id and
  // aria-labelledby still point at each other.
  const labels = new Map<string, string>();
  html = html.replace(/\blabel-[a-z0-9]{8,}\b/g, (id) => {
    if (!/\d/.test(id)) return id;
    if (!labels.has(id)) labels.set(id, `label-${labels.size}`);
    return labels.get(id)!;
  });

  // Whitespace between tags is significant inside <pre>: it is the indentation of
  // highlighted code, where every token is its own <span>.
  html = html.replace(/(<pre\b[\s\S]*?<\/pre\s*>)|>\s{2,}(?=<)/gi, (_, pre?: string) => pre ?? "> ");
  return html;
}

/**
 * Removes content fingerprints from an asset URL so that a rebuilt stylesheet
 * keeps one identity across deploys.
 */
export function stableAssetKey(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const path = parsed.pathname
    // dpl_abc123 / build-id style directories
    .replace(/\/(?:dpl_[A-Za-z0-9]+|[A-Za-z0-9_-]{21})(?=\/)/g, "/#")
    // style.d2cd954c.css, app-3f9a1c2b.js, chunk_0123abcd.mjs
    .replace(/[._-][0-9a-fA-F]{8,}(?=[./])/g, "")
    // filename that is nothing but a fingerprint: /chunks/0g--gmzi5p1a2b3.css
    .replace(/\/[A-Za-z0-9_-]{12,}(\.[a-z0-9]+)$/i, (whole, ext: string) =>
      /[0-9]/.test(whole) && /[a-zA-Z]/.test(whole) ? `/#${ext}` : whole,
    );

  const params = [...parsed.searchParams.entries()]
    .filter(([k]) => !/^(?:v|ver|version|hash|t|ts|rev|cb)$/i.test(k))
    .sort(([a], [b]) => a.localeCompare(b));
  const search = params.length ? `?${new URLSearchParams(params).toString()}` : "";
  return `${parsed.origin}${path}${search}`;
}

/** True when a same-origin asset path embeds a content fingerprint. */
export function looksFingerprinted(pathname: string): boolean {
  return stableAssetKey(`https://x.invalid${pathname}`) !== `https://x.invalid${pathname}`;
}
