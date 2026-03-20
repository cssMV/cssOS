use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryInspectorHeader {
    pub title: String,
    pub subtitle: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryInspectorActionView {
    pub kind: crate::css_case_delivery_actions_engine::types::DeliveryActionKind,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryInspectorReplayDelta {
    pub field: String,
    pub before: String,
    pub after: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryInspectorView {
    pub header: DeliveryInspectorHeader,
    pub signals: crate::css_case_delivery_signals_hub::types::CssCaseDeliverySignalsHubView,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub latest_snapshot: Option<
        crate::css_case_delivery_signals_snapshot::types::CssCaseDeliverySignalsSnapshotRecord,
    >,

    #[serde(default)]
    pub replay_deltas: Vec<DeliveryInspectorReplayDelta>,

    pub decision_trace:
        crate::css_case_delivery_decision_trace::types::CssCaseDeliveryDecisionTrace,
    pub explain: crate::css_case_delivery_explain_view::types::CssCaseDeliveryExplainView,
    pub policy_version_id: String,
    pub policy_version_label: String,

    // Legacy-kept compatibility fields for older callers.
    pub subject_key: String,
    pub workspace: crate::css_case_delivery_workspace::types::CssCaseDeliveryWorkspace,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub replay_delta: Option<DeliveryReplayDeltaView>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub active_policy:
        Option<crate::css_case_delivery_policy_versioning::types::DeliveryPolicyVersionRecord>,

    #[serde(default)]
    pub recent_policy_audits:
        Vec<crate::css_case_delivery_policy_audit::types::CssCaseDeliveryPolicyAuditRecord>,

    #[serde(default)]
    pub available_actions: Vec<DeliveryInspectorActionView>,

    #[serde(default)]
    pub recent_action_logs:
        Vec<crate::css_case_delivery_action_log::types::DeliveryActionLogRecord>,

    pub resolution: crate::css_case_delivery_resolution_engine::types::CssCaseDeliveryResolution,
    pub explain_detail: crate::css_case_delivery_explain_view::types::CssCaseDeliveryExplainView,
    pub trust_detail: crate::css_case_delivery_trust_view::types::CssCaseDeliveryTrustView,
    pub risk_detail: crate::css_case_delivery_risk_view::types::CssCaseDeliveryRiskView,
    pub timeline_detail:
        crate::css_case_delivery_timeline_ui_model::types::CssCaseDeliveryTimelineUiModel,
    pub merged_timeline:
        crate::css_case_delivery_timeline_merge::types::CssCaseDeliveryTimelineMergeView,
    pub timeline_explain:
        crate::css_case_delivery_timeline_explain::types::CssCaseDeliveryTimelineExplainView,
    pub assurance_detail:
        crate::css_case_delivery_assurance_view::types::CssCaseDeliveryAssuranceView,
}

pub type DeliveryReplayDeltaView = DeliveryInspectorReplayDeltaViewCompat;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryInspectorReplayDeltaViewCompat {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub previous_snapshot_id: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_snapshot_id: Option<String>,

    #[serde(default)]
    pub changes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryInspectorViewRequest {
    pub target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    pub consecutive_failures: usize,
    pub latest_failed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryInspectorRequest {
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    pub delivered: bool,
    pub failure_streak: usize,
}
