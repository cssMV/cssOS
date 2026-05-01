// CSSOS_PHASE2_MV_KEEPALIVE 20260425 #112 — Jing
//
// "好不容易解决了顽固的 422 问题，504 问题又来了."
//
// Root cause: long-running pipeline endpoints (/api/mv/music,
// /api/mv/cover, /api/mv/video, /api/mv/compose) block on upstream
// engines that can take many minutes. nginx in front of the rust-api
// has `proxy_read_timeout 60s` by default — when our handler doesn't
// emit any bytes for >60s, nginx returns its own 504 page to the
// browser BEFORE our handler ever finishes. The user sees:
//   "504 Gateway Time-out 504 Gateway Time-out nginx/1.18.0 (Ubuntu)"
//
// Fix: wrap long-running JSON responses in a chunked-transfer body
// that emits a single space byte every `heartbeat` interval. nginx
// resets its read timer on every chunk, so the connection stays
// open until the real response is ready. Leading whitespace in JSON
// is legal — `JSON.parse(" \n  {\"foo\":1}")` works — so the frontend
// parses the final body unchanged.
//
// Trade-off: the response status MUST be committed before the first
// chunk goes out the wire. We always send 200 OK; failures are
// represented as `{ok: false, error, detail}` in the body. The
// frontend `postJson` helper has been updated to flag body.ok === false
// as an error in addition to the existing non-200 check.

use std::future::Future;
use std::pin::Pin;
use std::time::Duration;

use axum::body::{Body, Bytes};
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Json, Response};
use serde::Serialize;
use serde_json::{json, Value};
use tokio::sync::mpsc;
use tokio::time::interval;
use tokio_stream::wrappers::ReceiverStream;

/// Wrap a fallible JSON-returning future in a heartbeat stream so
/// upstream proxies don't time out. Always returns HTTP 200; the
/// success/error split lives in the body's `ok` field.
///
/// Frontend MUST check `body.ok === false` in addition to `res.ok`.
pub async fn keepalive_json<F, T>(fut: F, heartbeat: Duration) -> Response
where
    F: Future<Output = Result<Json<T>, (StatusCode, Json<Value>)>> + Send + 'static,
    T: Serialize + Send + 'static,
{
    let (tx, rx) = mpsc::channel::<Result<Bytes, std::io::Error>>(8);

    tokio::spawn(async move {
        // Flush headers ASAP so the proxy knows we're alive. A single
        // space is JSON-safe leading whitespace.
        let _ = tx.send(Ok(Bytes::from_static(b" "))).await;

        let job: Pin<Box<dyn Future<Output = _> + Send>> = Box::pin(fut);
        tokio::pin!(job);
        let mut tick = interval(heartbeat);
        tick.tick().await; // drop the immediate first tick

        loop {
            tokio::select! {
                result = &mut job => {
                    let body_bytes = match result {
                        Ok(json) => {
                            // Json<T> wraps T; serialize the inner T.
                            // axum::response::Json doesn't expose the inner directly,
                            // but its IntoResponse uses serde_json::to_vec(&self.0).
                            // We replicate that here.
                            let inner = json.0;
                            match serde_json::to_vec(&inner) {
                                Ok(v) => v,
                                Err(err) => serialize_error_payload(
                                    StatusCode::INTERNAL_SERVER_ERROR,
                                    "serialize_error",
                                    &err.to_string(),
                                ),
                            }
                        }
                        Err((status, payload)) => {
                            // Inject the original status into the payload so the
                            // frontend can still surface a meaningful code even
                            // though the wire status is forced to 200.
                            let mut v = payload.0;
                            if let Value::Object(ref mut map) = v {
                                map.entry("ok")
                                    .or_insert_with(|| Value::Bool(false));
                                map.entry("status_code")
                                    .or_insert_with(|| Value::Number(status.as_u16().into()));
                            }
                            serde_json::to_vec(&v).unwrap_or_else(|err| {
                                serialize_error_payload(
                                    StatusCode::INTERNAL_SERVER_ERROR,
                                    "serialize_error_payload",
                                    &err.to_string(),
                                )
                            })
                        }
                    };
                    let _ = tx.send(Ok(Bytes::from(body_bytes))).await;
                    return;
                }
                _ = tick.tick() => {
                    if tx.send(Ok(Bytes::from_static(b" "))).await.is_err() {
                        // Client disconnected.
                        return;
                    }
                }
            }
        }
    });

    let stream = ReceiverStream::new(rx);
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/json")
        // Disable proxy buffering so nginx forwards each chunk straight
        // to the client. Without this header nginx will hold all chunks
        // until a flush threshold and re-introduce the timeout problem.
        .header("X-Accel-Buffering", "no")
        .body(Body::from_stream(stream))
        .unwrap_or_else(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"ok": false, "error": "keepalive_response_build"})),
            )
                .into_response()
        })
}

fn serialize_error_payload(status: StatusCode, error: &str, detail: &str) -> Vec<u8> {
    let v = json!({
        "ok": false,
        "error": error,
        "detail": detail,
        "status_code": status.as_u16(),
    });
    serde_json::to_vec(&v).unwrap_or_default()
}
