use serde::Serialize;
use std::{error::Error, fmt};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: &'static str,
    pub message: String,
}

impl AppError {
    pub fn not_found(message: impl Into<String>) -> Self {
        Self {
            code: "not_found",
            message: message.into(),
        }
    }

    pub fn state(message: impl Into<String>) -> Self {
        Self {
            code: "state_error",
            message: message.into(),
        }
    }

    pub fn database(message: impl Into<String>) -> Self {
        Self {
            code: "database_error",
            message: message.into(),
        }
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl Error for AppError {}

impl From<rusqlite::Error> for AppError {
    fn from(error: rusqlite::Error) -> Self {
        Self::database(error.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        Self {
            code: "io_error",
            message: error.to_string(),
        }
    }
}

impl From<tauri::Error> for AppError {
    fn from(error: tauri::Error) -> Self {
        Self {
            code: "tauri_error",
            message: error.to_string(),
        }
    }
}

pub type CommandResult<T> = Result<T, AppError>;
