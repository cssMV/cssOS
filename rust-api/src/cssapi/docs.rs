use axum::Router;
use utoipa_swagger_ui::SwaggerUi;

use super::openapi::build_openapi;

pub fn docs_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
{
    Router::new().merge(SwaggerUi::new("/cssapi/v1/docs").url("/cssapi/v1/openapi.json", build_openapi()))
}
