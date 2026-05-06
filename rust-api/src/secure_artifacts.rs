//! CSSOS_PHASE_C_4_SECURE_ARTIFACTS 20260506 — Jing
//!
//! Rust mirror of Express's `/secure/artifacts/:wid/:file` route.
//! Validates the HMAC token (see `media_signing`), then either:
//!   - sends the original artifact (full kind), or
//!   - sends a cached `<sha1>.preview.mp4` clip (preview kind),
//!     spawning ffmpeg the first time the clip is missing.
//!
//! Stays byte-compatible with the Express route so D-cutover can flip
//! nginx upstream without breaking any in-flight signed URL.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use axum::{
    extract::{Path as AxumPath, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use tokio::sync::Mutex;

use crate::media_signing::{
    artifacts_dir, preview_cache_dir, preview_limit_seconds, verify_media_token, AccessKind,
};
use crate::routes::AppState;

#[derive(Debug, Deserialize)]
pub struct SecureQuery {
    pub t: Option<String>,
    pub e: Option<i64>,
    pub k: Option<String>,
}

/// In-memory de-duplication of in-flight ffmpeg jobs. Two concurrent
/// preview requests for the same source file converge on a single
/// ffmpeg run instead of stomping each other's output.
type ClipLockMap = Arc<Mutex<HashMap<PathBuf, Arc<tokio::sync::Mutex<()>>>>>;

#[derive(Clone)]
pub struct SecureArtifactsState {
    pub clip_locks: ClipLockMap,
}

impl Default for SecureArtifactsState {
    fn default() -> Self {
        Self {
            clip_locks: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

pub fn router() -> Router<AppState> {
    Router::new().route("/secure/artifacts/:wid/:file", get(secure_artifacts_handler))
}

fn json_err(status: StatusCode, code: &str) -> Response {
    let body = format!("{{\"ok\":false,\"code\":\"{}\"}}", code);
    let mut resp = (status, body).into_response();
    resp.headers_mut()
        .insert(header::CONTENT_TYPE, "application/json".parse().unwrap());
    resp.headers_mut()
        .insert(header::CACHE_CONTROL, "no-store".parse().unwrap());
    resp
}

fn safe_segment(s: &str) -> bool {
    !s.is_empty() && !s.contains("..") && !s.contains('/') && !s.contains('\\')
}

fn valid_work_id(s: &str) -> bool {
    if s.is_empty() || s.len() < 8 || s.len() > 64 {
        return false;
    }
    s.chars().all(|c| c.is_ascii_hexdigit() || c == '-')
}

fn preview_cache_path(source_abs: &PathBuf) -> PathBuf {
    let mut h = Sha256::new();
    h.update(source_abs.to_string_lossy().as_bytes());
    let tag = hex::encode(&h.finalize()[..]);
    let mut p = PathBuf::from(preview_cache_dir());
    p.push(format!("{}.preview.mp4", &tag[..16]));
    p
}

async fn ensure_preview_clip(source_abs: PathBuf, state: SecureArtifactsState) -> Result<PathBuf, String> {
    let preview_path = preview_cache_path(&source_abs);
    if preview_path.exists() {
        return Ok(preview_path);
    }
    if !source_abs.exists() {
        return Err("source missing".to_string());
    }
    // Per-output lock so two concurrent first-requests share a single ffmpeg run.
    let lock = {
        let mut m = state.clip_locks.lock().await;
        m.entry(preview_path.clone())
            .or_insert_with(|| Arc::new(tokio::sync::Mutex::new(())))
            .clone()
    };
    let _g = lock.lock().await;
    if preview_path.exists() {
        return Ok(preview_path);
    }
    // Stream-copy first; transcode fallback if non-keyframe-aligned cut fails.
    let preview_path_str = preview_path.to_string_lossy().to_string();
    let source_str = source_abs.to_string_lossy().to_string();
    let cap = preview_limit_seconds().to_string();
    let copy_status = tokio::process::Command::new("/usr/bin/ffmpeg")
        .args([
            "-ss", "0", "-t", &cap, "-i", &source_str,
            "-c", "copy", "-movflags", "+faststart", "-y", &preview_path_str,
        ])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .await
        .map_err(|e| format!("ffmpeg spawn failed: {}", e))?;
    if copy_status.success() && preview_path.exists() {
        return Ok(preview_path);
    }
    let transcode_status = tokio::process::Command::new("/usr/bin/ffmpeg")
        .args([
            "-ss", "0", "-t", &cap, "-i", &source_str,
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "26",
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart", "-y", &preview_path_str,
        ])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .await
        .map_err(|e| format!("ffmpeg transcode spawn failed: {}", e))?;
    if transcode_status.success() && preview_path.exists() {
        Ok(preview_path)
    } else {
        Err(format!(
            "ffmpeg failed: copy={:?} transcode={:?}",
            copy_status.code(),
            transcode_status.code(),
        ))
    }
}

async fn send_file_response(p: &PathBuf, headers: Vec<(&'static str, String)>) -> Response {
    match tokio::fs::read(p).await {
        Ok(bytes) => {
            let mut resp = bytes.into_response();
            // Best-effort content-type from extension. For .mp4 / .mp3 / .srt / .webp.
            let ct = match p.extension().and_then(|e| e.to_str()) {
                Some("mp4") => "video/mp4",
                Some("mp3") => "audio/mpeg",
                Some("srt") => "application/x-subrip",
                Some("webp") => "image/webp",
                Some("webm") => "video/webm",
                Some("wav") => "audio/wav",
                _ => "application/octet-stream",
            };
            resp.headers_mut()
                .insert(header::CONTENT_TYPE, ct.parse().unwrap());
            for (k, v) in headers {
                if let Ok(v_) = v.parse() {
                    resp.headers_mut().insert(k, v_);
                }
            }
            resp
        }
        Err(_) => json_err(StatusCode::NOT_FOUND, "ARTIFACT_NOT_FOUND"),
    }
}

async fn secure_artifacts_handler(
    AxumPath((wid, file)): AxumPath<(String, String)>,
    Query(q): Query<SecureQuery>,
    State(_app): State<AppState>,
) -> Response {
    let token = q.t.unwrap_or_default();
    let exp_ms = q.e.unwrap_or(0);
    let kind = AccessKind::from_str(q.k.as_deref().unwrap_or("full"))
        .unwrap_or(AccessKind::Full);
    if token.is_empty() || exp_ms <= 0 {
        return json_err(StatusCode::BAD_REQUEST, "TOKEN_MISSING");
    }
    if !valid_work_id(&wid) {
        return json_err(StatusCode::BAD_REQUEST, "INVALID_WORK_ID");
    }
    if !safe_segment(&file) {
        return json_err(StatusCode::BAD_REQUEST, "INVALID_FILE");
    }
    let exp_ms_u64 = exp_ms as u64;
    if !verify_media_token(&wid, &file, exp_ms_u64, kind, &token) {
        return json_err(StatusCode::FORBIDDEN, "TOKEN_INVALID_OR_EXPIRED");
    }
    let mut source_abs = PathBuf::from(artifacts_dir());
    source_abs.push(&file);

    let mut headers: Vec<(&'static str, String)> = vec![
        ("cache-control", "private, max-age=600".to_string()),
    ];
    if matches!(kind, AccessKind::Preview) {
        headers.push(("x-preview-limit-seconds", preview_limit_seconds().to_string()));
        let state = SecureArtifactsState::default();
        match ensure_preview_clip(source_abs, state).await {
            Ok(clip) => {
                headers.push(("x-cssos-preview-cached", "1".to_string()));
                return send_file_response(&clip, headers).await;
            }
            Err(err) => {
                tracing::warn!(target: "cssos::secure", "preview clip failed: {}", err);
                headers.push(("x-cssos-preview-fallback", "header-only".to_string()));
                // Fall through to send the original source — header-only enforcement.
                let mut p = PathBuf::from(artifacts_dir());
                p.push(&file);
                return send_file_response(&p, headers).await;
            }
        }
    }
    send_file_response(&source_abs, headers).await
}
