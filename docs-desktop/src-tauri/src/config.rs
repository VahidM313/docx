//! Central configuration constants shared across modules.

pub(crate) static TRAILER_MAGIC: &[u8; 8] = b"DOCXPACK";
pub(crate) const RELEASE_BASE_URL: &str = "https://github.com/VahidM313/docx/releases/download/packs-latest";
pub(crate) const APP_BUILD_COMMIT: &str = match option_env!("DOCX_BUILD_COMMIT") {
    Some(v) => v,
    None => "local",
};

