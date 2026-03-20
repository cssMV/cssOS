use axum::{extract::State, response::IntoResponse, Json};
use chrono::Utc;

use crate::css_case_api::types::{
    CaseApiSubjectKind, ExecuteCaseActionRequest, ExecuteCaseActionResponse,
    GetCaseActionLogsResponse, GetCaseAlertsResponse, GetCaseAnalyticsResponse,
    GetCaseBriefingPackResponse, GetCaseDashboardResponse, GetCaseDeliveryApiV2Response,
    GetCaseDeliveryExecutionStatusResponse, GetCaseDeliveryExportResponse,
    GetCaseDeliveryLogsResponse, GetCaseDeliveryOpsConsoleResponse, GetCaseDeliveryPayloadResponse,
    GetCaseDeliveryRecoveryResponse, GetCaseDeliveryReportResponse,
    GetCaseDeliverySingleReportResponse, GetCaseDeliverySubscriptionsResponse,
    GetCaseDigestResponse, GetCaseInboxResponse, GetCaseKpiResponse, GetCaseLifecycleResponse,
    GetCaseRequest, GetCaseStatusResponse, GetCaseSummaryResponse, GetCaseTimelineResponse,
    GetCaseTrendsResponse, GetCaseWorkspaceResponse, GetInspectorRequest, GetInspectorResponse,
    QueryCasesResponse, RunCaseDeliveryExecutionRetryResponse, RunCaseDeliverySubscriptionRequest,
    RunCaseDeliverySubscriptionResponse,
};
use crate::routes::AppState;

fn to_workspace_subject_kind(
    kind: &CaseApiSubjectKind,
) -> crate::css_case_workspace::types::CaseWorkspaceSubjectKind {
    match kind {
        CaseApiSubjectKind::User => {
            crate::css_case_workspace::types::CaseWorkspaceSubjectKind::User
        }
        CaseApiSubjectKind::Catalog => {
            crate::css_case_workspace::types::CaseWorkspaceSubjectKind::Catalog
        }
        CaseApiSubjectKind::Deal => {
            crate::css_case_workspace::types::CaseWorkspaceSubjectKind::Deal
        }
        CaseApiSubjectKind::Ownership => {
            crate::css_case_workspace::types::CaseWorkspaceSubjectKind::Ownership
        }
    }
}

fn to_action_subject_kind(
    kind: &CaseApiSubjectKind,
) -> crate::css_case_actions_engine::types::CaseActionSubjectKind {
    match kind {
        CaseApiSubjectKind::User => {
            crate::css_case_actions_engine::types::CaseActionSubjectKind::User
        }
        CaseApiSubjectKind::Catalog => {
            crate::css_case_actions_engine::types::CaseActionSubjectKind::Catalog
        }
        CaseApiSubjectKind::Deal => {
            crate::css_case_actions_engine::types::CaseActionSubjectKind::Deal
        }
        CaseApiSubjectKind::Ownership => {
            crate::css_case_actions_engine::types::CaseActionSubjectKind::Ownership
        }
    }
}

fn to_status_subject_kind(
    kind: &CaseApiSubjectKind,
) -> crate::css_case_status_view::types::CaseStatusSubjectKind {
    match kind {
        CaseApiSubjectKind::User => crate::css_case_status_view::types::CaseStatusSubjectKind::User,
        CaseApiSubjectKind::Catalog => {
            crate::css_case_status_view::types::CaseStatusSubjectKind::Catalog
        }
        CaseApiSubjectKind::Deal => crate::css_case_status_view::types::CaseStatusSubjectKind::Deal,
        CaseApiSubjectKind::Ownership => {
            crate::css_case_status_view::types::CaseStatusSubjectKind::Ownership
        }
    }
}

fn to_lifecycle_subject_kind(
    kind: &CaseApiSubjectKind,
) -> crate::css_case_lifecycle_view::types::CaseLifecycleSubjectKind {
    match kind {
        CaseApiSubjectKind::User => {
            crate::css_case_lifecycle_view::types::CaseLifecycleSubjectKind::User
        }
        CaseApiSubjectKind::Catalog => {
            crate::css_case_lifecycle_view::types::CaseLifecycleSubjectKind::Catalog
        }
        CaseApiSubjectKind::Deal => {
            crate::css_case_lifecycle_view::types::CaseLifecycleSubjectKind::Deal
        }
        CaseApiSubjectKind::Ownership => {
            crate::css_case_lifecycle_view::types::CaseLifecycleSubjectKind::Ownership
        }
    }
}

