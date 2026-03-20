use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum InspectorTargetKind {
    GovernanceTimelineItem,
    ReplayFrame,
    StoryboardCard,
    RuleAudit,
    Snapshot,
    Explain,
    TimelineUiItem,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InspectorRequest {
    pub target_kind: InspectorTargetKind,
    pub source_system: String,
    pub source_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InspectorSourcePanel {
    pub source_system: String,
    pub source_id: String,
    pub raw: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InspectorSnapshotPanel {
    #[serde(default)]
    pub snapshots: Vec<crate::css_signals_snapshot::types::CssSignalsSnapshot>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InspectorReplayPanel {
    #[serde(default)]
    pub deltas: Vec<crate::css_signals_replay::types::SignalReplayDelta>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InspectorRuleAuditPanel {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub audit: Option<crate::css_rule_audit::types::CssRuleAuditRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InspectorDecisionGraphPanel {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub graph: Option<crate::css_decision_graph::types::DecisionGraphView>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InspectorExplainPanel {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub explain: Option<crate::css_explain_api::types::ExplainResponse>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssInspectorView {
    pub target_kind: InspectorTargetKind,
    pub source_panel: InspectorSourcePanel,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub snapshot_panel: Option<InspectorSnapshotPanel>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub replay_panel: Option<InspectorReplayPanel>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rule_audit_panel: Option<InspectorRuleAuditPanel>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decision_graph_panel: Option<InspectorDecisionGraphPanel>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub explain_panel: Option<InspectorExplainPanel>,
}
