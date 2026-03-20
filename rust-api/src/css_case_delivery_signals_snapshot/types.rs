use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliverySignalsSnapshotSubjectKind {
    DeliveryObject,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliverySignalsSnapshotReason {
    DeliveryDecision,
    GovernanceAction,
    RecoveryBefore,
    RecoveryAfter,
    ManualCapture,
    RetryBefore,
    RetryAfter,
    RecoveryReview,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySignalsSnapshotSubject {
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySignalsSnapshotKey {
    pub target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    pub consecutive_failures: usize,
    pub latest_failed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySignalsSnapshotEnvelope {
    pub trust: crate::css_case_delivery_trust_view::types::CssCaseDeliveryTrustView,
    pub risk: crate::css_case_delivery_risk_view::types::CssCaseDeliveryRiskView,
    pub explain: crate::css_case_delivery_explain_view::types::CssCaseDeliveryExplainView,
    pub assurance: crate::css_case_delivery_assurance_view::types::CssCaseDeliveryAssuranceView,
    pub signals: crate::css_case_delivery_signals_hub::types::CssCaseDeliverySignalsHubView,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySignalsSnapshotPayload {
    pub hub: crate::css_case_delivery_signals_hub::types::CssCaseDeliverySignalsHubView,
    pub trust: crate::css_case_delivery_trust_view::types::CssCaseDeliveryTrustView,
    pub risk: crate::css_case_delivery_risk_view::types::CssCaseDeliveryRiskView,
    pub explain: crate::css_case_delivery_explain_view::types::CssCaseDeliveryExplainView,
    pub assurance: crate::css_case_delivery_assurance_view::types::CssCaseDeliveryAssuranceView,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliverySignalsSnapshotRecord {
    pub signals_snapshot_id: String,
    pub snapshot_id: String,
    pub subject_kind: DeliverySignalsSnapshotSubjectKind,
    pub subject_key: String,
    pub snapshot_key: DeliverySignalsSnapshotKey,
    pub snapshot_key_hash: String,
    pub snapshot_key_json: serde_json::Value,
    pub reason: DeliverySignalsSnapshotReason,
    pub signals_json: serde_json::Value,
    pub payload_json: serde_json::Value,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliverySignalsSnapshotLogicalRecord {
    pub signals_snapshot_id: String,
    pub snapshot_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject: Option<DeliverySignalsSnapshotSubject>,
    pub snapshot_key: DeliverySignalsSnapshotKey,
    pub reason: DeliverySignalsSnapshotReason,
    pub signals: crate::css_case_delivery_signals_hub::types::CssCaseDeliverySignalsHubView,
    pub envelope: DeliverySignalsSnapshotEnvelope,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureDeliverySignalsSnapshotRequest {
    pub target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    pub consecutive_failures: usize,
    pub latest_failed: bool,
    pub reason: DeliverySignalsSnapshotReason,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySignalsSnapshotDiffItem {
    pub field: String,
    pub before: String,
    pub after: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliverySignalsSnapshotDiff {
    pub from_snapshot_id: String,
    pub to_snapshot_id: String,
    #[serde(default)]
    pub changes: Vec<DeliverySignalsSnapshotDiffItem>,
}

// Legacy request kept for existing action/replay callers still framed around delivery logs.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDeliverySignalsSnapshotRequest {
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    pub delivered: bool,
    pub failure_streak: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub consecutive_failures: Option<usize>,
    #[serde(default)]
    pub retry_still_failing: bool,
    pub reason: DeliverySignalsSnapshotReason,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetDeliverySignalsSnapshotRequest {
    pub snapshot_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySignalsSnapshotQueryRequest {
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub limit: Option<usize>,
}
