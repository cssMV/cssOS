use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseReportDateRange {
    pub end_date_yyyy_mm_dd: String,
    pub days: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseDashboardRequest {
    pub today_yyyy_mm_dd: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseKpiRequest {
    pub today_yyyy_mm_dd: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GetCaseAnalyticsRequest {}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseTrendsRequest {
    pub end_date_yyyy_mm_dd: String,
    pub days: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseAlertsRequest {
    pub end_date_yyyy_mm_dd: String,
    pub days: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseDigestRequest {
    pub today_yyyy_mm_dd: String,
    pub trend_days: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseBriefingRequest {
    pub today_yyyy_mm_dd: String,
    pub trend_days: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCaseReportBundleRequest {
    pub today_yyyy_mm_dd: String,
    pub trend_days: usize,
    #[serde(default)]
    pub include_dashboard: bool,
    #[serde(default)]
    pub include_kpi: bool,
    #[serde(default)]
    pub include_analytics: bool,
    #[serde(default)]
    pub include_trends: bool,
    #[serde(default)]
    pub include_alerts: bool,
    #[serde(default)]
    pub include_digest: bool,
    #[serde(default)]
    pub include_briefing: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseReportBundleResponse {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dashboard: Option<crate::css_case_dashboard_view::types::CssCaseDashboardView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kpi: Option<crate::css_case_kpi_view::types::CssCaseKpiView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub analytics: Option<crate::css_case_analytics_view::types::CssCaseAnalyticsView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub trends: Option<crate::css_case_trends_view::types::CssCaseTrendsView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub alerts: Option<crate::css_case_alerts_view::types::CssCaseAlertsView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub digest: Option<crate::css_case_digest_engine::types::CssCaseDigestView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub briefing: Option<crate::css_case_briefing_pack::types::CssCaseBriefingPack>,
}
