use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryPolicyConfig {
    pub escalate_after_consecutive_failures: usize,
    pub manual_intervention_after_consecutive_failures: usize,
    #[serde(default)]
    pub must_deliver_targets: Vec<crate::css_case_delivery_api::types::DeliveryApiTarget>,
    #[serde(default)]
    pub no_silent_failure_targets: Vec<crate::css_case_delivery_api::types::DeliveryApiTarget>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryPolicyRecord {
    pub policy_id: String,
    pub policy_name: String,
    pub config: CssCaseDeliveryPolicyConfig,
    pub is_active: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDeliveryPolicyRequest {
    pub policy_name: String,
    pub config: CssCaseDeliveryPolicyConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryPolicyEvaluationRequest {
    pub target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    pub consecutive_failures: usize,
    pub latest_failed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryPolicyEvaluation {
    pub policy_id: String,
    pub policy_name: String,
    pub decision: crate::css_case_delivery_governance::types::CssCaseDeliveryGovernanceDecision,
}

// Legacy-kept compatibility types for versioning/audit and older callers.

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryPolicyRuleSet {
    pub escalation_failure_threshold: usize,
    pub manual_intervention_failure_threshold: usize,
    #[serde(default)]
    pub must_deliver_targets: Vec<crate::css_case_delivery_log::types::CaseDeliveryLogTarget>,
    #[serde(default)]
    pub silent_failure_allowed_targets:
        Vec<crate::css_case_delivery_log::types::CaseDeliveryLogTarget>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryPolicyRecord {
    pub policy_id: String,
    pub name: String,
    pub active: bool,
    pub rules: DeliveryPolicyRuleSet,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryPolicyGuaranteeClass {
    BestEffort,
    Important,
    MustDeliver,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryPolicySeverity {
    Info,
    Warning,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryPolicyAction {
    None,
    RaiseAlert,
    RequireManualIntervention,
    EscalateOps,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryFailureThresholdRule {
    pub warning_streak: usize,
    pub critical_streak: usize,
    pub warning_action: DeliveryPolicyAction,
    pub critical_action: DeliveryPolicyAction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryTargetPolicyRule {
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub guarantee_class: DeliveryPolicyGuaranteeClass,
    pub silent_failure_not_allowed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryModePolicyRule {
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    pub manual_intervention_required_on_failure: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryPolicy {
    pub policy_id: String,
    pub version: i32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version_label: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    pub is_active: bool,
    pub failure_threshold_rule: DeliveryFailureThresholdRule,
    #[serde(default)]
    pub target_rules: Vec<DeliveryTargetPolicyRule>,
    #[serde(default)]
    pub mode_rules: Vec<DeliveryModePolicyRule>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryPolicyEvaluationResult {
    pub policy_id: String,
    pub version: i32,
    pub decision: crate::css_case_delivery_governance::types::DeliveryGovernanceDecisionKind,
    pub severity: crate::css_case_delivery_governance::types::DeliveryGovernanceSeverity,
    pub action: crate::css_case_delivery_governance::types::DeliveryGovernanceAction,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryPolicyEvaluation {
    pub must_deliver: bool,
    pub silent_failure_allowed: bool,
    pub require_manual_intervention: bool,
    pub should_escalate: bool,
    #[serde(default)]
    pub reasons: Vec<String>,
}
