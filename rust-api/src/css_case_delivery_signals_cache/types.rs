use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySignalsCacheKey {
    pub target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    pub consecutive_failures: usize,
    pub latest_failed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySignalsCachePayload {
    pub trust: crate::css_case_delivery_trust_view::types::CssCaseDeliveryTrustView,
    pub risk: crate::css_case_delivery_risk_view::types::CssCaseDeliveryRiskView,
    pub explain: crate::css_case_delivery_explain_view::types::CssCaseDeliveryExplainView,
    pub assurance: crate::css_case_delivery_assurance_view::types::CssCaseDeliveryAssuranceView,
    pub hub: crate::css_case_delivery_signals_hub::types::CssCaseDeliverySignalsHubView,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySignalsCacheEnvelope {
    pub trust: crate::css_case_delivery_trust_view::types::CssCaseDeliveryTrustView,
    pub risk: crate::css_case_delivery_risk_view::types::CssCaseDeliveryRiskView,
    pub explain: crate::css_case_delivery_explain_view::types::CssCaseDeliveryExplainView,
    pub assurance: crate::css_case_delivery_assurance_view::types::CssCaseDeliveryAssuranceView,
    pub hub: crate::css_case_delivery_signals_hub::types::CssCaseDeliverySignalsHubView,
    pub cached_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySignalsCacheViewRequest {
    pub target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    pub consecutive_failures: usize,
    pub latest_failed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliverySignalsCacheRecord {
    pub signals_cache_id: String,
    pub cache_key_hash: String,
    pub cache_key_json: serde_json::Value,
    pub signals_json: serde_json::Value,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySignalsCacheRecord {
    pub signals_cache_id: String,
    pub cache_key: DeliverySignalsCacheKey,
    pub key_hash: String,
    pub signals: crate::css_case_delivery_signals_hub::types::CssCaseDeliverySignalsHubView,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetDeliverySignalsCacheRequest {
    pub target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    pub consecutive_failures: usize,
    pub latest_failed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefreshDeliverySignalsCacheRequest {
    pub target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    pub consecutive_failures: usize,
    pub latest_failed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySignalsCachedViews {
    pub trust: crate::css_case_delivery_trust_view::types::CssCaseDeliveryTrustView,
    pub risk: crate::css_case_delivery_risk_view::types::CssCaseDeliveryRiskView,
    pub explain: crate::css_case_delivery_explain_view::types::CssCaseDeliveryExplainView,
    pub assurance: crate::css_case_delivery_assurance_view::types::CssCaseDeliveryAssuranceView,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySignalsCacheEnvelopeView {
    pub cache: DeliverySignalsCacheRecord,
    pub views: DeliverySignalsCachedViews,
    pub envelope: DeliverySignalsCacheEnvelope,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySignalsLegacyKey {
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySignalsLegacyRecord {
    pub cache_id: String,
    pub key: DeliverySignalsLegacyKey,
    pub payload: DeliverySignalsCachePayload,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySignalsCacheRequest {
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    pub delivered: bool,
    pub failure_streak: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub consecutive_failures: Option<usize>,
    #[serde(default)]
    pub retry_still_failing: bool,
}
