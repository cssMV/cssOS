use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryGuaranteeClass {
    BestEffort,
    Important,
    MustDeliver,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryGovernanceSeverity {
    #[serde(alias = "info")]
    Normal,
    #[serde(alias = "warning")]
    Elevated,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryGovernanceAction {
    None,
    RaiseAlert,
    RequireManualIntervention,
    EscalateOps,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryGovernanceDecisionKind {
    SilentFailureNotAllowed,
    ConsecutiveFailureEscalated,
    MustDeliverTargetViolated,
    ManualInterventionRequired,
    Healthy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryGovernanceRules {
    pub escalate_after_consecutive_failures: usize,
    #[serde(default)]
    pub must_deliver_targets: Vec<crate::css_case_delivery_api::types::DeliveryApiTarget>,
    #[serde(default)]
    pub no_silent_failure_targets: Vec<crate::css_case_delivery_api::types::DeliveryApiTarget>,
    pub manual_intervention_after_consecutive_failures: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryGovernanceInput {
    pub target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    pub consecutive_failures: usize,
    pub latest_failed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryGovernanceDecision {
    pub severity: DeliveryGovernanceSeverity,
    pub escalate: bool,
    pub require_manual_intervention: bool,
    pub must_deliver: bool,
    pub no_silent_failure: bool,
    #[serde(default)]
    pub reasons: Vec<String>,
}

// Legacy-kept request type for callers still framed around delivery log scope.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryGovernanceRequest {
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    pub delivered: bool,
    pub failure_streak: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryGovernanceLevel {
    Normal,
    Elevated,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryGovernanceEvaluationRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subscription_id: Option<String>,
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
}

pub type DeliveryGovernanceDecision = CssCaseDeliveryGovernanceDecision;
