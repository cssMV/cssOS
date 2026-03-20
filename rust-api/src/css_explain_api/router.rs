use axum::{routing::post, Router};

pub fn router() -> Router<crate::routes::AppState> {
    Router::new()
        .route(
            "/cssapi/v1/explain/by-audit",
            post(crate::css_explain_api::handlers::explain_by_audit_http),
        )
        .route(
            "/cssapi/v1/explain/by-review",
            post(crate::css_explain_api::handlers::explain_by_review_http),
        )
        .route(
            "/cssapi/v1/explain/by-subject",
            post(crate::css_explain_api::handlers::explain_by_subject_http),
        )
}
