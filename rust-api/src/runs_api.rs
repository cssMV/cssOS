use axum::{
    extract::rejection::JsonRejection,
    extract::{Json, Path, Query},
    http::StatusCode,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::cmp::Reverse;
use std::fs;
use std::time::SystemTime;
use utoipa::ToSchema;

use crate::cssapi::error::ApiError;
use crate::cssapi::error_map::map_io;
#[allow(unused_imports)]
use crate::cssapi::problem::Problem;
use crate::cssapi::response::ApiResult;
use crate::events;
use crate::run_state::{RetryPolicy, RunConfig, RunState, RunStatus};
use crate::{jobs, metrics, ready, run_store, runner};

#[derive(Debug, Deserialize)]
pub struct RunsCreateRequest {
    pub cssl: String,
    pub ui_lang: Option<String>,
    pub tier: Option<String>,
    pub config: Option<RunConfig>,
    pub retry_policy: Option<RetryPolicy>,
    pub commands: Option<crate::dsl::compile::CompiledCommands>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RunsCreateResponse {
    schema: &'static str,
    run_id: String,
    status_url: String,
    ready_url: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RunsStatusResponse {
    schema: &'static str,
    run_id: String,
    status: RunStatus,
    updated_at: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct RunsListQuery {
    pub limit: Option<usize>,
    pub status: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RunsListItem {
    run_id: String,
    status: String,
    updated_at_ms: i64,
    run_dir: String,
    run_json: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RunsListResponse {
    schema: &'static str,
    root: String,
    limit: i64,
    status: Option<String>,
    items: Vec<RunsListItem>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct DagReadyMeta {
    schema: String,
    concurrency: usize,
    nodes_total: usize,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RunReadyResponse {
    schema: &'static str,
    run_id: String,
    status: RunStatus,
    dag: DagReadyMeta,
    topo_order: Vec<String>,
    ready: Vec<String>,
    running: Vec<String>,
    summary: ready::ReadySummary,
    video_shots: Option<VideoShotsMeta>,
    updated_at: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct VideoShotsMeta {
    n: usize,
}

#[derive(Debug, Serialize)]
struct CancelResponse {
    schema: &'static str,
    run_id: String,
    cancel_requested: bool,
}

#[utoipa::path(
    get,
    path = "/cssapi/v1/runs",
    tag = "runs",
    params(
        ("limit" = Option<usize>, Query, description = "Result limit, default 50, max 200"),
        ("status" = Option<String>, Query, description = "Filter by run status")
    ),
    responses(
        (status = 200, description = "List runs", body = RunsListResponse,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        ),
        (status = 500, description = "Server error", body = Problem,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        )
    )
)]
pub async fn runs_list(
    Query(q): Query<RunsListQuery>,
) -> ApiResult<RunsListResponse> {
    let root = run_store::runs_root();
    let limit = q.limit.unwrap_or(50).clamp(1, 200);
    let want_status = q.status.map(|s| s.to_uppercase());

    let mut items: Vec<(i64, RunsListItem)> = Vec::new();
    let rd = fs::read_dir(&root).map_err(map_io)?;

    for ent in rd.flatten() {
        let path = ent.path();
        if !path.is_dir() {
            continue;
        }
        let run_id = match path.file_name() {
            Some(v) => v.to_string_lossy().to_string(),
            None => continue,
        };
        let run_json = path.join("run.json");
        if !run_json.exists() {
            continue;
        }

        let mtime = ent
            .metadata()
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);

        let txt = fs::read_to_string(&run_json).unwrap_or_else(|_| "{}".to_string());
        let v: serde_json::Value =
            serde_json::from_str(&txt).unwrap_or_else(|_| serde_json::json!({}));
        let st = v
            .get("status")
            .and_then(|x| x.as_str())
            .unwrap_or("UNKNOWN")
            .to_uppercase();

        if let Some(ws) = &want_status {
            if st != *ws {
                continue;
            }
        }

        items.push((
            mtime,
            RunsListItem {
                run_id,
                status: st,
                updated_at_ms: mtime,
                run_dir: path.display().to_string(),
                run_json: run_json.display().to_string(),
            },
        ));
    }

    items.sort_by_key(|(t, _)| Reverse(*t));
    let out = items
        .into_iter()
        .take(limit)
        .map(|(_, v)| v)
        .collect::<Vec<_>>();

    Ok(Json(RunsListResponse {
        schema: "cssapi.runs.list.v1",
        root: root.display().to_string(),
        limit: limit as i64,
        status: want_status,
        items: out,
    }))
}

#[utoipa::path(
    post,
    path = "/cssapi/v1/runs",
    tag = "runs",
    request_body = serde_json::Value,
    responses(
        (status = 202, description = "Run queued", body = RunsCreateResponse,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        ),
        (status = 409, description = "Conflict", body = Problem,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        ),
        (status = 422, description = "Invalid request", body = Problem,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        ),
        (status = 500, description = "Server error", body = Problem,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        )
    )
)]
pub async fn runs_create(
    body: Result<Json<RunsCreateRequest>, JsonRejection>,
) -> Result<(StatusCode, Json<RunsCreateResponse>), ApiError> {
    let Json(body) = body.map_err(|e| {
        ApiError::unprocessable("INVALID_REQUEST", "invalid request body").with_details(
            serde_json::json!({
                "reason": e.body_text()
            }),
        )
    })?;

    if jobs::queue::queued_or_running_count().await > 20 {
        return Err(ApiError::too_many_requests(
            "SYSTEM_BUSY",
            "too many runs queued or running",
        ));
    }

    let run_id = runner::new_run_id();
    run_store::ensure_run_dir(&run_id).map_err(map_io)?;

    let mut run_state = runner::init_run_state(
        run_id.clone(),
        body.ui_lang.unwrap_or_else(|| "en".to_string()),
        body.tier.unwrap_or_else(|| "basic".to_string()),
        body.cssl.clone(),
    );

    let run_dir = run_store::run_dir(&run_id);
    run_state.config.out_dir = run_dir;
    if let Some(cfg) = body.config {
        run_state.config.wiki_enabled = cfg.wiki_enabled;
        run_state.config.civ_linked = cfg.civ_linked;
        run_state.config.heartbeat_interval_seconds = cfg.heartbeat_interval_seconds;
        run_state.config.stage_timeout_seconds = cfg.stage_timeout_seconds;
        run_state.config.stuck_timeout_seconds = cfg.stuck_timeout_seconds;
    }
    if let Some(retry) = body.retry_policy {
        run_state.retry_policy = retry;
    }

    let state_path = run_store::run_state_path(&run_id);
    run_store::write_run_state(&state_path, &run_state).map_err(map_io)?;
    events::emit_snapshot(&run_state);

    let compiled = match body.commands {
        Some(c) => c,
        None => crate::dsl::compile::compile_from_dsl(&body.cssl)
            .map_err(|e| {
                ApiError::unprocessable("INVALID_REQUEST", "invalid request body")
                    .with_details(serde_json::json!({"reason": e.to_string()}))
            })?,
    };
    run_store::write_compiled_commands(&run_id, &compiled).map_err(map_io)?;

    if !jobs::queue::claim_run(&run_id).await {
        return Err(ApiError::conflict(
            "CONFLICT",
            "run already queued/running",
        ));
    }

    jobs::queue::push_run(run_id.clone(), run_state.tier.clone())
    .await
    .map_err(|_| ApiError::internal("QUEUE_PUSH_FAILED", "failed to queue run"))?;

    metrics::incr_runs_created();

    Ok((
        StatusCode::ACCEPTED,
        Json(RunsCreateResponse {
            schema: "cssapi.runs.create.v1",
            run_id: run_id.clone(),
            status_url: format!("/cssapi/v1/runs/{}/status", run_id),
            ready_url: format!("/cssapi/v1/runs/{}/ready", run_id),
        }),
    ))
}

#[utoipa::path(
    get,
    path = "/cssapi/v1/runs/{run_id}",
    tag = "runs",
    params(
        ("run_id" = String, Path, description = "Run ID")
    ),
    responses(
        (status = 200, description = "Run state JSON", body = serde_json::Value,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        ),
        (status = 404, description = "Run not found", body = Problem,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        ),
        (status = 500, description = "Internal error", body = Problem,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        )
    )
)]
pub async fn runs_get(Path(run_id): Path<String>) -> ApiResult<RunState> {
    let p = run_store::run_state_path(&run_id);
    let s = run_store::read_run_state(&p).map_err(|_| {
        if p.exists() {
            ApiError::internal("RUN_READ_FAILED", "failed to read run state")
        } else {
            ApiError::not_found("RUN_NOT_FOUND", "run_id not found")
        }
    })?;
    Ok(Json(s))
}

#[utoipa::path(
    get,
    path = "/cssapi/v1/runs/{run_id}/status",
    tag = "runs",
    params(
        ("run_id" = String, Path, description = "Run ID")
    ),
    responses(
        (status = 200, description = "Run status", body = RunsStatusResponse,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        ),
        (status = 404, description = "Run not found", body = Problem,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        ),
        (status = 500, description = "Internal error", body = Problem,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        )
    )
)]
pub async fn runs_status(
    Path(run_id): Path<String>,
) -> ApiResult<RunsStatusResponse> {
    let p = run_store::run_state_path(&run_id);
    let s = run_store::read_run_state(&p).map_err(|_| {
        if p.exists() {
            ApiError::internal("RUN_READ_FAILED", "failed to read run state")
        } else {
            ApiError::not_found("RUN_NOT_FOUND", "run_id not found")
        }
    })?;
    Ok(Json(RunsStatusResponse {
        schema: "cssapi.runs.status.v1",
        run_id: s.run_id,
        status: s.status,
        updated_at: s.updated_at,
    }))
}

