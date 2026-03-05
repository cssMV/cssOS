use crate::run_state::{Artifact, ArtifactRecord, RunState};
use crate::schema_keys::stable_keys_v46_ref;
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use tokio::fs as tokio_fs;

pub fn file_ok(p: &PathBuf) -> bool {
    std::fs::metadata(p)
        .map(|m| m.is_file() && m.len() > 0)
        .unwrap_or(false)
}

pub fn file_ok_at(root: &Path, p: &PathBuf) -> bool {
    let abs = if p.is_absolute() {
        p.clone()
    } else {
        root.join(p)
    };
    file_ok(&abs)
}

pub fn outputs_ok(outputs: &[PathBuf]) -> bool {
    outputs.iter().all(file_ok)
}

pub fn outputs_ok_at(root: &Path, outputs: &[PathBuf]) -> bool {
    outputs.iter().all(|p| file_ok_at(root, p))
}

fn guess_mime(path: &Path) -> Option<String> {
    let s = path.to_string_lossy().to_lowercase();
    if s.ends_with(".mp4") {
        return Some("video/mp4".into());
    }
    if s.ends_with(".wav") {
        return Some("audio/wav".into());
    }
    if s.ends_with(".json") {
        return Some("application/json".into());
    }
    if s.ends_with(".ass") {
        return Some("text/x-ssa".into());
    }
    if s.ends_with(".srt") {
        return Some("application/x-subrip".into());
    }
    None
}

fn guess_kind(path: &Path) -> String {
    let s = path.to_string_lossy().to_lowercase();
    if s.ends_with(".mp4") {
        return "video".into();
    }
    if s.ends_with(".wav") {
        return "audio".into();
    }
    if s.ends_with(".ass") || s.ends_with(".srt") {
        return "subtitles".into();
    }
    if s.ends_with(".json") {
        return "json".into();
    }
    "file".into()
}

pub fn rebuild_artifacts(run_dir: &Path, st: &RunState) -> Vec<Artifact> {
    fn is_allowed_default(rel: &Path) -> bool {
        let s = rel.to_string_lossy();
        s == "build/final_mv.mp4" || s == "build/subtitles.ass" || s == "build/lyrics.json"
    }

    fn is_allowed_extended(rel: &Path) -> bool {
        let s = rel.to_string_lossy();
        if is_allowed_default(rel) {
            return true;
        }
        s == "build/music.wav" || s == "build/vocals.wav" || s == "build/video/video.mp4"
    }

    fn include_extended() -> bool {
        match std::env::var("CSS_ARTIFACTS_EXTENDED") {
            Ok(v) => v == "1" || v.to_lowercase() == "true",
            Err(_) => false,
        }
    }

    fn kind_rank(kind: &str, rel: &Path) -> i32 {
        let s = rel.to_string_lossy();
        if s == "build/final_mv.mp4" {
            return 0;
        }
        match kind {
            "subtitles" => 1,
            "json" => 2,
            "audio" => 3,
            "video" => 4,
            _ => 9,
        }
    }

    let ext = include_extended();
    let allow = |p: &Path| {
        if ext {
            is_allowed_extended(p)
        } else {
            is_allowed_default(p)
        }
    };

    let mut seen = BTreeSet::<String>::new();
    let mut items: Vec<Artifact> = Vec::new();

    for (stage, rec) in &st.stages {
        for rel in &rec.outputs {
            if !allow(rel) {
                continue;
            }
            let abs = run_dir.join(rel);
            if !file_ok(&abs) {
                continue;
            }
            let key = rel.to_string_lossy().to_string();
            if !seen.insert(key) {
                continue;
            }
            let kind = guess_kind(rel);
            items.push(Artifact {
                kind,
                path: rel.clone(),
                stage: stage.clone(),
                mime: guess_mime(&abs),
                meta: serde_json::json!({}),
            });
        }
    }

    items.sort_by(|a, b| {
        let ra = kind_rank(&a.kind, &a.path);
        let rb = kind_rank(&b.kind, &b.path);
        if ra != rb {
            return ra.cmp(&rb);
        }
        a.path.to_string_lossy().cmp(&b.path.to_string_lossy())
    });

    items
}

