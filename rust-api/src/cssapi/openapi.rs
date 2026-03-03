use utoipa::OpenApi;
use axum::extract::Query;
use axum::http::HeaderMap;
use serde::Deserialize;

#[derive(OpenApi)]
#[openapi(
    info(
        title = "cssAPI v1",
        version = "1.0.0",
        description = "cssMV public API (v1)."
    ),
    paths(
        openapi_json,
        crate::runs_api::runs_list,
        crate::runs_api::runs_create,
        crate::runs_api::runs_get,
        crate::runs_api::runs_status,
        crate::runs_api::run_ready
    ),
    components(
        schemas(
            crate::cssapi::problem::Problem,
            crate::runs_api::RunsListQuery,
            crate::runs_api::RunsListItem,
            crate::runs_api::RunsListResponse,
            crate::runs_api::RunsCreateResponse,
            crate::runs_api::RunsStatusResponse,
            crate::runs_api::DagReadyMeta,
            crate::runs_api::RunReadyResponse,
            crate::ready::ReadySummary,
            crate::run_state::RunStatus
        )
    ),
    tags(
        (name = "runs", description = "Run lifecycle and status APIs")
    )
)]
pub struct CssApiDoc;

#[derive(Debug, Deserialize)]
pub struct OpenApiLangQuery {
    pub lang: Option<String>,
}

fn pick_lang(query_lang: Option<&str>, headers: &HeaderMap) -> &'static str {
    if let Some(q) = query_lang {
        let qn = q.trim().to_lowercase();
        if qn.starts_with("zh") {
            return "zh";
        }
        if qn.starts_with("en") {
            return "en";
        }
    }
    if let Some(v) = headers.get(axum::http::header::ACCEPT_LANGUAGE) {
        if let Ok(s) = v.to_str() {
            let sn = s.to_lowercase();
            if sn.contains("zh") {
                return "zh";
            }
        }
    }
    "en"
}

#[utoipa::path(
    get,
    path = "/cssapi/v1/openapi.json",
    tag = "runs",
    params(
        ("lang" = Option<String>, Query, description = "Language, e.g. zh or en")
    ),
    responses(
        (status = 200, description = "OpenAPI v1 JSON", body = serde_json::Value,
            headers(
                ("X-Request-Id" = String, description = "Request identifier for tracing and support.")
            )
        )
    )
)]
pub(super) async fn openapi_json(
    Query(q): Query<OpenApiLangQuery>,
    headers: HeaderMap,
) -> axum::Json<utoipa::openapi::OpenApi> {
    let lang = pick_lang(q.lang.as_deref(), &headers);
    axum::Json(build_openapi_i18n(lang))
}

pub fn build_openapi() -> utoipa::openapi::OpenApi {
    CssApiDoc::openapi()
}

pub fn build_openapi_i18n(lang: &str) -> utoipa::openapi::OpenApi {
    let mut doc = CssApiDoc::openapi();

    match lang {
        "zh" => {
            doc.info.title = "cssAPI v1（中文）".to_string();
            doc.info.description = Some("cssMV 公共 API（v1）".to_string());
            if let Some(tags) = doc.tags.as_mut() {
                for t in tags.iter_mut() {
                    if t.name == "runs" {
                        t.description = Some("运行任务生命周期与状态接口".to_string());
                    }
                }
            }
        }
        _ => {
            doc.info.title = "cssAPI v1".to_string();
            doc.info.description = Some("cssMV public API (v1).".to_string());
            if let Some(tags) = doc.tags.as_mut() {
                for t in tags.iter_mut() {
                    if t.name == "runs" {
                        t.description = Some("Run lifecycle and status APIs".to_string());
                    }
                }
            }
        }
    }

    doc
}
