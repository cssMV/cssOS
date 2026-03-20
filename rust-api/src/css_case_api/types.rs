use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseApiSubjectKind {
    User,
    Catalog,
    Deal,
    Ownership,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseRef {
    pub case_id: String,
    pub subject_kind: CaseApiSubjectKind,
    pub subject_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseRequest {
    pub case_id: String,
    pub subject_kind: CaseApiSubjectKind,
    pub subject_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteCaseActionRequest {
    pub case_id: String,
    pub subject_kind: CaseApiSubjectKind,
    pub subject_id: String,
    pub action: crate::css_case_actions_engine::types::CaseActionKind,
    pub actor_user_id: String,
    pub reason: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub review_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecuteCaseActionResponse {
    pub result: crate::css_case_actions_engine::types::CaseActionResult,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub latest_status: Option<crate::css_case_status_view::types::CssCaseStatusView>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseWorkspaceResponse {
    pub workspace: crate::css_case_workspace::types::CssCaseWorkspace,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetInspectorRequest {
    pub target_kind: crate::css_inspector_view::types::InspectorTargetKind,
    pub source_system: String,
    pub source_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetInspectorResponse {
    pub inspector: crate::css_inspector_view::types::CssInspectorView,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseSummaryResponse {
    pub summary: crate::css_case_summary_engine::types::CssCaseSummaryView,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseStatusResponse {
    pub status: crate::css_case_status_view::types::CssCaseStatusView,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseLifecycleResponse {
    pub lifecycle: crate::css_case_lifecycle_view::types::CssCaseLifecycleView,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseTimelineResponse {
    pub timeline: crate::css_case_timeline_merge::types::CssCaseTimelineView,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseActionLogsResponse {
    #[serde(default)]
    pub logs: Vec<crate::css_case_action_log::types::CssCaseActionLogRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryCasesResponse {
    pub result: crate::css_case_query_engine::types::CaseQueryResponse,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseInboxResponse {
    pub inbox: crate::css_case_inbox_view::types::CssCaseInboxView,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseDashboardResponse {
    pub dashboard: crate::css_case_dashboard_view::types::CssCaseDashboardView,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseKpiResponse {
    pub kpi: crate::css_case_kpi_view::types::CssCaseKpiView,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseAnalyticsResponse {
    pub analytics: crate::css_case_analytics_view::types::CssCaseAnalyticsView,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseTrendsResponse {
    pub trends: crate::css_case_trends_view::types::CssCaseTrendsView,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseAlertsResponse {
    pub alerts: crate::css_case_alerts_view::types::CssCaseAlertsView,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseDigestResponse {
    pub digest: crate::css_case_digest_engine::types::CssCaseDigestView,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseBriefingPackResponse {
    pub briefing: crate::css_case_briefing_pack::types::CssCaseBriefingPack,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseDeliveryReportResponse {
    pub report: crate::css_case_delivery_report_api::types::CssCaseDeliveryReportBundleResponse,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseDeliverySingleReportResponse {
    pub report: crate::css_case_delivery_report_api::types::CssCaseDeliveryReportApiResponse,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseDeliveryExportResponse {
    pub export: crate::css_case_delivery_export_engine::types::CssCaseDeliveryExportResult,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseDeliveryPayloadResponse {
    pub delivery: crate::css_case_delivery_api::types::CssCaseDeliveryApiResponse,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseDeliveryApiV2Response {
    pub delivery: crate::css_case_delivery_delivery_api::types::CssCaseDeliveryApiResponse,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseDeliverySubscriptionsResponse {
    #[serde(default)]
    pub subscriptions:
        Vec<crate::css_case_delivery_subscription_engine::types::CssCaseDeliverySubscriptionRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunCaseDeliverySubscriptionRequest {
    pub subscription_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunCaseDeliverySubscriptionResponse {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub log: Option<crate::css_case_delivery_log::types::CssCaseDeliveryLogRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseDeliveryLogsResponse {
    #[serde(default)]
    pub logs: Vec<crate::css_case_delivery_log::types::CssCaseDeliveryLogRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseDeliveryExecutionStatusResponse {
    pub status:
        crate::css_case_delivery_execution_status_view::types::CssCaseDeliveryExecutionStatusView,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseDeliveryRecoveryResponse {
    pub recovery: crate::css_case_delivery_recovery_view::types::CssCaseDeliveryRecoveryView,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseDeliveryOpsConsoleResponse {
    pub console: crate::css_case_delivery_ops_console::types::CssCaseDeliveryOpsConsole,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunCaseDeliveryExecutionRetryResponse {
    pub retry: crate::css_case_delivery_execution_retry_engine::types::CssCaseDeliveryRetryResult,
}
