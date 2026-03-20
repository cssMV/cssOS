use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsoleQueueItem {
    pub review_id: String,
    pub subject_kind: String,
    pub subject_id: String,
    pub priority: String,
    pub status: String,
    pub source_action: String,
    pub source_code: String,
    pub reason: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub actor_user_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assigned_reviewer_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsoleReputationView {
    pub user_id: String,
    pub score: i32,
    pub level: String,
    pub violation_count: i32,
    #[serde(default)]
    pub active_penalties: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsoleDisputeView {
    pub dispute_id: String,
    pub kind: String,
    pub severity: String,
    pub status: String,
    pub message: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsoleModerationView {
    pub moderation_id: String,
    pub subject_kind: String,
    pub subject_id: String,
    pub level: String,
    pub action: String,
    pub reason: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsoleAuctionSummary {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub catalog_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_leader_user_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_price_cents: Option<i64>,
    #[serde(default)]
    pub bid_count: i32,
    #[serde(default)]
    pub finalized: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsoleDealSummary {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub deal_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub seller_user_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub buyer_user_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub price_cents: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsoleOwnershipSummary {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ownership_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_user_id: Option<String>,
    #[serde(default)]
    pub priceless: bool,
    #[serde(default)]
    pub resale_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsoleBidLedgerView {
    pub total_entries: i32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_leader_user_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_price_cents: Option<i64>,
    #[serde(default)]
    pub finalized: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsoleCaseView {
    pub review: ConsoleQueueItem,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub workspace: Option<crate::css_case_workspace::types::CssCaseWorkspace>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub inspector: Option<crate::css_inspector_view::types::CssInspectorView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reputation: Option<ConsoleReputationView>,
    #[serde(default)]
    pub disputes: Vec<ConsoleDisputeView>,
    #[serde(default)]
    pub moderation_cases: Vec<ConsoleModerationView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auction: Option<ConsoleAuctionSummary>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub deal: Option<ConsoleDealSummary>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ownership: Option<ConsoleOwnershipSummary>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bid_ledger: Option<ConsoleBidLedgerView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decision_graph: Option<crate::css_decision_graph::types::DecisionGraphView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub operator_reasoning: Option<crate::css_reasoning_view::types::CssReasoningView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub signals_replay: Option<crate::css_signals_replay::types::SignalsReplayView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub signals_narrative: Option<crate::css_signals_narrative::types::CssSignalsNarrative>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub signals_storyboard: Option<crate::css_signals_storyboard::types::CssSignalsStoryboard>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timeline_ui_model: Option<crate::css_timeline_ui_model::types::CssTimelineUiModel>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub case_timeline: Option<crate::css_case_timeline_merge::types::CssCaseTimelineView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timeline_explain:
        Option<crate::css_case_timeline_explain::types::CssCaseTimelineExplainView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub case_status: Option<crate::css_case_status_view::types::CssCaseStatusView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lifecycle_view: Option<crate::css_case_lifecycle_view::types::CssCaseLifecycleView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub summary_view: Option<crate::css_case_summary_engine::types::CssCaseSummaryView>,
}
