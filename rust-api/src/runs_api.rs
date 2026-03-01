use crate::dag::topo_order_v1;
use crate::dsl::compile::CompiledCommands;
use crate::metrics;
use crate::routes::AppState;
use crate::run_state::{
    DagMeta, DagNodeMeta, RetryPolicy, RunConfig, RunState, RunStatus, StageRecord, StageStatus,
};
use crate::run_state_io::save_state_atomic;
use crate::runs_list;
use axum::{
    extract::{Json, Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{fs, path::PathBuf};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateRunRequest {
    #[serde(default)]
    pub input: serde_json::Value,
    #[serde(default)]
    pub commands: serde_json::Value,
    #[serde(default)]
    pub video: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RunResponse {
    pub schema: String,
    pub run_id: String,
    pub run_dir: String,
}

fn runs_root(state: &AppState) -> PathBuf {
    state.config.runs_dir.clone()
}

fn run_dir(state: &AppState, run_id: &str) -> PathBuf {
    runs_root(state).join(run_id)
}

fn video_defaults() -> Value {
    json!({
        "shots_n": std::env::var("VIDEO_SHOTS").ok().and_then(|v| v.parse::<u32>().ok()).unwrap_or(12),
        "fps": std::env::var("VIDEO_FPS").ok().and_then(|v| v.parse::<u32>().ok()).unwrap_or(30),
        "w": std::env::var("VIDEO_W").ok().and_then(|v| v.parse::<u32>().ok()).unwrap_or(1280),
        "h": std::env::var("VIDEO_H").ok().and_then(|v| v.parse::<u32>().ok()).unwrap_or(720),
        "resolution": {
            "w": std::env::var("VIDEO_W").ok().and_then(|v| v.parse::<u32>().ok()).unwrap_or(1280),
            "h": std::env::var("VIDEO_H").ok().and_then(|v| v.parse::<u32>().ok()).unwrap_or(720)
        },
        "seed": std::env::var("VIDEO_SEED").ok().and_then(|v| v.parse::<u64>().ok()).unwrap_or(123),
        "duration_s": std::env::var("VIDEO_DURATION_S").ok().and_then(|v| v.parse::<f64>().ok()).unwrap_or(24.0),
        "subtitles": {
            "format": "ass",
            "burnin": false
        }
    })
}

fn v_get_u64(v: &Value, path: &[&str]) -> Option<u64> {
    let mut cur = v;
    for k in path {
        cur = cur.get(*k)?;
    }
    cur.as_u64()
}

fn v_get_u32(v: &Value, path: &[&str]) -> Option<u32> {
    let mut cur = v;
    for k in path {
        cur = cur.get(*k)?;
    }
    cur.as_u64().and_then(|x| u32::try_from(x).ok())
}

fn v_get_f64(v: &Value, path: &[&str]) -> Option<f64> {
    let mut cur = v;
    for k in path {
        cur = cur.get(*k)?;
    }
    cur.as_f64()
        .or_else(|| cur.as_i64().map(|x| x as f64))
        .or_else(|| cur.as_u64().map(|x| x as f64))
}

fn v_set(obj: &mut Value, path: &[&str], value: Value) {
    let mut cur = obj;
    for k in &path[..path.len() - 1] {
        if cur.get(*k).is_none() {
            cur.as_object_mut()
                .expect("commands should be object")
                .insert((*k).to_string(), Value::Object(Default::default()));
        }
        cur = cur.get_mut(*k).expect("path set failed");
    }
    cur.as_object_mut()
        .expect("commands should be object")
        .insert(path[path.len() - 1].to_string(), value);
}

pub async fn create_run(
    State(state): State<AppState>,
    Json(req): Json<CreateRunRequest>,
) -> impl IntoResponse {
    let run_id = Uuid::new_v4().to_string();
    let dir = run_dir(&state, &run_id);

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
    let _ = std::fs::create_dir_all(dir.join("build/subtitles"));

    let compiled: CompiledCommands = match serde_json::from_value(req.commands.clone()) {
        Ok(c) => c,
        Err(_) => match req.commands.get("dsl").and_then(|v| v.as_str()) {
            Some(dsl) => match crate::dsl::compile::compile_from_dsl(dsl) {
                Ok(c) => c,
                Err(e) => {
                    return (
                        StatusCode::BAD_REQUEST,
                        Json(json!({
                            "schema":"css.error.v1",
                            "code":"RUN_COMPILE_FAILED",
                            "message": e.to_string()
                        })),
                    );
                }
            },
            None => crate::dsl::compile::compile_from_dsl(
                "CSS demo :: lyrics()->music()->vocals()->video()->render();",
            )
            .unwrap_or(CompiledCommands {
                lyrics: "mkdir -p ./build && : > ./build/lyrics.json".to_string(),
                music: "mkdir -p ./build && : > ./build/music.wav".to_string(),
                vocals: "mkdir -p ./build && : > ./build/vocals.wav".to_string(),
                video: "mkdir -p ./build/video && : > ./build/video/video.mp4".to_string(),
                render: "mkdir -p ./build && : > ./build/final_mv.mp4".to_string(),
            }),
        },
    };

    let mut commands = json!({
        "schema":"css.pipeline.commands.v1",
        "lyrics": compiled.lyrics.clone(),
        "music": compiled.music.clone(),
        "vocals": compiled.vocals.clone(),
        "video_cmd": compiled.video.clone(),
        "render_cmd": compiled.render.clone(),
        "video": video_defaults()
    });
    if req.video.is_object() {
        v_set(&mut commands, &["video"], req.video.clone());
    }

    let shots_n = v_get_u64(&commands, &["video", "shots_n"])
        .or_else(|| {
            std::env::var("VIDEO_SHOTS")
                .ok()
                .and_then(|s| s.parse::<u64>().ok())
        })
        .unwrap_or(8) as usize;
    let fps = v_get_u32(&commands, &["video", "fps"]).unwrap_or(30);
    let seed = v_get_u64(&commands, &["video", "seed"]).unwrap_or_else(|| {
        (uuid::Uuid::new_v4().as_u128() as u64) ^ (chrono::Utc::now().timestamp_millis() as u64)
    });
    let duration_s = v_get_f64(&commands, &["video", "duration_s"]).unwrap_or(8.0);
    let w = v_get_u32(&commands, &["video", "w"])
        .or_else(|| v_get_u32(&commands, &["video", "resolution", "w"]))
        .unwrap_or(1280);
    let h = v_get_u32(&commands, &["video", "h"])
        .or_else(|| v_get_u32(&commands, &["video", "resolution", "h"]))
        .unwrap_or(720);

    v_set(&mut commands, &["video", "shots_n"], json!(shots_n));
    v_set(&mut commands, &["video", "fps"], json!(fps));
    v_set(&mut commands, &["video", "seed"], json!(seed));
    v_set(&mut commands, &["video", "duration_s"], json!(duration_s));
    v_set(&mut commands, &["video", "w"], json!(w));
    v_set(&mut commands, &["video", "h"], json!(h));
    v_set(&mut commands, &["video", "resolution", "w"], json!(w));
    v_set(&mut commands, &["video", "resolution", "h"], json!(h));
    v_set(
        &mut commands,
        &["video", "subtitles", "format"],
        json!("ass"),
    );
    v_set(
        &mut commands,
        &["video", "subtitles", "burnin"],
        json!(false),
    );
    let mut order: Vec<String> = vec![
        "lyrics".into(),
        "music".into(),
        "vocals".into(),
        "video_plan".into(),
    ];
    for i in 0..shots_n {
        order.push(format!("video_shot_{:03}", i));
    }
    order.push("video_assemble".into());
    order.push("render".into());
    let now = chrono::Utc::now().to_rfc3339();
    let mut run = RunState {
        schema: "css.pipeline.run.v1".to_string(),
        run_id: run_id.clone(),
        created_at: now.clone(),
        updated_at: now,
        status: RunStatus::INIT,
        ui_lang: "auto".to_string(),
        tier: "local".to_string(),
        cssl: "cssapi.runs.v1".to_string(),
        commands: commands.clone(),
        config: RunConfig {
            out_dir: dir.clone(),
            wiki_enabled: true,
            civ_linked: true,
        },
        retry_policy: RetryPolicy {
            max_retries: 3,
            backoff_base_seconds: 2,
            strategy: "exponential".to_string(),
        },
        dag: DagMeta {
            schema: "css.pipeline.dag.v1".to_string(),
            nodes: {
                let mut nodes = vec![
                    DagNodeMeta {
                        name: "lyrics".into(),
                        deps: vec![],
                    },
                    DagNodeMeta {
                        name: "music".into(),
                        deps: vec!["lyrics".into()],
                    },
                    DagNodeMeta {
                        name: "vocals".into(),
                        deps: vec!["lyrics".into(), "music".into()],
                    },
                ];
                for i in 0..shots_n {
                    nodes.push(DagNodeMeta {
                        name: format!("video_shot_{:03}", i),
                        deps: vec!["video_plan".into()],
                    });
                }
                nodes.push(DagNodeMeta {
                    name: "video_assemble".into(),
                    deps: (0..shots_n)
                        .map(|i| format!("video_shot_{:03}", i))
                        .collect(),
                });
                nodes.push(DagNodeMeta {
                    name: "render".into(),
                    deps: vec![
                        "lyrics".into(),
                        "music".into(),
                        "vocals".into(),
                        "video_assemble".into(),
                    ],
                });
                nodes
            },
        },
        topo_order: order,
        stages: Default::default(),
        artifacts: vec![
            PathBuf::from("./build/subtitles/subtitles.ass"),
            PathBuf::from("./build/subtitles/subtitles.srt"),
            PathBuf::from("./build/video/video.mp4"),
            PathBuf::from("./build/final_mv.mp4"),
        ],
        video_shots_total: shots_n as u32,
        video_shots_ready: 0,
        video_shots_running: 0,
    };

    run.stages.insert(
        "lyrics".into(),
        StageRecord {
            status: StageStatus::PENDING,
            started_at: None,
            ended_at: None,
            exit_code: None,
            command: Some(compiled.lyrics.clone()),
            outputs: vec![PathBuf::from("./build/lyrics.json")],
            retries: 0,
            error: None,
            meta: Default::default(),
        },
    );
    run.stages.insert(
        "music".into(),
        StageRecord {
            status: StageStatus::PENDING,
            started_at: None,
            ended_at: None,
            exit_code: None,
            command: Some(compiled.music.clone()),
            outputs: vec![PathBuf::from("./build/music.wav")],
            retries: 0,
            error: None,
            meta: Default::default(),
        },
    );
    run.stages.insert(
        "video_plan".into(),
        StageRecord {
            status: StageStatus::PENDING,
            started_at: None,
            ended_at: None,
            exit_code: None,
            command: None,
            outputs: vec![
                PathBuf::from("./build/video/storyboard.json"),
                PathBuf::from("./build/video/shots.txt"),
            ],
            retries: 0,
            error: None,
            meta: {
                let mut m = std::collections::BTreeMap::new();
                m.insert(
                    "video".to_string(),
                    run.commands
                        .get("video")
                        .cloned()
                        .unwrap_or_else(|| json!({})),
                );
                m
            },
        },
    );
    run.stages.insert(
        "vocals".into(),
        StageRecord {
            status: StageStatus::PENDING,
            started_at: None,
            ended_at: None,
            exit_code: None,
            command: Some(compiled.vocals.clone()),
            outputs: vec![PathBuf::from("./build/vocals.wav")],
            retries: 0,
            error: None,
            meta: Default::default(),
        },
    );
    for i in 0..shots_n {
        let shot = format!("video_shot_{:03}", i);
        let out = PathBuf::from(format!("./build/video/shots/{}.mp4", shot));
        run.stages.insert(
            shot,
            StageRecord {
                status: StageStatus::PENDING,
                started_at: None,
                ended_at: None,
                exit_code: None,
                command: None,
                outputs: vec![out],
                retries: 0,
                error: None,
                meta: Default::default(),
            },
        );
    }
    run.stages.insert(
        "video_assemble".into(),
        StageRecord {
            status: StageStatus::PENDING,
            started_at: None,
            ended_at: None,
            exit_code: None,
            command: None,
            outputs: vec![PathBuf::from("./build/video/video.mp4")],
            retries: 0,
            error: None,
            meta: {
                let mut m = std::collections::BTreeMap::new();
                m.insert("mode".to_string(), json!("concat_copy_then_encode"));
                m
            },
        },
    );
    run.stages.insert(
        "render".into(),
        StageRecord {
            status: StageStatus::PENDING,
            started_at: None,
            ended_at: None,
            exit_code: None,
            command: None,
            outputs: vec![
                PathBuf::from("./build/final_mv.mp4"),
                PathBuf::from("./build/subtitles.ass"),
                PathBuf::from("./build/subtitles.srt"),
            ],
            retries: 0,
            error: None,
            meta: {
                let mut m = std::collections::BTreeMap::new();
                m.insert("mode".to_string(), json!("copy_then_encode"));
                m.insert(
                    "subtitles".to_string(),
                    json!({"format":"ass","burnin":false}),
                );
                m
            },
        },
    );

    v_set(&mut commands, &["video", "shots_total"], json!(shots_n));
    run.commands = commands.clone();
    for rec in run.stages.values_mut() {
        rec.meta.insert("commands".to_string(), commands.clone());
    }

    run.topo_order = topo_order_v1(&run);
    let run_json_path = dir.join("run.json");
    match save_state_atomic(&run_json_path, &run) {
        Ok(_) => {
            metrics::incr_runs_created();
            state.scheduler.enqueue(run_id.clone());
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

pub async fn get_run(
    State(state): State<AppState>,
    Path(run_id): Path<String>,
) -> impl IntoResponse {
    let path = run_dir(&state, &run_id).join("run.json");

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

pub async fn get_run_status(
    State(state): State<AppState>,
    Path(run_id): Path<String>,
) -> impl IntoResponse {
    let path = run_dir(&state, &run_id).join("run.json");

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

pub async fn get_run_ready(
    axum::extract::State(app): axum::extract::State<AppState>,
    Path(run_id): Path<String>,
) -> impl IntoResponse {
    match crate::ready::compute_ready_view_async(app, run_id).await {
        Ok(v) => (axum::http::StatusCode::OK, Json(v)).into_response(),
        Err(e) => {
            let body = json!({"schema":"css.error.v1","error":format!("{e}")});
            (axum::http::StatusCode::NOT_FOUND, Json(body)).into_response()
        }
    }
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/cssapi/v1/runs",
            get(runs_list::list_runs).post(create_run),
        )
        .route("/cssapi/v1/runs/:run_id", get(get_run))
        .route("/cssapi/v1/runs/:run_id/status", get(get_run_status))
        .route("/cssapi/v1/runs/:run_id/ready", get(get_run_ready))
}
