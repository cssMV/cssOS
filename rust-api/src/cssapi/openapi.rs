use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    info(
        title = "cssAPI v1",
        version = "1.0.0",
        description = "cssMV public API (v1)."
    ),
    paths(
        openapi_json,
        crate::runs_api::runs_list,
        crate::runs_api::runs_create,
        crate::runs_api::runs_get,
        crate::runs_api::runs_status,
        crate::runs_api::run_ready
    ),
    components(
        schemas(
            crate::cssapi::problem::Problem,
            crate::runs_api::RunsListQuery,
            crate::runs_api::RunsListItem,
            crate::runs_api::RunsListResponse,
            crate::runs_api::RunsCreateResponse,
            crate::runs_api::RunsStatusResponse,
            crate::runs_api::DagReadyMeta,
            crate::runs_api::RunReadyResponse,
            crate::ready::ReadySummary,
            crate::run_state::RunStatus
        )
    ),
    tags(
        (name = "runs", description = "Run lifecycle and status APIs")
    )
)]
pub struct CssApiDoc;

#[utoipa::path(
    get,
    path = "/cssapi/v1/openapi.json",
    tag = "runs",
    responses(
        (status = 200, description = "OpenAPI v1 JSON", body = serde_json::Value,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        )
    )
)]
pub(super) async fn openapi_json() -> axum::Json<utoipa::openapi::OpenApi> {
    axum::Json(build_openapi())
}

pub fn build_openapi() -> utoipa::openapi::OpenApi {
    CssApiDoc::openapi()
}