fn to_timeline_subject_kind(
    kind: &CaseApiSubjectKind,
) -> crate::css_case_timeline_merge::types::CaseTimelineSubjectKind {
    match kind {
        CaseApiSubjectKind::User => {
            crate::css_case_timeline_merge::types::CaseTimelineSubjectKind::User
        }
        CaseApiSubjectKind::Catalog => {
            crate::css_case_timeline_merge::types::CaseTimelineSubjectKind::Catalog
        }
        CaseApiSubjectKind::Deal => {
            crate::css_case_timeline_merge::types::CaseTimelineSubjectKind::Deal
        }
        CaseApiSubjectKind::Ownership => {
            crate::css_case_timeline_merge::types::CaseTimelineSubjectKind::Ownership
        }
    }
}

fn to_summary_subject_kind(
    kind: &CaseApiSubjectKind,
) -> crate::css_case_summary_engine::types::CaseSummarySubjectKind {
    match kind {
        CaseApiSubjectKind::User => {
            crate::css_case_summary_engine::types::CaseSummarySubjectKind::User
        }
        CaseApiSubjectKind::Catalog => {
            crate::css_case_summary_engine::types::CaseSummarySubjectKind::Catalog
        }
        CaseApiSubjectKind::Deal => {
            crate::css_case_summary_engine::types::CaseSummarySubjectKind::Deal
        }
        CaseApiSubjectKind::Ownership => {
            crate::css_case_summary_engine::types::CaseSummarySubjectKind::Ownership
        }
    }
}

fn bad_request(code: &str, err: anyhow::Error) -> axum::response::Response {
    (
        axum::http::StatusCode::BAD_REQUEST,
        Json(serde_json::json!({
            "code": code,
            "message": err.to_string(),
        })),
    )
        .into_response()
}

pub async fn get_case_workspace(
    pool: &sqlx::PgPool,
    req: GetCaseRequest,
) -> anyhow::Result<GetCaseWorkspaceResponse> {
    let workspace = crate::css_case_workspace::runtime::build_case_workspace(
        pool,
        crate::css_case_workspace::types::CaseWorkspaceRequest {
            subject_kind: to_workspace_subject_kind(&req.subject_kind),
            subject_id: req.subject_id,
            review_id: None,
            audit_id: None,
            dispute_id: None,
        },
    )
    .await?;

    Ok(GetCaseWorkspaceResponse { workspace })
}

pub async fn get_inspector(
    pool: &sqlx::PgPool,
    req: GetInspectorRequest,
) -> anyhow::Result<GetInspectorResponse> {
    let inspector = crate::css_inspector_view::runtime::build_inspector_view(
        pool,
        crate::css_inspector_view::types::InspectorRequest {
            target_kind: req.target_kind,
            source_system: req.source_system,
            source_id: req.source_id,
        },
    )
    .await?;

    Ok(GetInspectorResponse { inspector })
}

pub async fn execute_case_action(
    pool: &sqlx::PgPool,
    req: ExecuteCaseActionRequest,
    now_rfc3339: &str,
) -> anyhow::Result<ExecuteCaseActionResponse> {
    let result = crate::css_case_actions_engine::runtime::execute_case_action(
        pool,
        crate::css_case_actions_engine::types::CaseActionRequest {
            case_id: req.case_id.clone(),
            subject_kind: to_action_subject_kind(&req.subject_kind),
            subject_id: req.subject_id.clone(),
            action: req.action,
            actor_user_id: req.actor_user_id,
            reason: req.reason,
            review_id: req.review_id,
        },
        now_rfc3339,
    )
    .await?;

    let latest_status = crate::css_case_status_view::runtime::load_case_status(
        pool,
        crate::css_case_status_view::types::CaseStatusRequest {
            case_id: req.case_id,
            subject_kind: to_status_subject_kind(&req.subject_kind),
            subject_id: req.subject_id,
        },
    )
    .await
    .ok();

    Ok(ExecuteCaseActionResponse {
        result,
        latest_status,
    })
}

