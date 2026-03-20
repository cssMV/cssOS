use axum::{routing::post, Router};

pub fn router() -> Router<crate::routes::AppState> {
    Router::new()
        .route(
            "/cssapi/v1/risk/user",
            post(crate::css_risk_api::handlers::get_user_risk_http),
        )
        .route(
            "/cssapi/v1/risk/catalog",
            post(crate::css_risk_api::handlers::get_catalog_risk_http),
        )
        .route(
            "/cssapi/v1/risk/deal",
            post(crate::css_risk_api::handlers::get_deal_risk_http),
        )
        .route(
            "/cssapi/v1/risk/ownership",
            post(crate::css_risk_api::handlers::get_ownership_risk_http),
        )
}
