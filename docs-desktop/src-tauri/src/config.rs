//! Central configuration constants shared across modules.

pub(crate) static TRAILER_MAGIC: &[u8; 8] = b"DOCXPACK";
/// App binaries.
pub(crate) const RELEASE_BASE_URL: &str = "https://github.com/VahidM313/docx/releases/download/packs-latest";
/// Every docpack in one file, read by byte range. `DOCX_LIBRARY_URL` points a test
/// build at a local server.
pub(crate) const LIBRARY_URL: &str = match option_env!("DOCX_LIBRARY_URL") {
    Some(v) => v,
    None => "https://github.com/VahidM313/docx/releases/download/packs-latest/Docx-library.bin",
};
pub(crate) const APP_BUILD_COMMIT: &str = match option_env!("DOCX_BUILD_COMMIT") {
    Some(v) => v,
    None => "local",
};

