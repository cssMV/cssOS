use axum::Router;
use serde::{Deserialize, Serialize};
use utoipa::{OpenApi, ToSchema};
use utoipa_swagger_ui::SwaggerUi;

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ErrorV1 {
    pub schema: String,
    pub code: String,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct StageStatusV1 {
    pub name: String,
    pub deps: Vec<String>,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct PipelineVideoStatusV1 {
    pub shots_count: Option<i64>,
    pub storyboard: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct WorkerStatusV1 {
    pub concurrency: i64,
    pub running: i64,
    pub queued: i64,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct PipelineStatusV1 {
    pub schema: String,
    pub run_state_path: String,
    pub ready: Vec<String>,
    pub stages: Vec<StageStatusV1>,
    pub video: Option<PipelineVideoStatusV1>,
    pub worker: Option<WorkerStatusV1>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateRunRequestV1 {
    pub input: serde_json::Value,
    #[serde(default)]
    pub commands: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RunCreatedV1 {
    pub schema: String,
    pub run_id: String,
    pub run_dir: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RunsListItemV1 {
    pub run_id: String,
    pub status: String,
    pub updated_at_ms: i64,
    pub run_dir: String,
    pub run_json: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RunsListV1 {
    pub schema: String,
    pub root: String,
    pub limit: i64,
    pub status: Option<String>,
    pub items: Vec<RunsListItemV1>,
}

#[utoipa::path(
    get,
    path = "/api/pipeline/status",
    params(
        ("path" = Option<String>, Query, description = "run.json path on server")
    ),
    responses(
        (status = 200, description = "Pipeline status", body = PipelineStatusV1),
        (status = 400, description = "Error", body = ErrorV1)
    )
)]
fn _doc_pipeline_status() {}

#[utoipa::path(
    post,
    path = "/api/pipeline/start",
    request_body = serde_json::Value,
    responses(
        (status = 200, description = "Start pipeline", body = serde_json::Value),
        (status = 400, description = "Error", body = ErrorV1)
    )
)]
fn _doc_pipeline_start() {}

#[utoipa::path(
    post,
    path = "/cssapi/v1/runs",
    request_body = CreateRunRequestV1,
    responses(
        (status = 201, description = "Run created", body = RunCreatedV1),
        (status = 500, description = "Error", body = ErrorV1)
    )
)]
fn _doc_runs_create() {}

#[utoipa::path(
    get,
    path = "/cssapi/v1/runs",
    params(
        ("limit" = Option<i64>, Query, description = "max items 1..200, default 50"),
        ("status" = Option<String>, Query, description = "filter by status")
    ),
    responses(
        (status = 200, description = "Runs list", body = RunsListV1)
    )
)]
fn _doc_runs_list() {}

#[utoipa::path(
    get,
    path = "/cssapi/v1/runs/{run_id}",
    params(
        ("run_id" = String, Path, description = "Run id")
    ),
    responses(
        (status = 200, description = "Run JSON", body = serde_json::Value),
        (status = 404, description = "Not found", body = ErrorV1)
    )
)]
fn _doc_runs_get() {}

#[utoipa::path(
    get,
    path = "/cssapi/v1/runs/{run_id}/status",
    params(
        ("run_id" = String, Path, description = "Run id")
    ),
    responses(
        (status = 200, description = "Run status (same as pipeline status)", body = serde_json::Value),
        (status = 400, description = "Error", body = ErrorV1),
        (status = 404, description = "Not found", body = ErrorV1)
    )
)]
fn _doc_runs_status() {}

#[derive(OpenApi)]
#[openapi(
    paths(
        _doc_pipeline_status,
        _doc_pipeline_start,
        _doc_runs_create,
        _doc_runs_list,
        _doc_runs_get,
        _doc_runs_status
    ),
    components(
        schemas(
            ErrorV1,
            StageStatusV1,
            PipelineVideoStatusV1,
            WorkerStatusV1,
            PipelineStatusV1,
            CreateRunRequestV1,
            RunCreatedV1,
            RunsListItemV1,
            RunsListV1
        )
    ),
    tags(
        (name = "cssAPI", description = "cssMV internal/external API")
    )
)]
pub struct CssApiDoc;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
{
    Router::new()
        .merge(
            SwaggerUi::new("/cssapi/v1/docs")
                .url("/cssapi/v1/openapi.json", CssApiDoc::openapi()),
        )
}
