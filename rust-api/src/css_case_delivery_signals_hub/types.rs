use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryInputSignals {
    pub target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    pub consecutive_failures: usize,
    pub latest_failed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryGovernanceSignals {
    pub policy_version_id: String,
    pub policy_version_label: String,
    pub severity: String,
    pub escalate: bool,
    pub require_manual_intervention: bool,
    pub must_deliver: bool,
    pub no_silent_failure: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryTrustSignals {
    pub trust_level: String,
    pub is_trusted: bool,
    pub is_high_attention: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryRiskSignals {
    pub risk_level: String,
    pub is_high_risk: bool,
    #[serde(default)]
    pub active_risk_factor_keys: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryAssuranceSignals {
    pub assurance_level: String,
    pub is_under_watch: bool,
    pub requires_manual_intervention: bool,
    pub requires_recovery: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryExplainSignals {
    pub management_summary: String,
    #[serde(default)]
    pub highlights: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliverySignalLevel {
    Info,
    Warning,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliverySignalKind {
    ConsecutiveFailure,
    MustDeliverViolation,
    ManualInterventionRequired,
    SilentFailureNotAllowed,
    GovernanceSeverity,
    TrustLevel,
    RiskLevel,
    AssuranceMonitoring,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySignal {
    pub kind: DeliverySignalKind,
    pub key: String,
    pub value: String,
    pub level: DeliverySignalLevel,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySignalSubject {
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DeliveryBaseSignals {
    pub consecutive_failures: usize,
    pub retry_still_failing: bool,
    pub must_deliver: bool,
    pub silent_failure_allowed: bool,
    pub should_escalate: bool,
    pub require_manual_intervention: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DeliveryDerivedSignals {
    pub governance_severity: String,
    pub trust_level: String,
    pub risk_level: String,
    pub is_trusted: bool,
    pub is_high_attention: bool,
    pub is_under_watch: bool,
    pub is_in_mandatory_recovery_queue: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliverySignalsHubView {
    pub input: DeliveryInputSignals,
    pub governance: DeliveryGovernanceSignals,
    pub trust: DeliveryTrustSignals,
    pub risk: DeliveryRiskSignals,
    pub assurance: DeliveryAssuranceSignals,
    pub explain: DeliveryExplainSignals,

    // Legacy-kept compatibility fields for older cache/replay/snapshot callers.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject: Option<DeliverySignalSubject>,
    #[serde(default)]
    pub base: DeliveryBaseSignals,
    #[serde(default)]
    pub derived: DeliveryDerivedSignals,
    #[serde(default)]
    pub explain_reasons: Vec<String>,
    #[serde(default)]
    pub signals: Vec<DeliverySignal>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySignalsHubViewRequest {
    pub target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    pub consecutive_failures: usize,
    pub latest_failed: bool,
}

// Legacy-kept request for older callers still framed around delivery logs.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySignalsHubRequest {
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    pub delivered: bool,
    pub failure_streak: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub consecutive_failures: Option<usize>,
    #[serde(default)]
    pub retry_still_failing: bool,
}
