use axum::http::{header, HeaderValue, StatusCode};
use axum::response::IntoResponse;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::cssapi::request_id::current_request_id;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Problem {
    #[serde(rename = "type")]
    pub r#type: String,
    pub title: String,
    pub status: u16,
    pub detail: Option<String>,
    pub instance: Option<String>,
    pub request_id: Option<String>,
}

impl Problem {
    pub fn new(status: StatusCode, title: impl Into<String>) -> Self {
        Self {
            r#type: "about:blank".to_string(),
            title: title.into(),
            status: status.as_u16(),
            detail: None,
            instance: None,
            request_id: None,
        }
    }

    pub fn detail(mut self, d: impl Into<String>) -> Self {
        self.detail = Some(d.into());
        self
    }

    pub fn instance(mut self, i: impl Into<String>) -> Self {
        self.instance = Some(i.into());
        self
    }

    pub fn request_id(mut self, rid: impl Into<String>) -> Self {
        self.request_id = Some(rid.into());
        self
    }
}

impl IntoResponse for Problem {
    fn into_response(self) -> axum::response::Response {
        let status = StatusCode::from_u16(self.status).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
        let mut body = self;
        if body.request_id.is_none() {
            body.request_id = current_request_id();
        }
        let mut resp = (status, axum::Json(body)).into_response();
        resp.headers_mut().insert(
            header::CONTENT_TYPE,
            HeaderValue::from_static("application/problem+json"),
        );
        resp
    }
}
