//! Reader bridge injection: normalizes fetched documentation HTML and injects the DOCX
//! reader JavaScript bridge (theming, tab actions, keyboard shortcuts, search forwarding).
//! The bridge template itself is a vendored asset kept in `bridge/reader-bridge.html`
//! so it gets syntax-aware review instead of living inside a Rust string literal.

use crate::catalog::get_site_origin_and_entry;

static READER_BRIDGE_TEMPLATE: &str = include_str!("bridge/reader-bridge.html");

fn strip_html_attribute(html: &mut String, attr_name: &str) {
    let mut search_from = 0;
    while let Some(pos) = html[search_from..].find(attr_name) {
        let abs_pos = search_from + pos;
        if abs_pos > 0 {
            let prev = html.as_bytes()[abs_pos - 1];
            if prev != b' ' && prev != b'\t' && prev != b'\n' {
                search_from = abs_pos + attr_name.len();
                continue;
            }
        }
        let after_attr = abs_pos + attr_name.len();
        if after_attr < html.len() && html.as_bytes()[after_attr] == b'=' {
            let val_start = after_attr + 1;
            if val_start < html.len() {
                let quote = html.as_bytes()[val_start];
                if quote == b'"' || quote == b'\'' {
                    if let Some(end_quote) = html[val_start + 1..].find(quote as char) {
                        let abs_end = val_start + 1 + end_quote + 1;
                        html.replace_range(abs_pos..abs_end, "");
                        search_from = abs_pos;
                        continue;
                    }
                } else {
                    let mut end = val_start;
                    while end < html.len() {
                        let b = html.as_bytes()[end];
                        if b == b' ' || b == b'>' || b == b'\t' || b == b'\n' {
                            break;
                        }
                        end += 1;
                    }
                    html.replace_range(abs_pos..end, "");
                    search_from = abs_pos;
                    continue;
                }
            }
        }
        search_from = abs_pos + attr_name.len();
    }
}

pub(crate) fn inject_reader_bridge(site_key: &str, mut html: String) -> Vec<u8> {
    if html.contains("id=\"docx-reader-bridge\"") {
        return html.into_bytes();
    }
    let site_id = match site_key {
        "tw" => "tailwind",
        "sh" => "shadcn",
        "css" => "mdn_css",
        "html" => "mdn_html",
        "js" => "mdn_js",
        "wasm" => "mdn_wasm",
        other => other,
    };
    let origin = get_site_origin_and_entry(site_id)
        .map(|(o, _)| o)
        .unwrap_or("")
        .to_string();

    if !origin.is_empty() {
        html = html.replace(&format!("href=\"{}/", origin), "href=\"/");
        html = html.replace(&format!("src=\"{}/", origin), "src=\"/");
    }

    // Strip SRI integrity and crossorigin hashes to prevent browsers blocking rewritten local stylesheets (Git, Cobra)
    strip_html_attribute(&mut html, "integrity");
    strip_html_attribute(&mut html, "crossorigin");

    // Neutralize blocking external analytics/hydration/preload tags so pages render in <10ms, while preserving SPAs (Three.js, Nest, Angular, Lucide)
    if site_id != "threejs" && site_id != "nestjs" && site_id != "angular" && site_id != "lucide" {
        html = html
            .replace("rel=\"modulepreload\"", "rel=\"docx-disabled\"")
            .replace("rel='modulepreload'", "rel='docx-disabled'");
    }
    html = html
        .replace("https://www.googletagmanager.com/gtm.js", "data:text/javascript,")
        .replace("https://api.motion.dev/score/badge", "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7#")
        .replace("import \"https://motion.dev/assets/", "// import \"https://motion.dev/assets/")
        .replace("import \"/assets/manifest-", "// import \"/assets/manifest-");

    if site_id == "qt" {
        html = html.replace("href=\"/qt/", "href=\"/qt-6/");
    }

    // Ensure all documentation pages are responsive on mobile screens
    if !html.contains("name=\"viewport\"") && !html.contains("name='viewport'")
        && let Some(pos) = html.find("<head>").or_else(|| html.find("<HEAD>")) {
            html.insert_str(pos + 6, "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover\" />");
        }

    if site_id == "lucide" {
        html = html.replace(
            "</body>",
            r#"<script src="/assets/docx-lucide-bundle.js"></script></body>"#,
        );
    }

    // Strip any legacy baked-in <style id="docx-styled-scroll">...</script> snippet from older docpacks
    // so its unconditional dark-mode override never conflicts with runtime theme synchronization.
    if let Some(old_idx) = html.find("<style id=\"docx-styled-scroll\">") {
        if let Some(body_end) = html[old_idx..].find("</body>") {
            html.replace_range(old_idx..(old_idx + body_end), "");
        } else {
            html.truncate(old_idx);
        }
    }

    let inject = READER_BRIDGE_TEMPLATE
        .replace("__DOCX_SITE_ID__", site_id)
        .replace("__DOCX_SITE_ORIGIN__", &origin);

    if let Some(pos) = html.rfind("</body>") {
        html.insert_str(pos, &inject);
    } else {
        html.push_str(&inject);
    }
    html.into_bytes()
}

