use std::path::PathBuf;

use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};

use crate::cssapi::error::ApiError;
use crate::orchestrator::build::build_execution_plan_from_api;
use crate::orchestrator::request::{
    CreateMvApiRequest, CreativeRequest, EngineRequest, InputRequest, VersionsRequest,
};
use crate::run_state::{RunState, RunStatus, StageStatus};

#[derive(Debug, Clone, Deserialize)]
pub struct GenerateRequest {
    pub prompt: Option<String>,
    pub lyrics: Option<String>,
    pub style: Option<String>,
    pub lang: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct GenerateResponse {
    pub task_id: String,
    pub run_id: String,
    pub status_url: String,
    pub video_url: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TaskStatusResponse {
    pub task_id: String,
    pub status: String,
    pub progress: u8,
    pub video_url: Option<String>,
}

pub fn router() -> Router<crate::routes::AppState> {
    Router::new()
        .route("/cssapi/v1/mv/generate", post(generate_mv))
        .route("/cssapi/v1/mv/tasks/:run_id", get(task_status))
        .route("/cssapi/v1/mv/tasks/:run_id/video", get(task_video))
}

pub async fn generate_mv(
    State(app): State<crate::routes::AppState>,
    Json(req): Json<GenerateRequest>,
) -> Result<(StatusCode, Json<GenerateResponse>), ApiError> {
    let api_req = build_api_request(&req);
    let (_engine_selection, _matrix, plan) =
        build_execution_plan_from_api(&api_req).map_err(|e| {
            let msg = e.to_string();
            ApiError::unprocessable("INVALID_REQUEST", &msg)
        })?;
    let run_id = crate::runs_api::create_run_from_dag_plan(&app, &api_req, &plan)
        .await
        .map_err(|e| ApiError::internal("RUN_CREATE_FAILED", &e.to_string()))?;

    Ok((
        StatusCode::ACCEPTED,
        Json(GenerateResponse {
            task_id: run_id.clone(),
            run_id: run_id.clone(),
            status_url: format!("/cssapi/v1/mv/tasks/{}", run_id),
            video_url: format!("/cssapi/v1/mv/tasks/{}/video", run_id),
        }),
    ))
}

pub async fn task_status(Path(run_id): Path<String>) -> Result<Json<TaskStatusResponse>, ApiError> {
    let state = load_run_state(&run_id)?;
    let progress = compute_progress(&state);
    let video_path = final_video_path(&run_id);
    let has_video = video_path.exists();

    Ok(Json(TaskStatusResponse {
        task_id: run_id.clone(),
        status: format!("{:?}", state.status).to_lowercase(),
        progress,
        video_url: has_video.then(|| format!("/cssapi/v1/mv/tasks/{}/video", run_id)),
    }))
}

pub async fn task_video(Path(run_id): Path<String>) -> Result<impl IntoResponse, ApiError> {
    let video_path = final_video_path(&run_id);
    if !video_path.exists() {
        return Err(ApiError::not_found("VIDEO_NOT_READY", "final mv not ready"));
    }

    let bytes = tokio::fs::read(&video_path)
        .await
        .map_err(|e| ApiError::internal("VIDEO_READ_FAILED", &e.to_string()))?;

    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("video/mp4"));
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    headers.insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_static("inline; filename=\"final_mv.mp4\""),
    );

    Ok((StatusCode::OK, headers, Body::from(bytes)))
}

fn build_api_request(req: &GenerateRequest) -> CreateMvApiRequest {
    let input = if let Some(lyrics) = req.lyrics.as_ref().filter(|value| !value.trim().is_empty()) {
        InputRequest::Text {
            text: lyrics.trim().to_string(),
        }
    } else if let Some(prompt) = req.prompt.as_ref().filter(|value| !value.trim().is_empty()) {
        InputRequest::Text {
            text: prompt.trim().to_string(),
        }
    } else {
        InputRequest::Click
    };

    CreateMvApiRequest {
        engine: EngineRequest {
            name: "cssmv".to_string(),
            version: "v1.0".to_string(),
        },
        input,
        creative: CreativeRequest {
            title: req
                .prompt
                .as_ref()
                .filter(|value| !value.trim().is_empty())
                .map(|value| value.trim().to_string()),
            style: req
                .style
                .as_ref()
                .filter(|value| !value.trim().is_empty())
                .map(|value| value.trim().to_string()),
            ..CreativeRequest::default()
        },
        versions: VersionsRequest {
            langs: req
                .lang
                .as_ref()
                .filter(|value| !value.trim().is_empty())
                .map(|value| vec![value.trim().to_string()])
                .unwrap_or_default(),
            primary_lang: req
                .lang
                .as_ref()
                .filter(|value| !value.trim().is_empty())
                .map(|value| value.trim().to_string()),
            outputs: vec!["mv".to_string()],
            ..VersionsRequest::default()
        },
    }
}

fn load_run_state(run_id: &str) -> Result<RunState, ApiError> {
    let state_path = crate::run_store::run_state_path(run_id);
    crate::run_store::read_run_state(&state_path).map_err(|_| {
        if state_path.exists() {
            ApiError::internal("RUN_READ_FAILED", "failed to read run state")
        } else {
            ApiError::not_found("RUN_NOT_FOUND", "run not found")
        }
    })
}

fn compute_progress(state: &RunState) -> u8 {
    if matches!(state.status, RunStatus::SUCCEEDED) {
        return 100;
    }
    if state.stages.is_empty() {
        return 0;
    }
    let total = state.stages.len() as f32;
    let done = state
        .stages
        .values()
        .filter(|record| matches!(record.status, StageStatus::SUCCEEDED | StageStatus::SKIPPED))
        .count() as f32;
    ((done / total) * 100.0).round().clamp(0.0, 99.0) as u8
}

fn final_video_path(run_id: &str) -> PathBuf {
    crate::run_store::run_dir(run_id)
        .join("build")
        .join("final_mv.mp4")
}
