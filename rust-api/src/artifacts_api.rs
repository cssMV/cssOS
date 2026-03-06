use axum::{
    body::Body,
    extract::Path,
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};
use serde::Serialize;
use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path as StdPath, PathBuf};
use tokio::fs;

use crate::run_state::{Artifact, RunState};
use crate::run_state_io::read_run_state_async;
use crate::run_store::run_state_path;

fn no_store_headers() -> HeaderMap {
    let mut h = HeaderMap::new();
    h.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    h
}

#[derive(Debug, Clone, Serialize)]
pub struct ArtifactItem {
    pub key: String,
    pub kind: String,
    pub path: String,
    pub mime: String,
    pub bytes: u64,
    pub download_url: String,
}

fn guess_mime(path: &str) -> String {
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

fn build_download_url(run_id: &str, key: &str) -> String {
    let enc = utf8_percent_encode(key, NON_ALPHANUMERIC).to_string();
    format!("/cssapi/v1/runs/{}/artifacts/{}", run_id, enc)
}

fn is_within_dir(dir: &StdPath, p: &StdPath) -> bool {
    p.starts_with(dir)
}

async fn resolve_artifact_path(run_dir: &StdPath, raw: &StdPath) -> Option<PathBuf> {
    let joined = if raw.is_absolute() {
        raw.to_path_buf()
    } else {
        run_dir.join(raw)
    };
    let run_dir_canon = fs::canonicalize(run_dir).await.ok()?;
    let file_canon = fs::canonicalize(&joined).await.ok()?;
    if !is_within_dir(&run_dir_canon, &file_canon) {
        return None;
    }
    Some(file_canon)
}

async fn load_run(
    run_id: &str,
) -> Result<(PathBuf, RunState), (StatusCode, HeaderMap, Json<serde_json::Value>)> {
    let state_path = run_state_path(run_id);
    let st = match read_run_state_async(&state_path).await {
        Ok(v) => v,
        Err(_) => {
            let h = no_store_headers();
            let body = serde_json::json!({"schema":"css.error.v1","code":"RUN_NOT_FOUND","run_id":run_id});
            return Err((StatusCode::NOT_FOUND, h, Json(body)));
        }
    };
    let run_dir = match state_path.parent() {
        Some(v) => v.to_path_buf(),
        None => {
            let h = no_store_headers();
            let body = serde_json::json!({"schema":"css.error.v1","code":"RUN_DIR_INVALID","run_id":run_id});
            return Err((StatusCode::INTERNAL_SERVER_ERROR, h, Json(body)));
        }
    };
    Ok((run_dir, st))
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

pub async fn list_artifacts(
    Path(run_id): Path<String>,
) -> impl IntoResponse {
    let (run_dir, st) = match load_run(&run_id).await {
        Ok(v) => v,
        Err(resp) => return resp.into_response(),
    };

    let mut items: Vec<ArtifactItem> = Vec::new();
    let mut used = BTreeMap::<String, usize>::new();
    for a in &st.artifacts {
        let Some(abs) = resolve_artifact_path(&run_dir, &a.path).await else {
            continue;
        };
        let Ok(meta) = fs::metadata(&abs).await else {
            continue;
        };
        if meta.len() == 0 {
            continue;
        }
        let key = dedupe_key(&a.stage, &mut used);
        let path_s = a.path.to_string_lossy().to_string();
        let mime = a.mime.clone().unwrap_or_else(|| guess_mime(&path_s));
        items.push(ArtifactItem {
            key: key.clone(),
            kind: a.kind.clone(),
            path: path_s,
            mime,
            bytes: meta.len(),
            download_url: build_download_url(&run_id, &key),
        });
    }
    let mut by_key = BTreeMap::<String, ArtifactItem>::new();
    let mut present = BTreeSet::<String>::new();
    for it in items {
        if it.bytes > 0 {
            present.insert(it.key.clone());
        }
        by_key.insert(it.key.clone(), it);
    }
    let stable_keys: Vec<String> = crate::artifacts::stable_artifact_keys()
        .into_iter()
        .map(|s| s.to_string())
        .collect();
    let present_keys = crate::artifacts::stable_present_keys(&present);
    let sorted = crate::artifacts::stable_sort_keys(by_key.keys().cloned().collect());
    let mut items: Vec<ArtifactItem> = Vec::new();
    for k in sorted {
        if let Some(v) = by_key.remove(&k) {
            items.push(v);
        }
    }
    let items_ordered = items
        .iter()
        .map(|it| {
            serde_json::json!({
                "key": it.key,
                "record": {
                    "kind": it.kind,
                    "path": it.path,
                    "mime": it.mime,
                    "bytes": it.bytes,
                    "download_url": it.download_url
                }
            })
        })
        .collect::<Vec<_>>();

    let h = no_store_headers();
    (
        StatusCode::OK,
        h,
        Json(serde_json::json!({
            "schema": "css.run.artifacts.v1",
            "run_id": run_id,
            "stable_keys": stable_keys,
            "present_keys": present_keys,
            "items": items,
            "items_ordered": items_ordered
        })),
    )
        .into_response()
}

fn header_inline_filename(name: &str) -> HeaderValue {
    let safe = name.replace('"', "");
    HeaderValue::from_str(&format!("inline; filename=\"{}\"", safe))
        .unwrap_or_else(|_| HeaderValue::from_static("inline"))
}

fn filename_from_path(p: &StdPath) -> String {
    p.file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("artifact.bin")
        .to_string()
}

async fn stream_file_response(mime: &str, p: &StdPath, filename: &str) -> axum::response::Response {
    let mut headers = no_store_headers();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(mime)
            .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream")),
    );
    headers.insert(header::CONTENT_DISPOSITION, header_inline_filename(filename));

    match fs::File::open(p).await {
        Ok(f) => {
            let stream = tokio_util::io::ReaderStream::new(f);
            let body = Body::from_stream(stream);
            (StatusCode::OK, headers, body).into_response()
        }
        Err(_) => {
            let body = serde_json::json!({"schema":"css.error.v1","code":"ARTIFACT_OPEN_FAILED"});
            (StatusCode::NOT_FOUND, headers, Json(body)).into_response()
        }
    }
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

pub async fn download_artifact(
    Path((run_id, key_enc)): Path<(String, String)>,
) -> impl IntoResponse {
    let key = match percent_encoding::percent_decode_str(&key_enc).decode_utf8() {
        Ok(s) => s.to_string(),
        Err(_) => key_enc.clone(),
    };

    let (run_dir, st) = match load_run(&run_id).await {
        Ok(v) => v,
        Err(resp) => return resp.into_response(),
    };

    let Some(artifact) = pick_artifact_for_key(&st.artifacts, &key) else {
        let h = no_store_headers();
        let body = serde_json::json!({"schema":"css.error.v1","code":"ARTIFACT_NOT_FOUND","key":key});
        return (StatusCode::NOT_FOUND, h, Json(body)).into_response();
    };

    let Some(file_path) = resolve_artifact_path(&run_dir, &artifact.path).await else {
        let h = no_store_headers();
        let body =
            serde_json::json!({"schema":"css.error.v1","code":"ARTIFACT_PATH_INVALID","key":key});
        return (StatusCode::FORBIDDEN, h, Json(body)).into_response();
    };

    let bytes = fs::metadata(&file_path).await.ok().map(|m| m.len()).unwrap_or(0);
    if bytes == 0 {
        let h = no_store_headers();
        let body = serde_json::json!({"schema":"css.error.v1","code":"ARTIFACT_EMPTY","key":key});
        return (StatusCode::NOT_FOUND, h, Json(body)).into_response();
    }

    let path_s = artifact.path.to_string_lossy().to_string();
    let mime = artifact
        .mime
        .clone()
        .unwrap_or_else(|| guess_mime(&path_s));

    if let Ok(prefix) = std::env::var("CSS_X_ACCEL_REDIRECT_PREFIX") {
        let mut headers = no_store_headers();
        headers.insert(
            header::CONTENT_TYPE,
            HeaderValue::from_str(&mime)
                .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream")),
        );
        let filename = filename_from_path(&file_path);
        headers.insert(header::CONTENT_DISPOSITION, header_inline_filename(&filename));

        let p = file_path.display().to_string();
        let xr = format!("{}{}", prefix.trim_end_matches('/'), p);
        if let Ok(v) = HeaderValue::from_str(&xr) {
            headers.insert("X-Accel-Redirect", v);
            return (StatusCode::OK, headers, Body::empty()).into_response();
        }
    }

    let filename = filename_from_path(&file_path);
    stream_file_response(&mime, &file_path, &filename).await
}

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
{
    Router::new()
        .route("/cssapi/v1/runs/:run_id/artifacts", get(list_artifacts))
        .route("/cssapi/v1/runs/:run_id/artifacts/:key", get(download_artifact))
}
