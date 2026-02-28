use axum::http::{HeaderName, Request};
use tower_http::{
    classify::{ServerErrorsAsFailures, SharedClassifier},
    trace::TraceLayer,
};
use tracing::Span;

pub fn make_trace_layer() -> TraceLayer<
    SharedClassifier<ServerErrorsAsFailures>,
    impl Fn(&Request<axum::body::Body>) -> Span + Clone,
> {
    TraceLayer::new_for_http().make_span_with(|req: &Request<axum::body::Body>| {
        let rid = req
            .extensions()
            .get::<axum::http::HeaderValue>()
            .and_then(|v| v.to_str().ok())
            .or_else(|| {
                req.headers()
                    .get(HeaderName::from_static("x-request-id"))
                    .and_then(|v| v.to_str().ok())
            })
            .unwrap_or("unknown");

        tracing::info_span!(
            "http",
            method = %req.method(),
            uri = %req.uri(),
            x_request_id = %rid
        )
    })
}
