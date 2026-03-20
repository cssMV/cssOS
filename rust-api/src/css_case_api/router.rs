use axum::{
    routing::{get, post},
    Router,
};

use crate::css_case_api::handlers::{
    execute_case_action_http, get_case_action_logs_http, get_case_alerts_http,
    get_case_analytics_http, get_case_briefing_pack_http, get_case_dashboard_http,
    get_case_delivery_api_v2_http, get_case_delivery_execution_status_http,
    get_case_delivery_export_http, get_case_delivery_logs_http, get_case_delivery_ops_console_http,
    get_case_delivery_payload_http, get_case_delivery_recovery_http, get_case_delivery_report_http,
    get_case_delivery_single_report_http, get_case_delivery_subscriptions_http,
    get_case_digest_http, get_case_inbox_http, get_case_kpi_http, get_case_lifecycle_http,
    get_case_status_http, get_case_summary_http, get_case_timeline_http, get_case_trends_http,
    get_case_workspace_http, get_inspector_http, query_cases_http,
    run_case_delivery_execution_retry_http, run_case_delivery_subscription_http,
};

pub fn router() -> Router<crate::routes::AppState> {
    Router::new()
        .route("/cssapi/v1/case/workspace", post(get_case_workspace_http))
        .route("/cssapi/v1/case/inspector", post(get_inspector_http))
        .route("/cssapi/v1/case/action", post(execute_case_action_http))
        .route("/cssapi/v1/case/status", post(get_case_status_http))
        .route("/cssapi/v1/case/lifecycle", post(get_case_lifecycle_http))
        .route("/cssapi/v1/case/timeline", post(get_case_timeline_http))
        .route("/cssapi/v1/case/summary", post(get_case_summary_http))
        .route(
            "/cssapi/v1/case/action-logs",
            post(get_case_action_logs_http),
        )
        .route("/cssapi/v1/case/query", post(query_cases_http))
        .route("/cssapi/v1/case/inbox", post(get_case_inbox_http))
        .route("/cssapi/v1/case/dashboard", get(get_case_dashboard_http))
        .route("/cssapi/v1/case/kpi", get(get_case_kpi_http))
        .route("/cssapi/v1/case/analytics", get(get_case_analytics_http))
        .route("/cssapi/v1/case/trends", post(get_case_trends_http))
        .route("/cssapi/v1/case/alerts", post(get_case_alerts_http))
        .route("/cssapi/v1/case/digest", post(get_case_digest_http))
        .route(
            "/cssapi/v1/case/briefing",
            post(get_case_briefing_pack_http),
        )
        .route(
            "/cssapi/v1/case/delivery/report",
            post(get_case_delivery_report_http),
        )
        .route(
            "/cssapi/v1/case/delivery/report-item",
            post(get_case_delivery_single_report_http),
        )
        .route(
            "/cssapi/v1/case/delivery/export",
            post(get_case_delivery_export_http),
        )
        .route(
            "/cssapi/v1/case/delivery",
            post(get_case_delivery_payload_http),
        )
        .route(
            "/cssapi/v1/case/delivery-v2",
            post(get_case_delivery_api_v2_http),
        )
        .route(
            "/cssapi/v1/case/delivery/subscriptions",
            get(get_case_delivery_subscriptions_http),
        )
        .route(
            "/cssapi/v1/case/delivery/subscriptions/run",
            post(run_case_delivery_subscription_http),
        )
        .route(
            "/cssapi/v1/case/delivery/logs",
            post(get_case_delivery_logs_http),
        )
        .route(
            "/cssapi/v1/case/delivery/execution-status",
            post(get_case_delivery_execution_status_http),
        )
        .route(
            "/cssapi/v1/case/delivery/recovery",
            post(get_case_delivery_recovery_http),
        )
        .route(
            "/cssapi/v1/case/delivery/ops-console",
            post(get_case_delivery_ops_console_http),
        )
        .route(
            "/cssapi/v1/case/delivery/execution-retry",
            post(run_case_delivery_execution_retry_http),
        )
}