pub async fn get_case_status(
    pool: &sqlx::PgPool,
    req: GetCaseRequest,
) -> anyhow::Result<GetCaseStatusResponse> {
    let status = crate::css_case_status_view::runtime::load_case_status(
        pool,
        crate::css_case_status_view::types::CaseStatusRequest {
            case_id: req.case_id,
            subject_kind: to_status_subject_kind(&req.subject_kind),
            subject_id: req.subject_id,
        },
    )
    .await?;

    Ok(GetCaseStatusResponse { status })
}

pub async fn get_case_lifecycle(
    pool: &sqlx::PgPool,
    req: GetCaseRequest,
) -> anyhow::Result<GetCaseLifecycleResponse> {
    let lifecycle = crate::css_case_lifecycle_view::runtime::build_case_lifecycle_view(
        pool,
        crate::css_case_lifecycle_view::types::CaseLifecycleRequest {
            case_id: req.case_id,
            subject_kind: to_lifecycle_subject_kind(&req.subject_kind),
            subject_id: req.subject_id,
        },
    )
    .await?;

    Ok(GetCaseLifecycleResponse { lifecycle })
}

pub async fn get_case_timeline(
    pool: &sqlx::PgPool,
    req: GetCaseRequest,
) -> anyhow::Result<GetCaseTimelineResponse> {
    let timeline = crate::css_case_timeline_merge::runtime::build_case_timeline(
        pool,
        crate::css_case_timeline_merge::types::CaseTimelineRequest {
            case_id: req.case_id,
            subject_kind: to_timeline_subject_kind(&req.subject_kind),
            subject_id: req.subject_id,
        },
    )
    .await?;

    Ok(GetCaseTimelineResponse { timeline })
}

pub async fn get_case_summary(
    pool: &sqlx::PgPool,
    req: GetCaseRequest,
) -> anyhow::Result<GetCaseSummaryResponse> {
    let summary = crate::css_case_summary_engine::runtime::build_case_summary(
        pool,
        crate::css_case_summary_engine::types::CaseSummaryRequest {
            case_id: req.case_id,
            subject_kind: to_summary_subject_kind(&req.subject_kind),
            subject_id: req.subject_id,
        },
    )
    .await?;

    Ok(GetCaseSummaryResponse { summary })
}

pub async fn get_case_action_logs(
    pool: &sqlx::PgPool,
    req: GetCaseRequest,
) -> anyhow::Result<GetCaseActionLogsResponse> {
    let logs = crate::css_case_action_log::runtime::list_case_logs(pool, &req.case_id).await?;
    Ok(GetCaseActionLogsResponse { logs })
}

pub async fn query_cases(
    pool: &sqlx::PgPool,
    req: crate::css_case_query_engine::types::CaseQueryRequest,
) -> anyhow::Result<QueryCasesResponse> {
    let result = crate::css_case_query_engine::runtime::query_cases(pool, req).await?;
    Ok(QueryCasesResponse { result })
}

pub async fn get_case_inbox(
    pool: &sqlx::PgPool,
    req: crate::css_case_inbox_view::types::InboxRequest,
) -> anyhow::Result<GetCaseInboxResponse> {
    let today = Utc::now().format("%Y-%m-%d").to_string();
    let inbox = crate::css_case_inbox_view::runtime::load_inbox(pool, req, &today).await?;
    Ok(GetCaseInboxResponse { inbox })
}

pub async fn get_case_dashboard(pool: &sqlx::PgPool) -> anyhow::Result<GetCaseDashboardResponse> {
    let today = Utc::now().format("%Y-%m-%d").to_string();
    let dashboard = crate::css_case_dashboard_view::runtime::build_dashboard(pool, &today).await?;
    Ok(GetCaseDashboardResponse { dashboard })
}

pub async fn get_case_kpi(pool: &sqlx::PgPool) -> anyhow::Result<GetCaseKpiResponse> {
    let today = Utc::now().format("%Y-%m-%d").to_string();
    let kpi = crate::css_case_kpi_view::runtime::build_case_kpi_view(
        pool,
        crate::css_case_kpi_view::types::CaseKpiRequest {
            today_yyyy_mm_dd: today,
        },
    )
    .await?;
    Ok(GetCaseKpiResponse { kpi })
}

