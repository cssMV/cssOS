use axum::{extract::FromRequestParts, http::request::Parts};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::Session;

#[derive(Clone, Debug)]
pub struct AuthSession {
    pub user_id: Option<Uuid>,
}

#[axum::async_trait]
impl<S> FromRequestParts<S> for AuthSession
where
    S: Send + Sync,
{
    type Rejection = (axum::http::StatusCode, String);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let extensions = parts.extensions.clone();
        let pool = extensions
            .get::<PgPool>()
            .ok_or((axum::http::StatusCode::INTERNAL_SERVER_ERROR, "db missing".to_string()))?;

        let cookie_header = parts
            .headers
            .get(axum::http::header::COOKIE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");

        let session_cookie = extensions
            .get::<String>()
            .cloned()
            .unwrap_or_else(|| "cssos_session".to_string());

        let session_id = cookie_header
            .split(';')
            .map(|c| c.trim())
            .find_map(|c| {
                let mut parts = c.splitn(2, '=');
                let name = parts.next()?;
                let value = parts.next()?;
                if name == session_cookie { Some(value.to_string()) } else { None }
            })
            .and_then(|id| Uuid::parse_str(&id).ok());

        if session_id.is_none() {
            return Ok(Self { user_id: None });
        }

        let session = sqlx::query_as::<_, Session>(
            "SELECT * FROM sessions WHERE id = $1 AND revoked_at IS NULL AND expires_at > now()",
        )
        .bind(session_id.unwrap())
        .fetch_optional(pool)
        .await
        .map_err(|_| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, "db error".to_string()))?;

        Ok(Self { user_id: session.map(|s| s.user_id) })
    }
}
