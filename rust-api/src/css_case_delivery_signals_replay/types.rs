use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliverySignalsReplayTransitionKind {
    Initial,
    TrustChanged,
    RiskChanged,
    AssuranceChanged,
    ExplainChanged,
    Recovered,
    Degraded,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySignalsReplayChange {
    pub field: String,
    pub before: String,
    pub after: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySignalsReplayNode {
    pub snapshot_id: String,
    pub reason: crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotReason,
    pub created_at: String,
    pub trust_level: String,
    pub risk_level: String,
    pub assurance_level: String,
    #[serde(default)]
    pub changes: Vec<DeliverySignalsReplayChange>,

    // Legacy-kept compatibility fields for older consumers.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub governance_severity: Option<String>,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliverySignalsReplay {
    pub snapshot_key: crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotKey,
    #[serde(default)]
    pub nodes: Vec<DeliverySignalsReplayNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySignalsReplayViewRequest {
    pub target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    pub consecutive_failures: usize,
    pub latest_failed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySignalsReplayStep {
    pub snapshot_id: String,
    pub created_at: String,
    pub transition: DeliverySignalsReplayTransitionKind,
    pub summary: String,
    pub trust_level: String,
    pub risk_level: String,
    pub monitoring_level: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliverySignalsReplayView {
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    pub subject_key: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub snapshot_key:
        Option<crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotKey>,

    #[serde(default)]
    pub nodes: Vec<DeliverySignalsReplayNode>,

    #[serde(default)]
    pub steps: Vec<DeliverySignalsReplayStep>,
}

// Legacy-kept request for older callers still keyed by delivery log target/mode.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySignalsReplayRequest {
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub limit: Option<usize>,
}
