use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DashboardCardKind {
    Pending,
    HighRisk,
    FrozenUntilReview,
    UpdatedToday,
    EscalatedRecently,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardMetricCard {
    pub kind: DashboardCardKind,
    pub label: String,
    pub total: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardInboxPreview {
    pub kind: DashboardCardKind,
    pub label: String,
    pub total: usize,
    #[serde(default)]
    pub rows: Vec<crate::css_case_query_engine::types::CaseQueryRow>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDashboardView {
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
    #[serde(default)]
    pub metrics: Vec<DashboardMetricCard>,
    #[serde(default)]
    pub inbox_previews: Vec<DashboardInboxPreview>,
}
