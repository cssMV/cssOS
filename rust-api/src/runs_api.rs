use axum::{
    extract::rejection::JsonRejection,
    extract::{Json, Path, Query},
    http::HeaderMap,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::cmp::Reverse;
use std::fs;
use std::path::PathBuf;
use std::time::SystemTime;
use utoipa::ToSchema;

use crate::cssapi::error::ApiError;
use crate::cssapi::error_map::map_io;
#[allow(unused_imports)]
use crate::cssapi::problem::Problem;
use crate::cssapi::response::ApiResult;
use crate::dag::topo_order_v1;
use crate::events;
use crate::run_state::{RetryPolicy, RunConfig, RunState, RunStatus, StageRecord, StageStatus};
use crate::{jobs, metrics, ready, run_store, runner};

fn env_u64(k: &str, d: u64) -> u64 {
    std::env::var(k)
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(d)
}
fn env_usize(k: &str, d: usize) -> usize {
    std::env::var(k)
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(d)
}
fn env_u32(k: &str, d: u32) -> u32 {
    std::env::var(k)
        .ok()
        .and_then(|v| v.parse::<u32>().ok())
        .unwrap_or(d)
}
fn env_f64(k: &str, d: f64) -> f64 {
    std::env::var(k)
        .ok()
        .and_then(|v| v.parse::<f64>().ok())
        .unwrap_or(d)
}

#[derive(Debug, Deserialize)]
pub struct RunsCreateRequest {
    pub cssl: String,
    pub ui_lang: Option<String>,
    pub tier: Option<String>,
    pub options: Option<Value>,
    pub config: Option<RunConfig>,
    pub retry_policy: Option<RetryPolicy>,
    pub commands: Option<Value>,
}

pub fn suggest_langs_for(detected: &str) -> Vec<String> {
    match detected {
        "zh" | "zh-cn" | "zh-tw" | "zh-CN" | "zh-TW" => vec!["en", "ja", "ko", "fr"],
        "ja" => vec!["zh", "en", "ko", "fr"],
        "ko" => vec!["zh", "en", "ja", "fr"],
        "fr" => vec!["en", "zh", "ja", "ko"],
        _ => vec!["zh", "ja", "ko", "fr"],
    }
    .into_iter()
    .map(|s| s.to_string())
    .collect()
}

fn voice_extract(req_commands: &Value) -> Option<(String, u64, String, String)> {
    let v = req_commands.get("voice")?;
    let mime = v
        .get("mime")
        .and_then(|x| x.as_str())
        .unwrap_or("audio/webm")
        .to_string();
    let bytes = v.get("bytes").and_then(|x| x.as_u64()).unwrap_or(0);
    let b64 = v
        .get("b64")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    let mode = v
        .get("mode")
        .and_then(|x| x.as_str())
        .unwrap_or("single")
        .to_string();
    Some((mime, bytes, b64, mode))
}

fn b64_decode(s: &str) -> Option<Vec<u8>> {
    if s.is_empty() {
        return None;
    }
    base64::engine::general_purpose::STANDARD.decode(s).ok()
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
    summary_text: String,
    video_shots: ready::VideoShotsSummary,
    counters: ready::ReadyCounters,
    running_pids: Vec<ready::RunningPid>,
    mix: ready::MixSummary,
    subtitles: ready::SubtitlesSummary,
    blocking: Vec<ready::BlockingItem>,
    stage_seq: u64,
    last_event: Option<ready::ReadyEvent>,
    event: Option<String>,
    artifacts: serde_json::Value,
    failures: Vec<ReadyFailure>,
    cancel_requested: bool,
    cancelled_at: Option<String>,
    updated_at: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ReadyFailure {
    stage: String,
    error: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct RunReadyQuery {
    pub since_seq: Option<u64>,
}

#[derive(Debug, Serialize)]
struct CancelResponse {
    schema: &'static str,
    run_id: String,
    cancel_requested: bool,
    already_done: bool,
    status: String,
    stage_seq: u64,
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
    headers: HeaderMap,
    Query(q): Query<RunsListQuery>,
) -> ApiResult<RunsListResponse> {
    let _lang = crate::i18n::pick_lang(None, &headers, None);
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
    headers: HeaderMap,
    body: Result<Json<RunsCreateRequest>, JsonRejection>,
) -> Result<(StatusCode, Json<RunsCreateResponse>), ApiError> {
    let lang = crate::i18n::pick_lang(None, &headers, None);
    let Json(body) = body.map_err(|e| {
        ApiError::unprocessable(
            "INVALID_REQUEST",
            crate::i18n::t(lang, "invalid_request_body"),
        )
        .with_details(serde_json::json!({
            "reason": e.body_text()
        }))
    })?;

    if jobs::queue::queued_or_running_count().await > 20 {
        return Err(ApiError::too_many_requests(
            "SYSTEM_BUSY",
            crate::i18n::t(lang, "too_many_runs"),
        ));
    }

    let run_id = runner::new_run_id();
    run_store::ensure_run_dir(&run_id).map_err(map_io)?;

    let mut cssl = body.cssl.trim().to_string();
    if cssl.is_empty() {
        let seed = uuid::Uuid::new_v4().to_string();
        cssl = format!("Untitled {}", &seed[..8]);
    }

    let mut run_state = runner::init_run_state(
        run_id.clone(),
        body.ui_lang.unwrap_or_else(|| "en".to_string()),
        body.tier.unwrap_or_else(|| "basic".to_string()),
        cssl.clone(),
    );
    run_state.cssl = cssl.clone();

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

    let legacy_compiled = body.commands.as_ref().and_then(|v| {
        serde_json::from_value::<crate::dsl::compile::CompiledCommands>(v.clone()).ok()
    });
    let mut compiled = legacy_compiled.unwrap_or(crate::dsl::compile::CompiledCommands {
        lyrics:
            "mkdir -p ./build && printf '%s\\n' '{\"schema\":\"css.lyrics.v1\",\"lines\":[\"demo\"]}' > ./build/lyrics.json"
                .to_string(),
        music: "mkdir -p ./build && ffmpeg -y -hide_banner -loglevel error -f lavfi -i anullsrc=r=48000:cl=stereo -t 8 -c:a pcm_s16le ./build/music.wav".to_string(),
        vocals: "mkdir -p ./build && ffmpeg -y -hide_banner -loglevel error -f lavfi -i anullsrc=r=48000:cl=stereo -t 8 -c:a pcm_s16le ./build/vocals.wav".to_string(),
        video: "echo \"video handled by video executor\"".to_string(),
        render: "echo \"render handled by runner\"".to_string(),
    });

    let detected_lang = run_state.ui_lang.clone();
    let primary_lang = detected_lang.clone();
    let suggest_langs = suggest_langs_for(&detected_lang);
    let mut commands = serde_json::json!({
        "schema":"css.commands.v1",
        "lyrics": {
            "command": compiled.lyrics.clone(),
            "detected_lang": detected_lang,
            "primary_lang": primary_lang,
            "suggest_langs": suggest_langs
        },
        "music": compiled.music.clone(),
        "vocals": compiled.vocals.clone(),
        "render": compiled.render.clone(),
        "video": {
            "schema":"css.video.commands.v1",
            "shots_n": env_usize("VIDEO_SHOTS", 8),
            "resolution": { "w": env_u32("VIDEO_W", 1280), "h": env_u32("VIDEO_H", 720) },
            "fps": env_u32("VIDEO_FPS", 30),
            "seed": env_u64("VIDEO_SEED", 123),
            "duration_s": env_f64("VIDEO_DURATION_S", 8.0),
            "storyboard_path": "./build/video/storyboard.json",
            "shots_dir": "./build/video/shots",
            "shots_list_path": "./build/video/shots.txt",
            "out_mp4": "./build/video/video.mp4"
        }
    });
    if let Some(v) = body.options.as_ref().and_then(|o| o.get("video")) {
        if let Some(x) = v.get("shots_n").and_then(|x| x.as_u64()) {
            commands["video"]["shots_n"] = serde_json::json!(x as usize);
        }
        if let Some(x) = v.get("fps").and_then(|x| x.as_u64()) {
            commands["video"]["fps"] = serde_json::json!(x as u32);
        }
        if let Some(x) = v.get("seed").and_then(|x| x.as_u64()) {
            commands["video"]["seed"] = serde_json::json!(x);
        }
        if let Some(x) = v.get("duration_s").and_then(|x| x.as_f64()) {
            commands["video"]["duration_s"] = serde_json::json!(x);
        }
        if let Some(r) = v.get("resolution") {
            if let Some(x) = r.get("w").and_then(|x| x.as_u64()) {
                commands["video"]["resolution"]["w"] = serde_json::json!(x as u32);
            }
            if let Some(x) = r.get("h").and_then(|x| x.as_u64()) {
                commands["video"]["resolution"]["h"] = serde_json::json!(x as u32);
            }
        }
    }
    if let Some(v) = body.commands.as_ref().and_then(|o| o.get("video")) {
        if let Some(x) = v.get("shots_n").and_then(|x| x.as_u64()) {
            commands["video"]["shots_n"] = serde_json::json!(x as usize);
        }
        if let Some(x) = v.get("fps").and_then(|x| x.as_u64()) {
            commands["video"]["fps"] = serde_json::json!(x as u32);
        }
        if let Some(x) = v.get("seed").and_then(|x| x.as_u64()) {
            commands["video"]["seed"] = serde_json::json!(x);
        }
        if let Some(x) = v.get("duration_s").and_then(|x| x.as_f64()) {
            commands["video"]["duration_s"] = serde_json::json!(x);
        }
        if let Some(r) = v.get("resolution") {
            if let Some(x) = r.get("w").and_then(|x| x.as_u64()) {
                commands["video"]["resolution"]["w"] = serde_json::json!(x as u32);
            }
            if let Some(x) = r.get("h").and_then(|x| x.as_u64()) {
                commands["video"]["resolution"]["h"] = serde_json::json!(x as u32);
            }
        }
    }
    let shots_n = commands["video"]["shots_n"]
        .as_u64()
        .unwrap_or(8)
        .clamp(1, 256) as usize;
    let fps = commands["video"]["fps"]
        .as_u64()
        .unwrap_or(30)
        .clamp(1, 120) as u32;
    let seed = commands["video"]["seed"].as_u64().unwrap_or(123);
    let duration_s = commands["video"]["duration_s"]
        .as_f64()
        .filter(|v| v.is_finite())
        .unwrap_or(8.0)
        .clamp(1.0, 600.0);
    let w = commands["video"]["resolution"]["w"]
        .as_u64()
        .unwrap_or(1280)
        .clamp(160, 7680) as u32;
    let h = commands["video"]["resolution"]["h"]
        .as_u64()
        .unwrap_or(720)
        .clamp(90, 4320) as u32;
    commands["video"]["shots_n"] = serde_json::json!(shots_n);
    commands["video"]["fps"] = serde_json::json!(fps);
    commands["video"]["seed"] = serde_json::json!(seed);
    commands["video"]["duration_s"] = serde_json::json!(duration_s);
    commands["video"]["resolution"]["w"] = serde_json::json!(w);
    commands["video"]["resolution"]["h"] = serde_json::json!(h);

    let music_cmd = format!(
        "mkdir -p ./build && ffmpeg -y -hide_banner -loglevel error -f lavfi -i anullsrc=r=48000:cl=stereo -t {} -c:a pcm_s16le ./build/music.wav",
        duration_s
    );
    let vocals_cmd = format!(
        "mkdir -p ./build && ffmpeg -y -hide_banner -loglevel error -f lavfi -i anullsrc=r=48000:cl=stereo -t {} -c:a pcm_s16le ./build/vocals.wav",
        duration_s
    );
    compiled.music = music_cmd.clone();
    compiled.vocals = vocals_cmd.clone();
    commands["music"] = serde_json::json!(music_cmd);
    commands["vocals"] = serde_json::json!(vocals_cmd);
    if let Some(cmd) = body.commands.as_ref() {
        if let Some(lyrics) = cmd.get("lyrics").and_then(|v| v.as_object()) {
            if let Some(s) = lyrics.get("detected_lang").and_then(|x| x.as_str()) {
                commands["lyrics"]["detected_lang"] = serde_json::json!(s);
            }
            if let Some(s) = lyrics.get("primary_lang").and_then(|x| x.as_str()) {
                commands["lyrics"]["primary_lang"] = serde_json::json!(s);
            }
            if let Some(a) = lyrics.get("suggest_langs").and_then(|x| x.as_array()) {
                commands["lyrics"]["suggest_langs"] = serde_json::json!(a);
            }
        }
        if let Some(voice) = cmd.get("voice") {
            commands["voice"] = voice.clone();
        }
    }

    run_state.commands = commands.clone();

    if let Some(rec) = run_state.stages.get_mut("lyrics") {
        rec.status = StageStatus::PENDING;
        rec.command = commands["lyrics"]
            .get("command")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .or_else(|| {
                commands
            .get("lyrics")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            });
        rec.outputs = vec![PathBuf::from("./build/lyrics.json")];
    }
    if let Some(rec) = run_state.stages.get_mut("music") {
        rec.status = StageStatus::PENDING;
        rec.command = Some(music_cmd);
        rec.outputs = vec![PathBuf::from("./build/music.wav")];
    }
    if let Some(rec) = run_state.stages.get_mut("vocals") {
        rec.status = StageStatus::PENDING;
        rec.command = Some(vocals_cmd);
        rec.outputs = vec![PathBuf::from("./build/vocals.wav")];
    }
    run_state.stages.insert(
        "video_plan".into(),
        StageRecord {
            status: StageStatus::PENDING,
            started_at: None,
            ended_at: None,
            exit_code: None,
            command: None,
            outputs: vec![PathBuf::from("./build/video/storyboard.json")],
            retries: 0,
            error: None,
            heartbeat_at: None,
            last_heartbeat_at: None,
            timeout_seconds: Some(run_state.config.stage_timeout_seconds),
            error_code: None,
            pid: None,
            pgid: None,
            meta: Value::Object(Default::default()),
            duration_seconds: None,
        },
    );

    for i in 0..shots_n {
        let shot = format!("video_shot_{:03}", i);
        let out = PathBuf::from(format!("./build/video/shots/{shot}.mp4"));
        run_state.stages.insert(
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
                heartbeat_at: None,
                last_heartbeat_at: None,
                timeout_seconds: Some(run_state.config.stage_timeout_seconds),
                error_code: None,
                pid: None,
                pgid: None,
                meta: Value::Object(Default::default()),
                duration_seconds: None,
            },
        );
    }
    run_state.stages.insert(
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
            heartbeat_at: None,
            last_heartbeat_at: None,
            timeout_seconds: Some(run_state.config.stage_timeout_seconds),
            error_code: None,
            pid: None,
            pgid: None,
            meta: Value::Object(Default::default()),
            duration_seconds: None,
        },
    );
    run_state.stages.insert(
        "subtitles".into(),
        StageRecord {
            status: StageStatus::PENDING,
            started_at: None,
            ended_at: None,
            exit_code: None,
            command: None,
            outputs: vec![PathBuf::from("./build/subtitles.ass")],
            retries: 0,
            error: None,
            heartbeat_at: None,
            last_heartbeat_at: None,
            timeout_seconds: Some(run_state.config.stage_timeout_seconds),
            error_code: None,
            pid: None,
            pgid: None,
            meta: Value::Object(Default::default()),
            duration_seconds: None,
        },
    );
    run_state.stages.insert(
        "mix".into(),
        StageRecord {
            status: StageStatus::PENDING,
            started_at: None,
            ended_at: None,
            exit_code: None,
            command: None,
            outputs: vec![PathBuf::from("./build/mix.wav")],
            retries: 0,
            error: None,
            heartbeat_at: None,
            last_heartbeat_at: None,
            timeout_seconds: Some(run_state.config.stage_timeout_seconds),
            error_code: None,
            pid: None,
            pgid: None,
            meta: Value::Object(Default::default()),
            duration_seconds: None,
        },
    );
    if let Some(rec) = run_state.stages.get_mut("render") {
        rec.status = StageStatus::PENDING;
        rec.command = None;
        rec.outputs = vec![PathBuf::from("./build/final_mv.mp4")];
    }
    for rec in run_state.stages.values_mut() {
        if let Some(map) = rec.meta.as_object_mut() {
            map.insert("commands".into(), commands.clone());
        }
    }
    let mut dag_nodes: Vec<crate::run_state::DagNodeMeta> = vec![
        crate::run_state::DagNodeMeta {
            name: "lyrics".to_string(),
            deps: vec![],
        },
        crate::run_state::DagNodeMeta {
            name: "music".to_string(),
            deps: vec!["lyrics".to_string()],
        },
        crate::run_state::DagNodeMeta {
            name: "vocals".to_string(),
            deps: vec!["lyrics".to_string(), "music".to_string()],
        },
        crate::run_state::DagNodeMeta {
            name: "video_plan".to_string(),
            deps: vec!["lyrics".to_string(), "vocals".to_string()],
        },
    ];
    let mut shot_names: Vec<String> = Vec::new();
    for i in 0..shots_n {
        let shot = format!("video_shot_{:03}", i);
        shot_names.push(shot.clone());
        dag_nodes.push(crate::run_state::DagNodeMeta {
            name: shot,
            deps: vec!["video_plan".to_string()],
        });
    }
    dag_nodes.push(crate::run_state::DagNodeMeta {
        name: "video_assemble".to_string(),
        deps: shot_names.clone(),
    });
    dag_nodes.push(crate::run_state::DagNodeMeta {
        name: "subtitles".to_string(),
        deps: vec!["lyrics".to_string()],
    });
    dag_nodes.push(crate::run_state::DagNodeMeta {
        name: "mix".to_string(),
        deps: vec!["music".to_string(), "vocals".to_string()],
    });
    dag_nodes.push(crate::run_state::DagNodeMeta {
        name: "render".to_string(),
        deps: vec![
            "lyrics".to_string(),
            "music".to_string(),
            "vocals".to_string(),
            "video_assemble".to_string(),
            "subtitles".to_string(),
        ],
    });
    run_state.dag.nodes = dag_nodes;
    run_state.dag_edges.clear();
    for n in &run_state.dag.nodes {
        run_state.dag_edges.insert(n.name.clone(), n.deps.clone());
    }
    run_state.video_shots_total = Some(shots_n as u32);
    run_state.topo_order = topo_order_v1(&run_state);

    if let Some(req_cmd) = body.commands.as_ref() {
        if let Some((mime, bytes, b64, mode)) = voice_extract(req_cmd) {
            let out = run_store::run_dir(&run_id).join("build").join("voice.webm");
            if let Some(parent) = out.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let data = b64_decode(&b64).unwrap_or_default();
            if !data.is_empty() {
                let _ = fs::write(&out, &data);
                run_state.set_artifact_path(
                    "voice",
                    serde_json::json!({
                        "path":"./build/voice.webm",
                        "mime": mime,
                        "bytes": data.len(),
                        "mode": mode
                    }),
                );
            } else {
                run_state.set_artifact_path(
                    "voice",
                    serde_json::json!({
                        "path":"./build/voice.webm",
                        "mime": mime,
                        "bytes": bytes,
                        "mode": mode
                    }),
                );
            }
        }
    }

    if body
        .commands
        .as_ref()
        .and_then(|v| v.get("voice"))
        .is_some()
    {
        let ts = chrono::Utc::now().to_rfc3339();
        let title = run_state.cssl.clone();
        let source = if body
            .commands
            .as_ref()
            .and_then(|v| v.pointer("/voice/bytes"))
            .and_then(|x| x.as_u64())
            .unwrap_or(0)
            > 0
        {
            "voice"
        } else {
            "random"
        };
        run_state.updated_at = ts.clone();
        crate::events::bump_event(
            &mut run_state,
            crate::events::EventKind::VoiceSubmitted,
            "voice",
            "submitted",
            ts,
            Some(serde_json::json!({
                "source": source,
                "title": title
            })),
        );
    }

    let state_path = run_store::run_state_path(&run_id);
    run_store::write_run_state(&state_path, &run_state).map_err(map_io)?;
    events::emit_snapshot(&run_state);
    run_store::write_compiled_commands(&run_id, &compiled).map_err(map_io)?;

    if !jobs::queue::claim_run(&run_id).await {
        return Err(ApiError::conflict(
            "CONFLICT",
            crate::i18n::t(lang, "run_already_queued"),
        ));
    }

    jobs::queue::push_run(run_id.clone(), run_state.tier.clone())
        .await
        .map_err(|_| {
            ApiError::internal(
                "QUEUE_PUSH_FAILED",
                crate::i18n::t(lang, "queue_push_failed"),
            )
        })?;

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
pub async fn runs_get(headers: HeaderMap, Path(run_id): Path<String>) -> ApiResult<RunState> {
    let lang = crate::i18n::pick_lang(None, &headers, None);
    let p = run_store::run_state_path(&run_id);
    let mut s = run_store::read_run_state(&p).map_err(|_| {
        if p.exists() {
            ApiError::internal("RUN_READ_FAILED", crate::i18n::t(lang, "run_read_failed"))
        } else {
            ApiError::not_found("RUN_NOT_FOUND", crate::i18n::t(lang, "run_not_found"))
        }
    })?;
    crate::artifacts::build_artifacts_index(&mut s);
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
    headers: HeaderMap,
    Path(run_id): Path<String>,
) -> ApiResult<RunsStatusResponse> {
    let lang = crate::i18n::pick_lang(None, &headers, None);
    let p = run_store::run_state_path(&run_id);
    let s = run_store::read_run_state(&p).map_err(|_| {
        if p.exists() {
            ApiError::internal("RUN_READ_FAILED", crate::i18n::t(lang, "run_read_failed"))
        } else {
            ApiError::not_found("RUN_NOT_FOUND", crate::i18n::t(lang, "run_not_found"))
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
        ("run_id" = String, Path, description = "Run ID"),
        ("since_seq" = Option<u64>, Query, description = "Long-poll cursor")
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
    headers: HeaderMap,
    Path(run_id): Path<String>,
    Query(q): Query<RunReadyQuery>,
) -> Result<axum::response::Response, ApiError> {
    let state_path = run_store::run_state_path(&run_id);
    let mut state = run_store::read_run_state(&state_path).map_err(|_| {
        let lang = crate::i18n::pick_lang(None, &headers, None);
        if state_path.exists() {
            ApiError::internal("RUN_READ_FAILED", crate::i18n::t(lang, "run_read_failed"))
        } else {
            ApiError::not_found("RUN_NOT_FOUND", crate::i18n::t(lang, "run_not_found"))
        }
    })?;

    if let Some(since) = q.since_seq {
        if state.stage_seq == since {
            if let Some((leader, wall_s)) = ready::compute_slowest_leader(&state) {
                let warn_s = state.config.stuck_timeout_seconds.max(1);
                let status = state
                    .stages
                    .get(&leader)
                    .map(|r| match r.status {
                        crate::run_state::StageStatus::PENDING => "pending",
                        crate::run_state::StageStatus::RUNNING => "running",
                        crate::run_state::StageStatus::SUCCEEDED => "succeeded",
                        crate::run_state::StageStatus::FAILED => "failed",
                        crate::run_state::StageStatus::SKIPPED => {
                            if r.error_code.as_deref() == Some("CANCELLED")
                                || r.error_code.as_deref() == Some("CANCELLED_KILLED")
                            {
                                "cancelled"
                            } else {
                                "skipped"
                            }
                        }
                    })
                    .unwrap_or("unknown");

                let bucket = if status == "running" && wall_s >= warn_s as f64 {
                    ((wall_s as u64).saturating_sub(warn_s)) / 10
                } else {
                    0
                };
                let changed = state.slowest_leader.as_deref() != Some(leader.as_str())
                    || (status == "running"
                        && wall_s >= warn_s as f64
                        && state.slowest_tick.unwrap_or(u64::MAX) != bucket);
                if changed {
                    state.slowest_leader = Some(leader.clone());
                    state.slowest_tick = Some(bucket);
                    let timeline_total_s = ready::compute_timeline_total_wall_s(&state);
                    let ts = chrono::Utc::now().to_rfc3339();
                    state.updated_at = ts.clone();
                    crate::events::bump_event(
                        &mut state,
                        crate::events::EventKind::Slowest,
                        "slowest",
                        "changed",
                        ts,
                        Some(serde_json::json!({
                            "stage": leader,
                            "status": status,
                            "elapsed_s": wall_s,
                            "threshold_s": warn_s,
                            "warn": wall_s >= warn_s as f64,
                            "bucket": bucket,
                            "timeline_total_s": timeline_total_s
                        })),
                    );
                    let _ = run_store::write_run_state(&state_path, &state);
                }
            }
            if state.stage_seq == since {
                let mut resp = StatusCode::NO_CONTENT.into_response();
                resp.headers_mut().insert(
                    axum::http::header::CACHE_CONTROL,
                    "no-store".parse().unwrap(),
                );
                return Ok(resp);
            }
        }
    }

    let lang = crate::i18n::pick_lang(None, &headers, Some(&state.ui_lang));
    let dag = crate::dag::cssmv_dag_v1();
    let view = ready::compute_ready_view_with_dag_limited(&state, &dag, 64);
    let failures = ready::collect_failures(&state)
        .into_iter()
        .map(|(stage, error)| ReadyFailure { stage, error })
        .collect::<Vec<_>>();
    let summary_text = ready::build_summary_i18n(&state, &view, lang);

    let mut resp = Json(RunReadyResponse {
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
        summary_text,
        video_shots: view.video_shots,
        counters: view.counters,
        running_pids: view.running_pids,
        mix: view.mix,
        subtitles: view.subtitles,
        blocking: view.blocking,
        stage_seq: view.stage_seq,
        event: view.last_event.as_ref().map(|e| {
            let k = match e.kind {
                crate::events::EventKind::Stage => "stage",
                crate::events::EventKind::VoiceSubmitted => "voice_submitted",
                crate::events::EventKind::Gate => "gate",
                crate::events::EventKind::Failed => "failed",
                crate::events::EventKind::Cancelled => "cancelled",
                crate::events::EventKind::Timeout => "timeout",
                crate::events::EventKind::Heartbeat => "heartbeat",
                crate::events::EventKind::Slowest => "slowest",
            };
            format!("{}:{}:{}", k, e.stage, e.status)
        }),
        last_event: view.last_event,
        artifacts: serde_json::to_value(state.artifacts.clone())
            .unwrap_or_else(|_| serde_json::json!([])),
        failures,
        cancel_requested: state.cancel_requested,
        cancelled_at: state.cancel_requested_at.clone(),
        updated_at: state.updated_at,
    })
    .into_response();
    resp.headers_mut().insert(
        axum::http::header::CACHE_CONTROL,
        "no-store".parse().unwrap(),
    );
    Ok(resp)
}

async fn run_cancel(
    headers: HeaderMap,
    Path(run_id): Path<String>,
) -> Result<(StatusCode, Json<CancelResponse>), ApiError> {
    let lang = crate::i18n::pick_lang(None, &headers, None);
    let p = run_store::run_state_path(&run_id);
    if !p.exists() {
        return Err(ApiError::not_found(
            "RUN_NOT_FOUND",
            crate::i18n::t(lang, "run_not_found"),
        ));
    }
    let mut s = run_store::read_run_state(&p)
        .map_err(|_| ApiError::not_found("RUN_NOT_FOUND", crate::i18n::t(lang, "run_not_found")))?;
    if matches!(
        s.status,
        RunStatus::SUCCEEDED | RunStatus::FAILED | RunStatus::CANCELLED
    ) {
        return Ok((
            StatusCode::OK,
            Json(CancelResponse {
                schema: "cssapi.runs.cancel.v1",
                run_id,
                cancel_requested: s.cancel_requested,
                already_done: true,
                status: format!("{:?}", s.status),
                stage_seq: s.stage_seq,
            }),
        ));
    }
    if !s.cancel_requested {
        s.cancel_requested = true;
        s.cancel_requested_at = Some(chrono::Utc::now().to_rfc3339());
        s.updated_at = chrono::Utc::now().to_rfc3339();
        let ts = s.updated_at.clone();
        crate::events::bump_event(
            &mut s,
            crate::events::EventKind::Cancelled,
            "run",
            "cancel_requested",
            ts,
            Some(serde_json::json!({"cancel_requested": true})),
        );
    }
    run_store::write_run_state(&p, &s).map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            ApiError::not_found("RUN_NOT_FOUND", crate::i18n::t(lang, "run_not_found"))
        } else {
            map_io(e)
        }
    })?;

    Ok((
        StatusCode::ACCEPTED,
        Json(CancelResponse {
            schema: "cssapi.runs.cancel.v1",
            run_id,
            cancel_requested: true,
            already_done: false,
            status: format!("{:?}", s.status),
            stage_seq: s.stage_seq,
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
