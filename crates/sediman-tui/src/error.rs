use std::fmt;
use sediman_tui_core::event::AppEvent;

#[allow(dead_code)]
#[derive(Debug)]
pub enum AppError {
    Bridge(String),
    Io(std::io::Error),
    Config(String),
    ChannelClosed,
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::Bridge(msg) => write!(f, "Bridge error: {}", msg),
            AppError::Io(e) => write!(f, "I/O error: {}", e),
            AppError::Config(msg) => write!(f, "Config error: {}", msg),
            AppError::ChannelClosed => write!(f, "Event channel closed"),
        }
    }
}

impl std::error::Error for AppError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            AppError::Io(e) => Some(e),
            _ => None,
        }
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Io(e)
    }
}

pub fn try_send(tx: &tokio::sync::mpsc::Sender<AppEvent>, event: AppEvent) {
    match tx.try_send(event) {
        Ok(()) => {}
        Err(tokio::sync::mpsc::error::TrySendError::Full(_)) => {
            tracing::warn!("Event channel full, dropping event");
        }
        Err(tokio::sync::mpsc::error::TrySendError::Closed(_)) => {
            tracing::warn!("Event channel closed, dropping event");
        }
    }
}