pub async fn get_case_analytics(pool: &sqlx::PgPool) -> anyhow::Result<GetCaseAnalyticsResponse> {
    let analytics = crate::css_case_analytics_view::runtime::build_case_analytics_view(
        pool,
        crate::css_case_analytics_view::types::CaseAnalyticsRequest::default(),
    )
    .await?;
    Ok(GetCaseAnalyticsResponse { analytics })
}

pub async fn get_case_trends(
    pool: &sqlx::PgPool,
    req: crate::css_case_trends_view::types::CaseTrendsRequest,
) -> anyhow::Result<GetCaseTrendsResponse> {
    let trends = crate::css_case_trends_view::runtime::build_case_trends_view(pool, req).await?;
    Ok(GetCaseTrendsResponse { trends })
}

pub async fn get_case_alerts(
    pool: &sqlx::PgPool,
    req: crate::css_case_alerts_view::types::CaseAlertsRequest,
) -> anyhow::Result<GetCaseAlertsResponse> {
    let alerts = crate::css_case_alerts_view::runtime::build_case_alerts_view(pool, req).await?;
    Ok(GetCaseAlertsResponse { alerts })
}

pub async fn get_case_digest(
    pool: &sqlx::PgPool,
    req: crate::css_case_digest_engine::types::CaseDigestRequest,
) -> anyhow::Result<GetCaseDigestResponse> {
    let digest = crate::css_case_digest_engine::runtime::build_case_digest(pool, req).await?;
    Ok(GetCaseDigestResponse { digest })
}

pub async fn get_case_briefing_pack(
    pool: &sqlx::PgPool,
    req: crate::css_case_briefing_pack::types::CaseBriefingPackRequest,
) -> anyhow::Result<GetCaseBriefingPackResponse> {
    let briefing =
        crate::css_case_briefing_pack::runtime::build_case_briefing_pack(pool, req).await?;
    Ok(GetCaseBriefingPackResponse { briefing })
}

pub async fn get_case_delivery_report(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_report_api::types::GetDeliveryReportBundleRequest,
    now_rfc3339: &str,
) -> anyhow::Result<GetCaseDeliveryReportResponse> {
    let report = crate::css_case_delivery_report_api::handlers::get_delivery_report_bundle(
        pool,
        req,
        now_rfc3339,
    )
    .await?;
    Ok(GetCaseDeliveryReportResponse { report })
}

pub async fn get_case_delivery_single_report(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_report_api::types::GetDeliveryReportRequest,
    now_rfc3339: &str,
) -> anyhow::Result<GetCaseDeliverySingleReportResponse> {
    let report =
        crate::css_case_delivery_report_api::handlers::get_delivery_report(pool, req, now_rfc3339)
            .await?;
    Ok(GetCaseDeliverySingleReportResponse { report })
}

pub async fn get_case_delivery_export(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_export_engine::types::DeliveryExportRequest,
) -> anyhow::Result<GetCaseDeliveryExportResponse> {
    let export =
        crate::css_case_delivery_export_engine::runtime::export_delivery_report(pool, req).await?;
    Ok(GetCaseDeliveryExportResponse { export })
}

pub async fn get_case_delivery_payload(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_api::types::GetDeliveryApiRequest,
    now_rfc3339: &str,
) -> anyhow::Result<GetCaseDeliveryPayloadResponse> {
    let delivery = match crate::css_case_delivery_api::handlers::get_delivery_payload(
        pool,
        req.clone(),
        now_rfc3339,
    )
    .await
    {
        Ok(resp) => {
            let _ = crate::css_case_delivery_log::runtime::log_delivery_result(
                pool,
                None,
                &req,
                &resp,
                now_rfc3339,
            )
            .await;
            resp
        }
        Err(err) => {
            let error_message = err.to_string();
            let _ = crate::css_case_delivery_log::runtime::log_delivery_failure(
                pool,
                None,
                &req,
                error_message,
                now_rfc3339,
            )
            .await;
            return Err(err);
        }
    };
    Ok(GetCaseDeliveryPayloadResponse { delivery })
}

