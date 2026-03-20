use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliverySignalsInvalidationReason {
    DeliveryLogChanged,
    RetryResultChanged,
    PolicyActiveVersionChanged,
    GovernanceDecisionChanged,
    RecoveryStateChanged,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DeliverySignalsInvalidationScope {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target: Option<crate::css_case_delivery_api::types::DeliveryApiTarget>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub consecutive_failures: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub latest_failed: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliverySignalsInvalidationRecord {
    pub invalidation_id: String,
    pub reason: DeliverySignalsInvalidationReason,
    pub scope: DeliverySignalsInvalidationScope,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDeliverySignalsInvalidationRequest {
    pub reason: DeliverySignalsInvalidationReason,
    pub scope: DeliverySignalsInvalidationScope,
}

// Legacy compatibility types for existing action/log/retry callers.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliverySignalsInvalidationEventKind {
    DeliveryLogInserted,
    RetryResultChanged,
    PolicyActiveSwitched,
    GovernanceDecisionChanged,
    RecoveryStatusChanged,
}

pub type DeliverySignalsInvalidationReasonLegacy = DeliverySignalsInvalidationEventKind;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySignalsInvalidationEvent {
    pub kind: DeliverySignalsInvalidationEventKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target: Option<crate::css_case_delivery_log::types::CaseDeliveryLogTarget>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mode: Option<crate::css_case_delivery_log::types::CaseDeliveryLogMode>,
    pub occurred_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliverySignalsInvalidationScopeKind {
    SingleSubject,
    Global,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySignalsInvalidationResult {
    pub invalidated: bool,
    pub scope: DeliverySignalsInvalidationScopeKind,
    #[serde(default)]
    pub invalidated_subject_keys: Vec<String>,
    pub message: String,
}
