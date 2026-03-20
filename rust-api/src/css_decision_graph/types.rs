use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GraphNodeKind {
    PolicyVersion,
    PolicyRule,
    RuleAudit,
    TsDecision,
    DisputeCase,
    ModerationCase,
    ReviewItem,
    ReviewDecision,
    GovernanceTimelineEvent,
    CreditEvent,
    BusinessAction,
    User,
    Catalog,
    Auction,
    Deal,
    Ownership,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GraphEdgeKind {
    UsesPolicyVersion,
    EvaluatesRule,
    ProducesDecision,
    TriggersDispute,
    TriggersModeration,
    TriggersReview,
    TriggersCreditChange,
    RecordedInTimeline,
    BelongsToSubject,
    ExplainsDecision,
    ResultsInRestriction,
    ResultsInFreeze,
    ResultsInWarning,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DecisionGraphNode {
    pub node_id: String,
    pub node_kind: GraphNodeKind,
    pub source_system: String,
    pub source_id: String,
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject_kind: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DecisionGraphEdge {
    pub edge_id: String,
    pub from_node_id: String,
    pub to_node_id: String,
    pub edge_kind: GraphEdgeKind,
    pub label: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct DecisionGraphView {
    #[serde(default)]
    pub nodes: Vec<DecisionGraphNode>,
    #[serde(default)]
    pub edges: Vec<DecisionGraphEdge>,
}
