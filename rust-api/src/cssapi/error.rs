use axum::{http::StatusCode, response::IntoResponse};
use thiserror::Error;

use crate::cssapi::problem::Problem;

#[derive(Debug, Error)]
pub enum ApiError {
    #[error("bad request: {0}")]
    BadRequest(String),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("conflict: {0}")]
    Conflict(String),
    #[error("unprocessable: {0}")]
    Unprocessable(String),
    #[error("too many requests: {0}")]
    TooManyRequests(String),
    #[error("internal error: {0}")]
    Internal(String),
}

impl ApiError {
    pub fn bad_request(code: &str, msg: &str) -> Self {
        Self::BadRequest(format!("{code}: {msg}"))
    }

    pub fn not_found(code: &str, msg: &str) -> Self {
        Self::NotFound(format!("{code}: {msg}"))
    }

    pub fn conflict(code: &str, msg: &str) -> Self {
        Self::Conflict(format!("{code}: {msg}"))
    }

    pub fn unprocessable(code: &str, msg: &str) -> Self {
        Self::Unprocessable(format!("{code}: {msg}"))
    }

    pub fn internal(code: &str, msg: &str) -> Self {
        Self::Internal(format!("{code}: {msg}"))
    }

    pub fn too_many_requests(code: &str, msg: &str) -> Self {
        Self::TooManyRequests(format!("{code}: {msg}"))
    }

    pub fn with_details(self, details: serde_json::Value) -> Self {
        match self {
            Self::BadRequest(base) => Self::BadRequest(format!("{base}; details={details}")),
            Self::NotFound(base) => Self::NotFound(format!("{base}; details={details}")),
            Self::Conflict(base) => Self::Conflict(format!("{base}; details={details}")),
            Self::Unprocessable(base) => Self::Unprocessable(format!("{base}; details={details}")),
            Self::TooManyRequests(base) => {
                Self::TooManyRequests(format!("{base}; details={details}"))
            }
            Self::Internal(base) => Self::Internal(format!("{base}; details={details}")),
        }
    }

    pub fn with_instance(self, _instance: impl Into<String>) -> Self {
        self
    }

    pub fn with_request_id(self, _rid: impl Into<String>) -> Self {
        self
    }

    fn status(&self) -> StatusCode {
        match self {
            Self::BadRequest(_) => StatusCode::BAD_REQUEST,
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::Conflict(_) => StatusCode::CONFLICT,
            Self::Unprocessable(_) => StatusCode::UNPROCESSABLE_ENTITY,
            Self::TooManyRequests(_) => StatusCode::TOO_MANY_REQUESTS,
            Self::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        let status = self.status();
        let detail = self.to_string();
        Problem::new(status, status.canonical_reason().unwrap_or("error"))
            .detail(detail)
            .into_response()
    }
}
