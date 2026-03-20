use axum::{routing::post, Router};

use crate::css_assurance_api::handlers::{
    get_catalog_assurance_http, get_deal_assurance_http, get_ownership_assurance_http,
    get_user_assurance_http,
};

pub fn router() -> Router<crate::routes::AppState> {
    Router::new()
        .route("/cssapi/v1/assurance/user", post(get_user_assurance_http))
        .route(
            "/cssapi/v1/assurance/catalog",
            post(get_catalog_assurance_http),
        )
        .route("/cssapi/v1/assurance/deal", post(get_deal_assurance_http))
        .route(
            "/cssapi/v1/assurance/ownership",
            post(get_ownership_assurance_http),
        )
}
