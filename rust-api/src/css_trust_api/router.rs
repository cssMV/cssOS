use axum::{routing::post, Router};

pub fn router() -> Router<crate::routes::AppState> {
    Router::new()
        .route(
            "/cssapi/v1/trust/user",
            post(crate::css_trust_api::handlers::get_user_trust_http),
        )
        .route(
            "/cssapi/v1/trust/catalog",
            post(crate::css_trust_api::handlers::get_catalog_trust_http),
        )
        .route(
            "/cssapi/v1/trust/deal",
            post(crate::css_trust_api::handlers::get_deal_trust_http),
        )
        .route(
            "/cssapi/v1/trust/ownership",
            post(crate::css_trust_api::handlers::get_ownership_trust_http),
        )
}
