use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryBriefingKpiBlock {
    #[serde(default)]
    pub metrics: Vec<crate::css_case_delivery_kpi_view::types::DeliveryKpiMetric>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryBriefingAlertsBlock {
    #[serde(default)]
    pub alerts: Vec<crate::css_case_delivery_alerts_view::types::DeliveryAlertItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryBriefingInboxBlock {
    #[serde(default)]
    pub sections: Vec<crate::css_case_delivery_inbox_view::types::DeliveryInboxSection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryBriefingTrendsBlock {
    #[serde(default)]
    pub series: Vec<crate::css_case_delivery_trends_view::types::DeliveryTrendSeries>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryBriefingAnalyticsBlock {
    #[serde(default)]
    pub insights: Vec<crate::css_case_delivery_analytics_view::types::DeliveryAnalyticsInsight>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryBriefingPack {
    pub title: String,
    pub summary: String,

    #[serde(default)]
    pub highlights: Vec<String>,

    pub digest: crate::css_case_delivery_digest_engine::types::CssCaseDeliveryDigest,
    pub kpi: DeliveryBriefingKpiBlock,
    pub alerts: DeliveryBriefingAlertsBlock,
    pub inbox: DeliveryBriefingInboxBlock,
    pub trends: DeliveryBriefingTrendsBlock,
    pub analytics: DeliveryBriefingAnalyticsBlock,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DeliveryBriefingPackRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub days: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview_limit: Option<usize>,
}
