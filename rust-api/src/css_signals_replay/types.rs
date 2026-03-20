use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ReplaySubjectKind {
    User,
    Catalog,
    Deal,
    Ownership,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ReplayChangeKind {
    Added,
    Removed,
    SeverityIncreased,
    SeverityDecreased,
    Unchanged,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignalReplayDelta {
    pub signal_kind: crate::css_signals_hub::types::SignalKind,
    pub change_kind: ReplayChangeKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub from_severity: Option<crate::css_signals_hub::types::SignalSeverity>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub to_severity: Option<crate::css_signals_hub::types::SignalSeverity>,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignalsReplayFrame {
    pub snapshot_id: String,
    pub created_at: String,
    pub purpose: crate::css_signals_snapshot::types::SnapshotPurpose,
    #[serde(default)]
    pub signals: Vec<crate::css_signals_hub::types::CssSignal>,
    #[serde(default)]
    pub deltas_from_previous: Vec<SignalReplayDelta>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignalsReplayView {
    pub subject_kind: ReplaySubjectKind,
    pub subject_id: String,
    #[serde(default)]
    pub frames: Vec<SignalsReplayFrame>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplayRequest {
    pub subject_kind: ReplaySubjectKind,
    pub subject_id: String,
}