pub async fn get_case_delivery_api_v2(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_delivery_api::types::DeliveryApiRequest,
    now_rfc3339: &str,
) -> anyhow::Result<GetCaseDeliveryApiV2Response> {
    let delivery =
        crate::css_case_delivery_delivery_api::runtime::deliver(pool, req, now_rfc3339).await?;
    Ok(GetCaseDeliveryApiV2Response { delivery })
}

pub async fn get_case_delivery_subscriptions(
    pool: &sqlx::PgPool,
) -> anyhow::Result<GetCaseDeliverySubscriptionsResponse> {
    let subscriptions =
        crate::css_case_delivery_subscription_engine::store_pg::list_delivery_subscriptions(pool)
            .await?;
    Ok(GetCaseDeliverySubscriptionsResponse { subscriptions })
}

pub async fn run_case_delivery_subscription(
    pool: &sqlx::PgPool,
    req: RunCaseDeliverySubscriptionRequest,
    now_rfc3339: &str,
) -> anyhow::Result<RunCaseDeliverySubscriptionResponse> {
    let log = crate::css_case_delivery_log::runtime::run_subscription_and_log(
        pool,
        &req.subscription_id,
        now_rfc3339,
    )
    .await?;
    Ok(RunCaseDeliverySubscriptionResponse { log })
}

pub async fn get_case_delivery_logs(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_log::types::DeliveryLogQueryRequest,
) -> anyhow::Result<GetCaseDeliveryLogsResponse> {
    let logs = crate::css_case_delivery_log::runtime::query_delivery_logs(pool, req).await?;
    Ok(GetCaseDeliveryLogsResponse { logs })
}

pub async fn get_case_delivery_execution_status(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_execution_status_view::types::DeliveryExecutionStatusViewRequest,
) -> anyhow::Result<GetCaseDeliveryExecutionStatusResponse> {
    let status =
        crate::css_case_delivery_execution_status_view::runtime::build_delivery_execution_status_view(
            pool, req,
        )
        .await?;
    Ok(GetCaseDeliveryExecutionStatusResponse { status })
}

pub async fn get_case_delivery_recovery(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_recovery_view::types::DeliveryRecoveryViewRequest,
) -> anyhow::Result<GetCaseDeliveryRecoveryResponse> {
    let recovery =
        crate::css_case_delivery_recovery_view::runtime::build_delivery_recovery_view(pool, req)
            .await?;
    Ok(GetCaseDeliveryRecoveryResponse { recovery })
}

pub async fn get_case_delivery_ops_console(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_ops_console::types::DeliveryOpsConsoleRequest,
) -> anyhow::Result<GetCaseDeliveryOpsConsoleResponse> {
    let console =
        crate::css_case_delivery_ops_console::runtime::build_delivery_ops_console(pool, req)
            .await?;
    Ok(GetCaseDeliveryOpsConsoleResponse { console })
}

pub async fn run_case_delivery_execution_retry(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_execution_retry_engine::types::DeliveryRetryRequest,
    now_rfc3339: &str,
) -> anyhow::Result<RunCaseDeliveryExecutionRetryResponse> {
    let retry = crate::css_case_delivery_execution_retry_engine::runtime::retry_delivery_execution(
        pool,
        req,
        now_rfc3339,
    )
    .await?;
    Ok(RunCaseDeliveryExecutionRetryResponse { retry })
}

pub async fn get_case_workspace_http(
    State(state): State<AppState>,
    Json(req): Json<GetCaseRequest>,
) -> axum::response::Response {
    match get_case_workspace(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => bad_request("get_case_workspace_failed", err),
    }
}

pub async fn get_inspector_http(
    State(state): State<AppState>,
    Json(req): Json<GetInspectorRequest>,
) -> axum::response::Response {
    match get_inspector(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => bad_request("get_case_inspector_failed", err),
    }
}

pub async fn execute_case_action_http(
    State(state): State<AppState>,
    Json(req): Json<ExecuteCaseActionRequest>,
) -> axum::response::Response {
    match execute_case_action(&state.pool, req, &Utc::now().to_rfc3339()).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => bad_request("execute_case_action_failed", err),
    }
}