#[utoipa::path(
    get,
    path = "/cssapi/v1/runs/{run_id}/ready",
    tag = "runs",
    params(
        ("run_id" = String, Path, description = "Run ID")
    ),
    responses(
        (status = 200, description = "Ready queue view", body = RunReadyResponse,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        ),
        (status = 404, description = "Run not found", body = Problem,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        ),
        (status = 500, description = "Internal error", body = Problem,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        )
    )
)]
pub async fn run_ready(
    Path(run_id): Path<String>,
) -> ApiResult<RunReadyResponse> {
    let state_path = run_store::run_state_path(&run_id);
    let state = run_store::read_run_state(&state_path).map_err(|_| {
        if state_path.exists() {
            ApiError::internal("RUN_READ_FAILED", "failed to read run state")
        } else {
            ApiError::not_found("RUN_NOT_FOUND", "run_id not found")
        }
    })?;
    let dag = crate::dag::cssmv_dag_v1();
    let view = ready::compute_ready_view_with_dag_limited(&state, &dag, 64);
    let video_shots = state
        .video_shots_total
        .map(|n| n as usize)
        .or_else(|| {
            let p = state.config.out_dir.join("video").join("storyboard.json");
            fs::read(&p)
                .ok()
                .and_then(|b| serde_json::from_slice::<crate::video::storyboard::StoryboardV1>(&b).ok())
                .map(|sb| sb.shots.len())
        })
        .map(|n| VideoShotsMeta { n });

    Ok(Json(RunReadyResponse {
        schema: "cssapi.runs.ready.v1",
        run_id: state.run_id.clone(),
        status: state.status.clone(),
        dag: DagReadyMeta {
            schema: state.dag.schema.clone(),
            concurrency: runner::concurrency_limit(),
            nodes_total: view.topo_order.len(),
        },
        topo_order: view.topo_order,
        ready: view.ready,
        running: view.running,
        summary: view.summary,
        video_shots,
        updated_at: state.updated_at,
    }))
}

async fn run_cancel(
    Path(run_id): Path<String>,
) -> Result<(StatusCode, Json<CancelResponse>), ApiError> {
    let p = run_store::run_state_path(&run_id);
    let mut s = run_store::read_run_state(&p)
        .map_err(|_| ApiError::not_found("RUN_NOT_FOUND", "run_id not found"))?;
    s.cancel_requested = true;
    s.cancel_requested_at = Some(chrono::Utc::now().to_rfc3339());
    s.updated_at = chrono::Utc::now().to_rfc3339();
    run_store::write_run_state(&p, &s)
        .map_err(map_io)?;

    Ok((
        StatusCode::ACCEPTED,
        Json(CancelResponse {
            schema: "cssapi.runs.cancel.v1",
            run_id,
            cancel_requested: true,
        }),
    ))
}

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
{
    Router::new()
        .route("/cssapi/v1/runs", post(runs_create).get(runs_list))
        .route("/cssapi/v1/runs/:run_id", get(runs_get))
        .route("/cssapi/v1/runs/:run_id/status", get(runs_status))
        .route("/cssapi/v1/runs/:run_id/ready", get(run_ready))
        .route("/cssapi/v1/runs/:run_id/cancel", post(run_cancel))
}
