use axum::{http::StatusCode, response::IntoResponse};
use thiserror::Error;

use crate::cssapi::problem::Problem;

#[derive(Debug, Error)]
pub enum ApiError {
    #[error("bad request: {0}")]
    BadRequest(String),
    #[error("forbidden: {0}")]
    Forbidden(String),
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

    pub fn forbidden(code: &str, msg: &str) -> Self {
        Self::Forbidden(format!("{code}: {msg}"))
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
            Self::Forbidden(base) => Self::Forbidden(format!("{base}; details={details}")),
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
            Self::Forbidden(_) => StatusCode::FORBIDDEN,
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::Conflict(_) => StatusCode::CONFLICT,
            Self::Unprocessable(_) => StatusCode::UNPROCESSABLE_ENTITY,
            Self::TooManyRequests(_) => StatusCode::TOO_MANY_REQUESTS,
            Self::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn payload(&self) -> &str {
        match self {
            Self::BadRequest(s)
            | Self::Forbidden(s)
            | Self::NotFound(s)
            | Self::Conflict(s)
            | Self::Unprocessable(s)
            | Self::TooManyRequests(s)
            | Self::Internal(s) => s.as_str(),
        }
    }
}

fn is_zh(s: &str) -> bool {
    s.chars().any(|c| ('\u{4e00}'..='\u{9fff}').contains(&c))
}

fn parse_payload(payload: &str) -> (String, String, Option<String>) {
    let base: String;
    let mut details: Option<String> = None;
    if let Some((l, r)) = payload.trim().split_once("; details=") {
        base = l.trim().to_string();
        details = Some(r.trim().to_string());
    } else {
        base = payload.trim().to_string();
    }
    if let Some((code, msg)) = base.split_once(':') {
        return (
            code.trim().to_string(),
            msg.trim().to_string(),
            details.filter(|d| !d.is_empty()),
        );
    }
    (
        "UNKNOWN".to_string(),
        base,
        details.filter(|d| !d.is_empty()),
    )
}

fn problem_title(lang: &str, status: StatusCode) -> String {
    let key = match status {
        StatusCode::BAD_REQUEST => "problem_bad_request",
        StatusCode::FORBIDDEN => "problem_forbidden",
        StatusCode::NOT_FOUND => "problem_not_found",
        StatusCode::CONFLICT => "problem_conflict",
        StatusCode::UNPROCESSABLE_ENTITY => "problem_unprocessable",
        StatusCode::TOO_MANY_REQUESTS => "problem_too_many_requests",
        _ => "problem_internal",
    };
    crate::i18n::t(lang, key).to_string()
}

fn render_detail(lang: &str, code: &str, message: &str, details: Option<&str>) -> String {
    let mut d = crate::i18n::t(lang, "problem_detail_template")
        .replace("{code}", code)
        .replace("{message}", message);
    if let Some(extra) = details {
        d = crate::i18n::t(lang, "problem_detail_with_details_template")
            .replace("{code}", code)
            .replace("{message}", message)
            .replace("{details}", extra);
    }
    d
}

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        let status = self.status();
        let payload = self.payload().to_string();
        let (code, message, details) = parse_payload(&payload);
        let lang = if is_zh(&message) || details.as_deref().map(is_zh).unwrap_or(false) {
            "zh"
        } else {
            "en"
        };
        let title = problem_title(lang, status);
        let detail = render_detail(lang, &code, &message, details.as_deref());
        Problem::new(status, title).detail(detail).into_response()
    }
}