pub async fn get_case_status_http(
    State(state): State<AppState>,
    Json(req): Json<GetCaseRequest>,
) -> axum::response::Response {
    match get_case_status(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => bad_request("get_case_status_failed", err),
    }
}

pub async fn get_case_lifecycle_http(
    State(state): State<AppState>,
    Json(req): Json<GetCaseRequest>,
) -> axum::response::Response {
    match get_case_lifecycle(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => bad_request("get_case_lifecycle_failed", err),
    }
}

pub async fn get_case_timeline_http(
    State(state): State<AppState>,
    Json(req): Json<GetCaseRequest>,
) -> axum::response::Response {
    match get_case_timeline(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => bad_request("get_case_timeline_failed", err),
    }
}

pub async fn get_case_summary_http(
    State(state): State<AppState>,
    Json(req): Json<GetCaseRequest>,
) -> axum::response::Response {
    match get_case_summary(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => bad_request("get_case_summary_failed", err),
    }
}

pub async fn get_case_action_logs_http(
    State(state): State<AppState>,
    Json(req): Json<GetCaseRequest>,
) -> axum::response::Response {
    match get_case_action_logs(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => bad_request("get_case_action_logs_failed", err),
    }
}

pub async fn query_cases_http(
    State(state): State<AppState>,
    Json(req): Json<crate::css_case_query_engine::types::CaseQueryRequest>,
) -> axum::response::Response {
    match query_cases(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => bad_request("query_cases_failed", err),
    }
}

pub async fn get_case_inbox_http(
    State(state): State<AppState>,
    Json(req): Json<crate::css_case_inbox_view::types::InboxRequest>,
) -> axum::response::Response {
    match get_case_inbox(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => bad_request("get_case_inbox_failed", err),
    }
}

pub async fn get_case_dashboard_http(State(state): State<AppState>) -> axum::response::Response {
    match get_case_dashboard(&state.pool).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => bad_request("get_case_dashboard_failed", err),
    }
}

pub async fn get_case_kpi_http(State(state): State<AppState>) -> axum::response::Response {
    match get_case_kpi(&state.pool).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => bad_request("get_case_kpi_failed", err),
    }
}

pub async fn get_case_analytics_http(State(state): State<AppState>) -> axum::response::Response {
    match get_case_analytics(&state.pool).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => bad_request("get_case_analytics_failed", err),
    }
}

pub async fn get_case_trends_http(
    State(state): State<AppState>,
    Json(req): Json<crate::css_case_trends_view::types::CaseTrendsRequest>,
) -> axum::response::Response {
    match get_case_trends(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => bad_request("get_case_trends_failed", err),
    }
}

pub async fn get_case_alerts_http(
    State(state): State<AppState>,
    Json(req): Json<crate::css_case_alerts_view::types::CaseAlertsRequest>,
) -> axum::response::Response {
    match get_case_alerts(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => bad_request("get_case_alerts_failed", err),
    }
}

pub async fn get_case_digest_http(
    State(state): State<AppState>,
    Json(req): Json<crate::css_case_digest_engine::types::CaseDigestRequest>,
) -> axum::response::Response {
    match get_case_digest(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => bad_request("get_case_digest_failed", err),
    }
}

pub async fn get_case_briefing_pack_http(
    State(state): State<AppState>,
    Json(req): Json<crate::css_case_briefing_pack::types::CaseBriefingPackRequest>,
) -> axum::response::Response {
    match get_case_briefing_pack(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => bad_request("get_case_briefing_pack_failed", err),
    }
}

pub async fn get_case_delivery_report_http(
    State(state): State<AppState>,
    Json(req): Json<crate::css_case_delivery_report_api::types::GetDeliveryReportBundleRequest>,
) -> axum::response::Response {
    match get_case_delivery_report(&state.pool, req, &Utc::now().to_rfc3339()).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => bad_request("get_case_delivery_report_failed", err),
    }
}

