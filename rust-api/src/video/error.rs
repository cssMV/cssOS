use std::fmt::{Display, Formatter};

#[derive(Debug)]
pub struct VideoError(pub String);

impl Display for VideoError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::error::Error for VideoError {}

impl From<std::io::Error> for VideoError {
    fn from(e: std::io::Error) -> Self {
        VideoError(e.to_string())
    }
}

impl From<serde_json::Error> for VideoError {
    fn from(e: serde_json::Error) -> Self {
        VideoError(e.to_string())
    }
}
