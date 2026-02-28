use axum::{routing::get, Router};
use utoipa_swagger_ui::SwaggerUi;

use super::openapi::{build_openapi, openapi_json};

pub fn docs_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
{
    Router::new()
        .route("/cssapi/v1/openapi.json", get(openapi_json))
        .merge(SwaggerUi::new("/cssapi/v1/docs").url("/cssapi/v1/openapi.json", build_openapi()))
}
