use axum::{
    http::{HeaderMap, HeaderName, HeaderValue},
    response::Response,
};
use std::{
    future::Future,
    pin::Pin,
    task::{Context, Poll},
};
use tower::{Layer, Service};

tokio::task_local! {
    static CURRENT_REQUEST_ID: String;
}

pub const X_REQUEST_ID: HeaderName = HeaderName::from_static("x-request-id");

pub fn current_request_id() -> Option<String> {
    CURRENT_REQUEST_ID.try_with(|v| v.clone()).ok()
}

#[derive(Clone, Default)]
pub struct RequestIdLayer;

impl<S> Layer<S> for RequestIdLayer {
    type Service = RequestIdService<S>;

    fn layer(&self, inner: S) -> Self::Service {
        RequestIdService { inner }
    }
}

#[derive(Clone)]
pub struct RequestIdService<S> {
    inner: S,
}

impl<S, ReqBody> Service<axum::http::Request<ReqBody>> for RequestIdService<S>
where
    S: Service<axum::http::Request<ReqBody>, Response = Response> + Clone + Send + 'static,
    S::Future: Send + 'static,
    ReqBody: Send + 'static,
{
    type Response = Response;
    type Error = S::Error;
    type Future = Pin<Box<dyn Future<Output = Result<Response, S::Error>> + Send>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, mut req: axum::http::Request<ReqBody>) -> Self::Future {
        let mut inner = self.inner.clone();

        let req_id = extract_or_generate(req.headers_mut());
        req.extensions_mut().insert(req_id.clone());

        Box::pin(async move {
            let rid_for_scope = req_id.to_str().unwrap_or("unknown").to_string();
            let mut resp = CURRENT_REQUEST_ID
                .scope(rid_for_scope, async move { inner.call(req).await })
                .await?;
            resp.headers_mut().insert(X_REQUEST_ID.clone(), req_id.clone());
            resp.extensions_mut().insert(req_id.clone());
            tracing::info!(
                request_id = %req_id.to_str().unwrap_or("unknown"),
                status = %resp.status(),
                "request completed"
            );
            Ok(resp)
        })
    }
}

fn extract_or_generate(headers: &mut HeaderMap) -> HeaderValue {
    if let Some(v) = headers.get(&X_REQUEST_ID).cloned() {
        if !v.as_bytes().is_empty() {
            return v;
        }
    }
    let id = uuid::Uuid::new_v4().to_string();
    HeaderValue::from_str(&id).unwrap_or_else(|_| HeaderValue::from_static("unknown"))
}
