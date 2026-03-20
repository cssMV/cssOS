use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryDecisionTraceHit {
    pub key: String,
    pub label: String,
    pub matched: bool,
    pub detail: String,

    // Legacy-kept compatibility fields for older explain/risk callers.
    pub rule_key: String,
    pub explanation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryDecisionTraceInput {
    pub target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    pub consecutive_failures: usize,
    pub latest_failed: bool,

    // Legacy-kept context for existing explain/signals/inspector callers.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_target: Option<crate::css_case_delivery_log::types::CaseDeliveryLogTarget>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_mode: Option<crate::css_case_delivery_log::types::CaseDeliveryLogMode>,
    #[serde(default)]
    pub retry_still_failing: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub delivered: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub failure_streak: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryDecisionDerived {
    pub escalate: bool,
    pub require_manual_intervention: bool,
    pub must_deliver: bool,
    pub no_silent_failure: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryDecisionTraceConclusion {
    pub decision: crate::css_case_delivery_governance::types::DeliveryGovernanceDecisionKind,
    pub severity: crate::css_case_delivery_governance::types::DeliveryGovernanceSeverity,
    pub action: crate::css_case_delivery_governance::types::DeliveryGovernanceAction,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryDecisionTrace {
    pub policy_version_id: String,
    pub policy_version_name: String,
    pub policy_version_label: String,

    pub input: DeliveryDecisionTraceInput,

    #[serde(default)]
    pub hits: Vec<DeliveryDecisionTraceHit>,

    #[serde(default)]
    pub rule_hits: Vec<DeliveryDecisionTraceHit>,

    pub derived: DeliveryDecisionDerived,
    pub decision: crate::css_case_delivery_governance::types::CssCaseDeliveryGovernanceDecision,

    // Legacy-kept compatibility fields for existing explain/trust/risk/signals callers.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub policy_version: Option<String>,
    pub policy_id: String,
    pub version: i32,
    pub evaluation: crate::css_case_delivery_policy_engine::types::DeliveryPolicyEvaluation,
    pub conclusion: DeliveryDecisionTraceConclusion,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryDecisionTraceRequest {
    pub target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    pub consecutive_failures: usize,
    pub latest_failed: bool,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_target: Option<crate::css_case_delivery_log::types::CaseDeliveryLogTarget>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_mode: Option<crate::css_case_delivery_log::types::CaseDeliveryLogMode>,
    #[serde(default)]
    pub retry_still_failing: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub delivered: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub failure_streak: Option<usize>,
}

pub type DeliveryDecisionRuleHit = DeliveryDecisionTraceHit;
pub type DeliveryDecisionTraceRuleHit = DeliveryDecisionTraceHit;
