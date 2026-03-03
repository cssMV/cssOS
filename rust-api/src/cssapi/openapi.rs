use utoipa::OpenApi;
use axum::extract::Query;
use axum::http::HeaderMap;
use serde::Deserialize;
use serde_json::Value;

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
pub async fn openapi_json(
    Query(q): Query<OpenApiLangQuery>,
    headers: HeaderMap,
) -> axum::Json<serde_json::Value> {
    let lang = pick_lang(q.lang.as_deref(), &headers);
    axum::Json(build_openapi_i18n_value(lang))
}

pub fn build_openapi() -> utoipa::openapi::OpenApi {
    CssApiDoc::openapi()
}

pub fn build_openapi_i18n(lang: &str) -> utoipa::openapi::OpenApi {
    let mut doc = CssApiDoc::openapi();
    if lang == "zh" {
        doc.info.title = "cssAPI v1（中文）".to_string();
        doc.info.description = Some("cssMV 公共 API（v1）".to_string());
    } else {
        doc.info.title = "cssAPI v1".to_string();
        doc.info.description = Some("cssMV public API (v1).".to_string());
    }
    if let Some(tags) = doc.tags.as_mut() {
        for t in tags.iter_mut() {
            if t.name == "runs" {
                t.description = Some(if lang == "zh" {
                    "运行任务生命周期与状态接口".to_string()
                } else {
                    "Run lifecycle and status APIs".to_string()
                });
            }
        }
    }
    localize_openapi(doc, lang)
}

pub fn build_openapi_i18n_value(lang: &str) -> serde_json::Value {
    let doc = build_openapi_i18n(lang);
    let mut v = match serde_json::to_value(doc) {
        Ok(v) => v,
        Err(_) => serde_json::json!({}),
    };
    if lang == "zh" {
        localize_openapi_value(&mut v, lang);
    }
    v
}

fn localize_openapi(doc: utoipa::openapi::OpenApi, lang: &str) -> utoipa::openapi::OpenApi {
    if lang != "zh" {
        return doc;
    }
    let mut v = match serde_json::to_value(&doc) {
        Ok(v) => v,
        Err(_) => return doc,
    };
    localize_openapi_value(&mut v, lang);
    match serde_json::from_value(v) {
        Ok(d) => d,
        Err(_) => doc,
    }
}

fn localize_openapi_value(v: &mut Value, lang: &str) {
    match v {
        Value::Object(map) => {
            for (k, val) in map.iter_mut() {
                if (k == "summary" || k == "description") && val.is_string() {
                    if let Some(s) = val.as_str() {
                        *val = Value::String(i18n_text(s, lang));
                    }
                } else {
                    localize_openapi_value(val, lang);
                }
            }
        }
        Value::Array(arr) => {
            for item in arr.iter_mut() {
                localize_openapi_value(item, lang);
            }
        }
        _ => {}
    }
}

fn i18n_text(input: &str, lang: &str) -> String {
    if lang != "zh" {
        return input.to_string();
    }
    match input {
        "Language, e.g. zh or en" => "语言，例如 zh 或 en".to_string(),
        "OpenAPI v1 JSON" => "OpenAPI v1 JSON 文档".to_string(),
        "Request identifier for tracing and support." => "请求追踪 ID（用于定位与支持）".to_string(),
        "Result limit, default 50, max 200" => "结果数量限制，默认 50，最大 200".to_string(),
        "Filter by run status" => "按任务状态过滤".to_string(),
        "List runs" => "任务列表".to_string(),
        "Server error" => "服务端错误".to_string(),
        "Run queued" => "任务已入队".to_string(),
        "Conflict" => "冲突".to_string(),
        "Invalid request" => "请求无效".to_string(),
        "Run ID" => "任务 ID".to_string(),
        "Run state JSON" => "任务状态 JSON".to_string(),
        "Run not found" => "任务不存在".to_string(),
        "Internal error" => "内部错误".to_string(),
        "Run status" => "任务状态".to_string(),
        "Ready queue view" => "就绪队列视图".to_string(),
        _ => input.to_string(),
    }
}
