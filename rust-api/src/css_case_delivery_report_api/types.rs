use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryReportKind {
    Dashboard,
    Kpi,
    Analytics,
    Trends,
    Alerts,
    Digest,
    BriefingPack,
}

pub type DeliveryReportType = DeliveryReportKind;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryReportRequest {
    pub kind: DeliveryReportKind,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub days: Option<usize>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview_limit: Option<usize>,
}

pub type DeliveryReportApiRequest = DeliveryReportRequest;
pub type GetDeliveryReportRequest = DeliveryReportRequest;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetDeliveryDashboardRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview_limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GetDeliveryKpiRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GetDeliveryAnalyticsRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetDeliveryTrendsRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub days: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetDeliveryAlertsRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub days: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetDeliveryDigestRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub days: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview_limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetDeliveryBriefingPackRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub days: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview_limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetDeliveryReportBundleRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub days: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview_limit: Option<usize>,
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
pub struct DeliveryReportMeta {
    pub kind: DeliveryReportKind,
    pub title: String,
    pub generated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryReportBundleResponse {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dashboard:
        Option<crate::css_case_delivery_dashboard_view::types::CssCaseDeliveryDashboardView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kpi: Option<crate::css_case_delivery_kpi_view::types::CssCaseDeliveryKpiView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub analytics:
        Option<crate::css_case_delivery_analytics_view::types::CssCaseDeliveryAnalyticsView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub trends: Option<crate::css_case_delivery_trends_view::types::CssCaseDeliveryTrendsView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub alerts: Option<crate::css_case_delivery_alerts_view::types::CssCaseDeliveryAlertsView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub digest: Option<crate::css_case_delivery_digest_engine::types::CssCaseDeliveryDigest>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub briefing:
        Option<crate::css_case_delivery_briefing_pack::types::CssCaseDeliveryBriefingPack>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "payload_kind", content = "payload", rename_all = "snake_case")]
pub enum DeliveryReportPayload {
    Dashboard(crate::css_case_delivery_dashboard_view::types::CssCaseDeliveryDashboardView),
    Kpi(crate::css_case_delivery_kpi_view::types::CssCaseDeliveryKpiView),
    Analytics(crate::css_case_delivery_analytics_view::types::CssCaseDeliveryAnalyticsView),
    Trends(crate::css_case_delivery_trends_view::types::CssCaseDeliveryTrendsView),
    Alerts(crate::css_case_delivery_alerts_view::types::CssCaseDeliveryAlertsView),
    Digest(crate::css_case_delivery_digest_engine::types::CssCaseDeliveryDigest),
    BriefingPack(crate::css_case_delivery_briefing_pack::types::CssCaseDeliveryBriefingPack),
}

pub type DeliveryReportData = DeliveryReportPayload;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryReportApiResponse {
    pub meta: DeliveryReportMeta,
    pub data: DeliveryReportPayload,
}

pub type CssCaseDeliveryReportResponse = CssCaseDeliveryReportApiResponse;
