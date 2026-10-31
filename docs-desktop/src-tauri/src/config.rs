//! Central configuration constants shared across modules.

pub(crate) static TRAILER_MAGIC: &[u8; 8] = b"DOCXPACK";
/// App binaries. Icons live here too, so this tag keeps serving old installs.
pub(crate) const RELEASE_BASE_URL: &str = "https://github.com/VahidM313/docx/releases/download/packs-latest";
/// Format v3 packs and their registry.
pub(crate) const PACKS_BASE_URL: &str = "https://github.com/VahidM313/docx/releases/download/docpacks-v3";
pub(crate) const APP_BUILD_COMMIT: &str = match option_env!("DOCX_BUILD_COMMIT") {
    Some(v) => v,
    None => "local",
};