pub async fn get_case_delivery_single_report_http(
    State(state): State<AppState>,
    Json(req): Json<crate::css_case_delivery_report_api::types::GetDeliveryReportRequest>,
) -> axum::response::Response {
    match get_case_delivery_single_report(&state.pool, req, &Utc::now().to_rfc3339()).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => bad_request("get_case_delivery_single_report_failed", err),
    }
}

pub async fn get_case_delivery_export_http(
    State(state): State<AppState>,
    Json(req): Json<crate::css_case_delivery_export_engine::types::DeliveryExportRequest>,
) -> axum::response::Response {
    match get_case_delivery_export(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => bad_request("get_case_delivery_export_failed", err),
    }
}

pub async fn get_case_delivery_payload_http(
    State(state): State<AppState>,
    Json(req): Json<crate::css_case_delivery_api::types::GetDeliveryApiRequest>,
) -> axum::response::Response {
    match get_case_delivery_payload(&state.pool, req, &Utc::now().to_rfc3339()).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => bad_request("get_case_delivery_payload_failed", err),
    }
}

pub async fn get_case_delivery_api_v2_http(
    State(state): State<AppState>,
    Json(req): Json<crate::css_case_delivery_delivery_api::types::DeliveryApiRequest>,
) -> axum::response::Response {
    match get_case_delivery_api_v2(&state.pool, req, &Utc::now().to_rfc3339()).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => bad_request("get_case_delivery_api_v2_failed", err),
    }
}

pub async fn get_case_delivery_subscriptions_http(
    State(state): State<AppState>,
) -> axum::response::Response {
    match get_case_delivery_subscriptions(&state.pool).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => bad_request("get_case_delivery_subscriptions_failed", err),
    }
}

pub async fn run_case_delivery_subscription_http(
    State(state): State<AppState>,
    Json(req): Json<RunCaseDeliverySubscriptionRequest>,
) -> axum::response::Response {
    match run_case_delivery_subscription(&state.pool, req, &Utc::now().to_rfc3339()).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => bad_request("run_case_delivery_subscription_failed", err),
    }
}

pub async fn get_case_delivery_logs_http(
    State(state): State<AppState>,
    Json(req): Json<crate::css_case_delivery_log::types::DeliveryLogQueryRequest>,
) -> axum::response::Response {
    match get_case_delivery_logs(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => bad_request("get_case_delivery_logs_failed", err),
    }
}

pub async fn get_case_delivery_execution_status_http(
    State(state): State<AppState>,
    Json(req): Json<
        crate::css_case_delivery_execution_status_view::types::DeliveryExecutionStatusViewRequest,
    >,
) -> axum::response::Response {
    match get_case_delivery_execution_status(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => bad_request("get_case_delivery_execution_status_failed", err),
    }
}

pub async fn get_case_delivery_recovery_http(
    State(state): State<AppState>,
    Json(req): Json<crate::css_case_delivery_recovery_view::types::DeliveryRecoveryViewRequest>,
) -> axum::response::Response {
    match get_case_delivery_recovery(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => bad_request("get_case_delivery_recovery_failed", err),
    }
}

pub async fn get_case_delivery_ops_console_http(
    State(state): State<AppState>,
    Json(req): Json<crate::css_case_delivery_ops_console::types::DeliveryOpsConsoleRequest>,
) -> axum::response::Response {
    match get_case_delivery_ops_console(&state.pool, req).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => bad_request("get_case_delivery_ops_console_failed", err),
    }
}

pub async fn run_case_delivery_execution_retry_http(
    State(state): State<AppState>,
    Json(req): Json<crate::css_case_delivery_execution_retry_engine::types::DeliveryRetryRequest>,
) -> axum::response::Response {
    match run_case_delivery_execution_retry(&state.pool, req, &Utc::now().to_rfc3339()).await {
        Ok(resp) => (axum::http::StatusCode::OK, Json(resp)).into_response(),
        Err(err) => bad_request("run_case_delivery_execution_retry_failed", err),
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn v200_maps_case_api_subject_kind_to_workspace_subject_kind() {
        let got = super::to_workspace_subject_kind(
            &crate::css_case_api::types::CaseApiSubjectKind::Ownership,
        );
        assert_eq!(
            got,
            crate::css_case_workspace::types::CaseWorkspaceSubjectKind::Ownership
        );
    }
}
