use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DeliveryQueryFilters {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub state: Option<crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub trust_level: Option<crate::css_case_delivery_trust_view::types::DeliveryTrustLevel>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub risk_level: Option<crate::css_case_delivery_risk_view::types::DeliveryRiskLevel>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub requires_manual_intervention: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_escalated: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_recent_retry: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_recent_resolution_change: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryQueryRequest {
    pub filters: DeliveryQueryFilters,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryQueryResultItem {
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,

    pub status: crate::css_case_delivery_status_view::types::CssCaseDeliveryStatusView,
    pub summary: crate::css_case_delivery_summary_engine::types::CssCaseDeliverySummary,

    pub trust_level: crate::css_case_delivery_trust_view::types::DeliveryTrustLevel,
    pub risk_level: crate::css_case_delivery_risk_view::types::DeliveryRiskLevel,
    pub requires_manual_intervention: bool,
    pub is_escalated: bool,
    pub has_recent_retry: bool,
    pub has_recent_resolution_change: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryQueryResult {
    #[serde(default)]
    pub items: Vec<DeliveryQueryResultItem>,
}
