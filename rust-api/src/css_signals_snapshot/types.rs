use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SnapshotSubjectKind {
    User,
    Catalog,
    Deal,
    Ownership,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SnapshotPurpose {
    TrustCheck,
    RiskCheck,
    TsDecisionInput,
    ReviewOpen,
    ReviewDecision,
    DealFinalize,
    BidSubmit,
    OwnershipTransfer,
    AuditEvidence,
    DisputeEvidence,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssSignalsSnapshot {
    pub snapshot_id: String,
    pub subject_kind: SnapshotSubjectKind,
    pub subject_id: String,
    pub purpose: SnapshotPurpose,
    pub signals_bundle: crate::css_signals_hub::types::SignalsBundle,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub related_audit_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub related_review_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub related_deal_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub related_dispute_id: Option<String>,
    pub source_system: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotCreateRequest {
    pub subject_kind: SnapshotSubjectKind,
    pub subject_id: String,
    pub purpose: SnapshotPurpose,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub related_audit_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub related_review_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub related_deal_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub related_dispute_id: Option<String>,
    pub source_system: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotView {
    pub snapshot: CssSignalsSnapshot,
}
