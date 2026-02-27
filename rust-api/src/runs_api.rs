use axum::{
    extract::{Json, Path},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use crate::runs_list;
use crate::run_worker::spawn_run_worker;
use crate::metrics;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{fs, path::PathBuf};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateRunRequest {
    pub input: serde_json::Value,
    #[serde(default)]
    pub commands: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RunResponse {
    pub schema: String,
    pub run_id: String,
    pub run_dir: String,
}

fn runs_root() -> PathBuf {
    PathBuf::from("build/runs")
}

fn run_dir(run_id: &str) -> PathBuf {
    runs_root().join(run_id)
}

pub async fn create_run(Json(req): Json<CreateRunRequest>) -> impl IntoResponse {
    let run_id = Uuid::new_v4().to_string();
    let dir = run_dir(&run_id);

    if let Err(e) = fs::create_dir_all(&dir) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({
                "schema":"css.error.v1",
                "code":"RUN_CREATE_FAILED",
                "message":e.to_string()
            })),
        );
    }

    let run_json_path = dir.join("run.json");
    let initial_state = json!({
        "schema":"css.run.v1",
        "run_id":run_id,
        "status":"INIT",
        "input":req.input.clone(),
        "commands":req.commands.clone(),
        "stages":{},
        "artifacts":{}
    });

    match serde_json::to_vec_pretty(&initial_state)
        .map_err(anyhow::Error::from)
        .and_then(|buf| fs::write(&run_json_path, buf).map_err(anyhow::Error::from))
    {
        Ok(_) => {
            metrics::incr_runs_created();
            spawn_run_worker(dir.clone(), req.commands.clone());
            (
                StatusCode::CREATED,
                Json(json!(RunResponse {
                    schema: "css.run.created.v1".into(),
                    run_id: run_id.clone(),
                    run_dir: dir.display().to_string(),
                })),
            )
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({
                "schema":"css.error.v1",
                "code":"RUN_WRITE_FAILED",
                "message":e.to_string()
            })),
        ),
    }
}

pub async fn get_run(Path(run_id): Path<String>) -> impl IntoResponse {
    let path = run_dir(&run_id).join("run.json");

    match fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
    {
        Some(v) => (StatusCode::OK, Json(v)),
        None => (
            StatusCode::NOT_FOUND,
            Json(json!({
                "schema":"css.error.v1",
                "code":"RUN_NOT_FOUND",
                "run_id":run_id
            })),
        ),
    }
}

pub async fn get_run_status(Path(run_id): Path<String>) -> impl IntoResponse {
    let path = run_dir(&run_id).join("run.json");

    match crate::pipeline_status::build_status_json(&path) {
        Ok(v) => (StatusCode::OK, Json(v)),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(json!({
                "schema":"css.error.v1",
                "code":"RUN_STATUS_FAILED",
                "message":e.to_string()
            })),
        ),
    }
}

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
{
    Router::new()
        .route("/cssapi/v1/runs", get(runs_list::list_runs).post(create_run))
        .route("/cssapi/v1/runs/:run_id", get(get_run))
        .route("/cssapi/v1/runs/:run_id/status", get(get_run_status))
}
