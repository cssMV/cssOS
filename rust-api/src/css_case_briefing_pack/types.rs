use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BriefingTopInsight {
    pub title: String,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BriefingTrendHighlight {
    pub title: String,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseBriefingPack {
    pub date: String,
    pub headline: String,
    pub short_summary: String,
    pub digest: crate::css_case_digest_engine::types::CssCaseDigestView,
    pub kpi: crate::css_case_kpi_view::types::CssCaseKpiView,
    pub alerts: crate::css_case_alerts_view::types::CssCaseAlertsView,
    pub dashboard: crate::css_case_dashboard_view::types::CssCaseDashboardView,
    #[serde(default)]
    pub trend_highlights: Vec<BriefingTrendHighlight>,
    #[serde(default)]
    pub top_insights: Vec<BriefingTopInsight>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseBriefingPackRequest {
    pub today_yyyy_mm_dd: String,
    pub trend_days: usize,
}
