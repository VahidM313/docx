//! Central error type replacing bare `String` errors and panicky unwraps.
//!
//! Every fallible backend path (pack IO, HTTP, JSON, registry, locks) routes
//! through [`DocxError`]; Tauri command boundaries convert to `String` via
//! [`DocxError::to_message`]-style `Display` so the frontend contract keeps
//! working unchanged.

use std::fmt;
use std::sync::{PoisonError, RwLock};

pub type Result<T> = std::result::Result<T, DocxError>;

#[derive(Debug, thiserror::Error)]
pub enum DocxError {
    #[error("pack file not found: {0}")]
    PackMissing(String),

    #[error("invalid docpack: {0}")]
    InvalidPack(String),

    #[error("route not found: {0}")]
    RouteNotFound(String),

    #[error("http request failed for {url}: {message}")]
    Http {
        url: String,
        message: String,
    },

    #[error("http status {status} for {url}")]
    HttpStatus { status: u16, url: String },

    #[error("io error on {path}: {message}")]
    Io { path: String, message: String },

    #[error("json error: {0}")]
    Json(String),

    #[error("internal lock poisoned — previous thread panicked while holding state")]
    LockPoisoned,

    #[error("{0}")]
    Other(String),
}

impl DocxError {
    pub fn invalid_pack(what: impl Into<String>) -> Self {
        DocxError::InvalidPack(what.into())
    }

    pub fn io_path(path: impl AsRef<std::path::Path>, err: &std::io::Error) -> Self {
        DocxError::Io {
            path: path.as_ref().display().to_string(),
            message: err.to_string(),
        }
    }

    pub fn http(url: impl Into<String>, message: impl fmt::Display) -> Self {
        DocxError::Http {
            url: url.into(),
            message: message.to_string(),
        }
    }
}

impl From<std::io::Error> for DocxError {
    fn from(e: std::io::Error) -> Self {
        DocxError::Io {
            path: String::new(),
            message: e.to_string(),
        }
    }
}

impl From<serde_json::Error> for DocxError {
    fn from(e: serde_json::Error) -> Self {
        DocxError::Json(e.to_string())
    }
}

impl From<reqwest::Error> for DocxError {
    fn from(e: reqwest::Error) -> Self {
        DocxError::Http {
            url: e
                .url()
                .map(|u| u.to_string())
                .unwrap_or_default(),
            message: e.to_string(),
        }
    }
}

impl<T> From<PoisonError<std::sync::RwLockReadGuard<'_, T>>> for DocxError {
    fn from(_: PoisonError<std::sync::RwLockReadGuard<'_, T>>) -> Self {
        DocxError::LockPoisoned
    }
}

impl<T> From<PoisonError<std::sync::RwLockWriteGuard<'_, T>>> for DocxError {
    fn from(_: PoisonError<std::sync::RwLockWriteGuard<'_, T>>) -> Self {
        DocxError::LockPoisoned
    }
}

impl From<DocxError> for String {
    fn from(e: DocxError) -> String {
        e.to_string()
    }
}

impl From<String> for DocxError {
    fn from(s: String) -> Self {
        DocxError::Other(s)
    }
}

/// Read a shared lock surface with poison converted to a typed error.
pub(crate) fn read_guard<T>(lock: &RwLock<T>) -> Result<std::sync::RwLockReadGuard<'_, T>> {
    lock.read().map_err(|_| DocxError::LockPoisoned)
}

/// Write through a shared lock surface with poison converted to a typed error.
#[allow(dead_code)]
pub(crate) fn write_guard<T>(lock: &RwLock<T>) -> Result<std::sync::RwLockWriteGuard<'_, T>> {
    lock.write().map_err(|_| DocxError::LockPoisoned)
}
