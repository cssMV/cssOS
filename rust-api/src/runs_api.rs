use axum::{
    extract::{Json, Path},
    http::StatusCode,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};

use crate::run_state::{RetryPolicy, RunConfig, RunState, RunStatus};
use crate::{cssapi::v1 as cssapi_v1, jobs, metrics, run_store, runner};

#[derive(Debug, Deserialize)]
struct RunsCreateRequest {
    cssl: String,
    ui_lang: Option<String>,
    tier: Option<String>,
    config: Option<RunConfig>,
    retry_policy: Option<RetryPolicy>,
    commands: Option<crate::dsl::compile::CompiledCommands>,
}

#[derive(Debug, Serialize)]
struct RunsCreateResponse {
    schema: &'static str,
    run_id: String,
    status_url: String,
    ready_url: String,
}

#[derive(Debug, Serialize)]
struct RunsStatusResponse {
    schema: &'static str,
    run_id: String,
    status: RunStatus,
    updated_at: String,
}

#[derive(Debug, Serialize)]
struct DagReadyMeta {
    schema: String,
    concurrency: i64,
    nodes_total: i64,
    nodes_succeeded: i64,
    nodes_failed: i64,
    nodes_running: i64,
    nodes_pending: i64,
}

#[derive(Debug, Serialize)]
struct RunningItem {
    stage: String,
    started_at: Option<String>,
    heartbeat_at: Option<String>,
}

#[derive(Debug, Serialize)]
struct ReadyItem {
    stage: String,
}

#[derive(Debug, Serialize)]
struct RunReadyResponse {
    schema: &'static str,
    run_id: String,
    status: RunStatus,
    dag: DagReadyMeta,
    running: Vec<RunningItem>,
    ready: Vec<ReadyItem>,
}

#[derive(Debug, Serialize)]
struct CancelResponse {
    schema: &'static str,
    run_id: String,
    cancel_requested: bool,
}

async fn runs_create(
    Json(body): Json<RunsCreateRequest>,
) -> Result<(StatusCode, Json<RunsCreateResponse>), (StatusCode, String)> {
    let run_id = runner::new_run_id();
    run_store::ensure_run_dir(&run_id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

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
    run_store::write_run_state(&state_path, &run_state)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let compiled = match body.commands {
        Some(c) => c,
        None => crate::dsl::compile::compile_from_dsl(&body.cssl)
            .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?,
    };

    if !jobs::queue::claim_run(&run_id).await {
        return Err((
            StatusCode::CONFLICT,
            "run already queued/running".to_string(),
        ));
    }

    jobs::queue::push(jobs::queue::Job {
        run_id: run_id.clone(),
        state_path,
        state: run_state,
        compiled,
    })
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

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

async fn runs_get(Path(run_id): Path<String>) -> Result<Json<RunState>, (StatusCode, String)> {
    let p = run_store::run_state_path(&run_id);
    let s = run_store::read_run_state(&p)
        .map_err(|_| (StatusCode::NOT_FOUND, "run not found".to_string()))?;
    Ok(Json(s))
}

async fn runs_status(
    Path(run_id): Path<String>,
) -> Result<Json<RunsStatusResponse>, (StatusCode, String)> {
    let p = run_store::run_state_path(&run_id);
    let s = run_store::read_run_state(&p)
        .map_err(|_| (StatusCode::NOT_FOUND, "run not found".to_string()))?;
    Ok(Json(RunsStatusResponse {
        schema: "cssapi.runs.status.v1",
        run_id: s.run_id,
        status: s.status,
        updated_at: s.updated_at,
    }))
}

async fn run_ready(
    Path(run_id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    if !run_store::exists(&run_id) {
        return Err((StatusCode::NOT_FOUND, "run not found".to_string()));
    }

    let state = run_store::load_run_state(&run_id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(cssapi_v1::ready_payload(&state)))
}

async fn run_cancel(
    Path(run_id): Path<String>,
) -> Result<(StatusCode, Json<CancelResponse>), (StatusCode, String)> {
    let p = run_store::run_state_path(&run_id);
    let mut s = run_store::read_run_state(&p)
        .map_err(|_| (StatusCode::NOT_FOUND, "run not found".to_string()))?;
    s.cancel_requested = true;
    s.updated_at = chrono::Utc::now().to_rfc3339();
    run_store::write_run_state(&p, &s)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

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
        .route("/cssapi/v1/runs", post(runs_create))
        .route("/cssapi/v1/runs/:run_id", get(runs_get))
        .route("/cssapi/v1/runs/:run_id/status", get(runs_status))
        .route("/cssapi/v1/runs/:run_id/ready", get(run_ready))
        .route("/cssapi/v1/runs/:run_id/cancel", post(run_cancel))
}