pub fn artifacts_index(st: &RunState) -> Vec<Artifact> {
    rebuild_artifacts(&st.config.out_dir, st)
}

pub fn build_artifacts_index(st: &mut RunState) {
    st.artifacts = rebuild_artifacts(&st.config.out_dir, st);
}

fn stable_mime_for_path(p: &Path) -> &'static str {
    let s = p.to_string_lossy().to_lowercase();
    if s.ends_with(".mp4") {
        "video/mp4"
    } else if s.ends_with(".wav") {
        "audio/wav"
    } else if s.ends_with(".json") {
        "application/json"
    } else if s.ends_with(".ass") {
        "text/x-ssa"
    } else if s.ends_with(".srt") {
        "application/x-subrip"
    } else {
        "application/octet-stream"
    }
}

fn stage_trace_id(st: &RunState, stage: &str) -> Option<String> {
    st.stages
        .get(stage)
        .and_then(|r| r.meta.get("trace_id"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

async fn record_if_exists(
    st: &mut RunState,
    run_dir: &Path,
    stage: &str,
    key: &str,
    rel: &str,
    kind: &str,
) {
    let rel_path = PathBuf::from(rel);
    let full = run_dir.join(&rel_path);
    let md = match tokio_fs::metadata(&full).await {
        Ok(v) => v,
        Err(_) => return,
    };
    if !md.is_file() || md.len() == 0 {
        return;
    }
    let mime = stable_mime_for_path(&full);
    let mut meta = serde_json::json!({});
    if let Some(tid) = stage_trace_id(st, stage) {
        meta["trace_id"] = serde_json::json!(tid);
    }
    st.set_artifact_record(
        key,
        ArtifactRecord {
            kind: kind.to_string(),
            path: PathBuf::from(rel),
            mime: mime.to_string(),
            bytes: md.len(),
            stage: Some(stage.to_string()),
            meta,
        },
    );
}

pub async fn record_stage_artifacts(st: &mut RunState, run_dir: &Path, stage: &str) {
    match stage {
        "lyrics" | "lyrics_gen" => {
            record_if_exists(
                st,
                run_dir,
                stage,
                "lyrics.json",
                "./build/lyrics.json",
                "lyrics",
            )
            .await;
            record_if_exists(
                st,
                run_dir,
                stage,
                "lyrics.json",
                "./build/lyrics/lyrics.primary.json",
                "lyrics",
            )
            .await;
        }
        "mix" => {
            record_if_exists(st, run_dir, stage, "mix.wav", "./build/mix.wav", "audio").await;
            record_if_exists(
                st,
                run_dir,
                stage,
                "mix.wav",
                "./build/audio/mix.primary.wav",
                "audio",
            )
            .await;
        }
        "subtitles" => {
            record_if_exists(
                st,
                run_dir,
                stage,
                "subtitles.ass",
                "./build/subtitles.ass",
                "subtitles",
            )
            .await;
            record_if_exists(
                st,
                run_dir,
                stage,
                "subtitles.ass",
                "./build/subtitles/subtitles.ass",
                "subtitles",
            )
            .await;
        }
        "video_assemble" => {
            record_if_exists(
                st,
                run_dir,
                stage,
                "video.mp4",
                "./build/video/video.mp4",
                "video",
            )
            .await;
        }
        "render" => {
            record_if_exists(
                st,
                run_dir,
                stage,
                "final.mv",
                "./build/final_mv.mp4",
                "mv",
            )
            .await;
            record_if_exists(
                st,
                run_dir,
                stage,
                "final.mv",
                "./build/final/final_mv.mp4",
                "mv",
            )
            .await;
        }
        _ => {}
    }
}

pub fn stable_artifact_keys() -> Vec<&'static str> {
    stable_keys_v46_ref().to_vec()
}

pub fn stable_order_map() -> BTreeMap<String, usize> {
    let mut m = BTreeMap::new();
    for (i, k) in stable_artifact_keys().into_iter().enumerate() {
        m.insert(k.to_string(), i);
    }
    m
}

pub fn stable_sort_keys(mut keys: Vec<String>) -> Vec<String> {
    let order = stable_order_map();
    keys.sort_by(|a, b| {
        let ia = order.get(a).copied().unwrap_or(usize::MAX);
        let ib = order.get(b).copied().unwrap_or(usize::MAX);
        ia.cmp(&ib).then_with(|| a.cmp(b))
    });
    keys
}

pub fn stable_present_keys(present: &BTreeSet<String>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for k in stable_artifact_keys() {
        if present.contains(k) {
            out.push(k.to_string());
        }
    }
    for k in present {
        if !out.iter().any(|x| x == k) {
            out.push(k.clone());
        }
    }
    out
}

use axum::{
    body::Body,
    extract::Path as AxumPath,
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use tokio::fs;
use tokio_util::io::ReaderStream;

use crate::run_state_io::read_run_state_async;
use crate::run_store::run_state_path;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CappedKeys {
    #[serde(default)]
    pub items: Vec<String>,
    pub total_count: u64,
    pub truncated: bool,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub items_truncated_keys: Vec<String>,
}

impl CappedKeys {
    fn from_items(items: Vec<String>) -> Self {
        Self {
            total_count: items.len() as u64,
            items,
            truncated: false,
            items_truncated_keys: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderedArtifactRecord {
    pub kind: String,
    pub path: String,
    pub mime: String,
    pub bytes: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stage: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub meta: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderedArtifactItem {
    pub key: String,
    pub present: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stage: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub record: Option<OrderedArtifactRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CappedArtifacts {
    #[serde(default)]
    pub items: Vec<OrderedArtifactItem>,
    pub total_count: u64,
    pub truncated: bool,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub items_truncated_keys: Vec<String>,
}

impl CappedArtifacts {
    fn from_items(items: Vec<OrderedArtifactItem>) -> Self {
        Self {
            total_count: items.len() as u64,
            items,
            truncated: false,
            items_truncated_keys: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ArtifactsView {
    pub stable_keys: CappedKeys,
    pub present_keys: CappedKeys,
    pub items_ordered: CappedArtifacts,
}

fn no_store_headers() -> HeaderMap {
    let mut h = HeaderMap::new();
    h.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    h
}

fn guess_mime_str(path: &str) -> String {
    let s = path.to_ascii_lowercase();
    if s.ends_with(".mp4") {
        return "video/mp4".to_string();
    }
    if s.ends_with(".wav") {
        return "audio/wav".to_string();
    }
    if s.ends_with(".json") {
        return "application/json".to_string();
    }
    if s.ends_with(".ass") {
        return "text/x-ssa".to_string();
    }
    if s.ends_with(".srt") {
        return "application/x-subrip".to_string();
    }
    "application/octet-stream".to_string()
}

fn safe_join_run_dir(run_dir: &Path, rel_or_abs: &Path) -> Option<PathBuf> {
    let joined = if rel_or_abs.is_absolute() {
        rel_or_abs.to_path_buf()
    } else {
        run_dir.join(rel_or_abs)
    };
    let canon_run = std::fs::canonicalize(run_dir).ok()?;
    let canon_file = std::fs::canonicalize(&joined).ok()?;
    if !canon_file.starts_with(&canon_run) {
        return None;
    }
    Some(canon_file)
}

fn dedupe_key(stage: &str, used: &mut BTreeMap<String, usize>) -> String {
    let n = used.entry(stage.to_string()).or_insert(0usize);
    *n += 1;
    if *n == 1 {
        stage.to_string()
    } else {
        format!("{}~{}", stage, *n)
    }
}

fn parse_key(key: &str) -> (&str, usize) {
    if let Some((base, suffix)) = key.rsplit_once('~') {
        if let Ok(n) = suffix.parse::<usize>() {
            if n > 0 {
                return (base, n);
            }
        }
    }
    (key, 1)
}

fn pick_artifact_for_key<'a>(artifacts: &'a [Artifact], key: &str) -> Option<&'a Artifact> {
    let (stage, nth) = parse_key(key);
    let mut n = 0usize;
    for a in artifacts {
        if a.stage == stage {
            n += 1;
            if n == nth {
                return Some(a);
            }
        }
    }
    None
}

fn build_items(
    run_dir: &Path,
    artifacts: &[Artifact],
) -> (BTreeMap<String, OrderedArtifactRecord>, BTreeSet<String>) {
    let producer_stage = |a: &Artifact| {
        a.meta
            .get("stage")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    };
    let mut used = BTreeMap::<String, usize>::new();
    let mut by_key = BTreeMap::<String, OrderedArtifactRecord>::new();
    let mut present = BTreeSet::<String>::new();
    for a in artifacts {
        let Some(abs) = safe_join_run_dir(run_dir, &a.path) else {
            continue;
        };
        let Ok(meta) = std::fs::metadata(&abs) else {
            continue;
        };
        if !meta.is_file() || meta.len() == 0 {
            continue;
        }
        let key = dedupe_key(&a.stage, &mut used);
        let path_s = a.path.to_string_lossy().to_string();
        let mime = a
            .mime
            .clone()
            .unwrap_or_else(|| guess_mime_str(&path_s));
        present.insert(key.clone());
        let record = OrderedArtifactRecord {
            kind: a.kind.clone(),
            path: path_s,
            mime,
            bytes: meta.len(),
            stage: producer_stage(a),
            meta: Some(a.meta.clone()),
        };
        by_key.insert(key, record);
    }
    (by_key, present)
}

fn ordered_items(mut by_key: BTreeMap<String, OrderedArtifactRecord>) -> Vec<OrderedArtifactItem> {
    let mut out: Vec<OrderedArtifactItem> = Vec::new();
    for k in stable_artifact_keys() {
        let key = k.to_string();
        let record = by_key.remove(k);
        let stage = record.as_ref().and_then(|r| r.stage.clone());
        out.push(OrderedArtifactItem {
            key,
            present: record.is_some(),
            stage,
            record,
        });
    }
    for (k, record) in by_key {
        let stage = record.stage.clone();
        out.push(OrderedArtifactItem {
            key: k,
            present: true,
            stage,
            record: Some(record),
        });
    }
    out
}

pub fn build_artifacts_view(st: &RunState) -> ArtifactsView {
    let (by_key, present_set) = build_items(&st.config.out_dir, &st.artifacts);
    let stable_keys = stable_artifact_keys()
        .into_iter()
        .map(|s| s.to_string())
        .collect::<Vec<_>>();
    let present_keys = stable_present_keys(&present_set);
    let items_ordered = ordered_items(by_key);
    ArtifactsView {
        stable_keys: CappedKeys::from_items(stable_keys),
        present_keys: CappedKeys::from_items(present_keys),
        items_ordered: CappedArtifacts::from_items(items_ordered),
    }
}

fn accel_redirect_value(prefix: &str, run_id: &str, rel_path: &str) -> Option<HeaderValue> {
    let clean_prefix = prefix.trim_end_matches('/');
    let clean_rel = rel_path.trim_start_matches('/');
    HeaderValue::from_str(&format!("{}/{}/{}", clean_prefix, run_id, clean_rel)).ok()
}

pub async fn list_artifacts(AxumPath(run_id): AxumPath<String>) -> impl IntoResponse {
    let state_path = run_state_path(&run_id);
    let st = match read_run_state_async(&state_path).await {
        Ok(v) => v,
        Err(_) => {
            let body =
                serde_json::json!({"schema":"css.error.v1","code":"RUN_NOT_FOUND","run_id":run_id});
            return (StatusCode::NOT_FOUND, no_store_headers(), Json(body)).into_response();
        }
    };
    let view = build_artifacts_view(&st);
    (StatusCode::OK, no_store_headers(), Json(view)).into_response()
}

pub async fn download_artifact(
    AxumPath((run_id, key)): AxumPath<(String, String)>,
) -> impl IntoResponse {
    let state_path = run_state_path(&run_id);
    let st = match read_run_state_async(&state_path).await {
        Ok(v) => v,
        Err(_) => {
            let body =
                serde_json::json!({"schema":"css.error.v1","code":"RUN_NOT_FOUND","run_id":run_id});
            return (StatusCode::NOT_FOUND, no_store_headers(), Json(body)).into_response();
        }
    };
    let run_dir = match state_path.parent() {
        Some(v) => v.to_path_buf(),
        None => {
            let body =
                serde_json::json!({"schema":"css.error.v1","code":"RUN_DIR_INVALID","run_id":run_id});
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                no_store_headers(),
                Json(body),
            )
                .into_response();
        }
    };

    let Some(artifact) = pick_artifact_for_key(&st.artifacts, &key) else {
        let body = serde_json::json!({
            "schema":"css.error.v1",
            "code":"ARTIFACT_NOT_FOUND",
            "run_id":run_id,
            "key":key
        });
        return (StatusCode::NOT_FOUND, no_store_headers(), Json(body)).into_response();
    };

    let Some(file_path) = safe_join_run_dir(&run_dir, &artifact.path) else {
        let body = serde_json::json!({
            "schema":"css.error.v1",
            "code":"ARTIFACT_PATH_INVALID",
            "run_id":run_id,
            "key":key
        });
        return (StatusCode::BAD_REQUEST, no_store_headers(), Json(body)).into_response();
    };

    let Ok(meta) = fs::metadata(&file_path).await else {
        let body = serde_json::json!({
            "schema":"css.error.v1",
            "code":"ARTIFACT_FILE_MISSING",
            "run_id":run_id,
            "key":key
        });
        return (StatusCode::NOT_FOUND, no_store_headers(), Json(body)).into_response();
    };

    let path_s = artifact.path.to_string_lossy().to_string();
    let mime = artifact
        .mime
        .clone()
        .unwrap_or_else(|| guess_mime_str(&path_s));

    let accel_prefix = std::env::var("CSS_X_ACCEL_PREFIX")
        .ok()
        .or_else(|| std::env::var("CSS_X_ACCEL_REDIRECT_PREFIX").ok());
    if let Some(prefix) = accel_prefix {
        let mut h = no_store_headers();
        h.insert(
            header::CONTENT_TYPE,
            HeaderValue::from_str(&mime)
                .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream")),
        );
        if let Some(v) = accel_redirect_value(&prefix, &st.run_id, &path_s) {
            h.insert("X-Accel-Redirect", v);
            return (StatusCode::OK, h, Body::empty()).into_response();
        }
    }

    let f = match fs::File::open(&file_path).await {
        Ok(v) => v,
        Err(_) => {
            let body = serde_json::json!({
                "schema":"css.error.v1",
                "code":"ARTIFACT_OPEN_FAILED",
                "run_id":run_id,
                "key":key
            });
            return (StatusCode::NOT_FOUND, no_store_headers(), Json(body)).into_response();
        }
    };
    let stream = ReaderStream::new(f);
    let body = Body::from_stream(stream);
    let mut h = no_store_headers();
    h.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(&mime)
            .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream")),
    );
    if let Ok(v) = HeaderValue::from_str(&meta.len().to_string()) {
        h.insert(header::CONTENT_LENGTH, v);
    }
    (StatusCode::OK, h, body).into_response()
}
