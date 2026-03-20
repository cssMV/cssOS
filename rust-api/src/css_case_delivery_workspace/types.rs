use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryWorkspaceHeader {
    pub title: String,
    pub subtitle: String,

    // Legacy-kept compatibility fields for older callers.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target: Option<crate::css_case_delivery_log::types::CaseDeliveryLogTarget>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mode: Option<crate::css_case_delivery_log::types::CaseDeliveryLogMode>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryWorkspace {
    pub header: DeliveryWorkspaceHeader,
    pub trust: crate::css_case_delivery_trust_view::types::CssCaseDeliveryTrustView,
    pub risk: crate::css_case_delivery_risk_view::types::CssCaseDeliveryRiskView,
    pub explain: crate::css_case_delivery_explain_view::types::CssCaseDeliveryExplainView,
    pub assurance: crate::css_case_delivery_assurance_view::types::CssCaseDeliveryAssuranceView,
    pub timeline: crate::css_case_delivery_timeline_ui_model::types::CssCaseDeliveryTimelineUiModel,

    // Legacy-kept compatibility fields for older callers.
    pub subject_key: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resolution:
        Option<crate::css_case_delivery_resolution_engine::types::CssCaseDeliveryResolution>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryWorkspaceViewRequest {
    pub target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    pub consecutive_failures: usize,
    pub latest_failed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryWorkspaceRequest {
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    pub delivered: bool,
    pub failure_streak: usize,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timeline_limit: Option<usize>,
}
