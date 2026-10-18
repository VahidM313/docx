//! Site catalog: origin + default entry path per site id.
//!
//! Backed by the generated `sites.json` (compile-time embedded via
//! `include_str!`), which is produced by `scripts/gen-catalog.ts` from the
//! atomic per-site sources in `sites.d/<id>.json`. This keeps the Rust server,
//! the frontend, and the CI pack builder on one shared catalog.

use std::collections::HashMap;
use std::sync::OnceLock;

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct CatalogSite {
    id: String,
    origin: Option<String>,
    entry_path: String,
}

#[derive(serde::Deserialize)]
struct CatalogFile {
    sites: Vec<CatalogSite>,
}

static CATALOG: OnceLock<HashMap<String, (String, String)>> = OnceLock::new();

/// Legacy pack ids still found inside old manifests / URL prefixes map onto
/// canonical catalog ids.
fn canonical_id(site_id: &str) -> &str {
    match site_id {
        "tw" => "tailwind",
        "sh" => "shadcn",
        "js" => "mdn_js",
        "css" => "mdn_css",
        "html" => "mdn_html",
        "wasm" => "mdn_wasm",
        other => other,
    }
}

fn catalog() -> &'static HashMap<String, (String, String)> {
    CATALOG.get_or_init(|| {
        const RAW: &str = include_str!("../../sites.json");
        let parsed: CatalogFile = match serde_json::from_str(RAW) {
            Ok(v) => v,
            Err(e) => {
                log::error!("sites.json unparsable — origin resolution disabled: {}", e);
                return HashMap::new();
            }
        };
        parsed
            .sites
            .into_iter()
            .filter_map(|s| {
                s.origin
                    .map(|o| (s.id, (o, s.entry_path)))
            })
            .collect()
    })
}

/// Resolve `(origin, entry_path)` for a site, falling back through the legacy
/// short pack ids (`tw`, `sh`, `js`, `css`, `html`, `wasm`).
pub(crate) fn get_site_origin_and_entry(site_id: &str) -> Option<(&'static str, &'static str)> {
    // The map is built once at first use and lives for the process lifetime,
    // so returning borrows of its values as `&'static str` is sound.
    let map = catalog();
    map.get(site_id)
        .or_else(|| map.get(canonical_id(site_id)))
        .map(|(origin, entry)| (origin.as_str(), entry.as_str()))
}
