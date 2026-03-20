use crate::css_case_delivery_actions_engine::types::DeliveryActionKind;
use crate::css_case_delivery_timeline_merge::types::{
    DeliveryMergedTimelineNode, DeliveryMergedTimelineNodeKind, DeliveryMergedTimelineNodeTone,
};

pub fn action_title(action: &DeliveryActionKind) -> String {
    match action {
        DeliveryActionKind::Retry => "retry".into(),
        DeliveryActionKind::ForceRefreshSignals => "force_refresh_signals".into(),
        DeliveryActionKind::CaptureSnapshot => "capture_snapshot".into(),
        DeliveryActionKind::EscalateOps => "escalate_ops".into(),
        DeliveryActionKind::RequireManualIntervention => "require_manual_intervention".into(),
    }
}

pub fn tone_from_action_log(
    log: &crate::css_case_delivery_action_log::types::DeliveryActionLogRecord,
) -> DeliveryMergedTimelineNodeTone {
    use crate::css_case_delivery_timeline_merge::types::DeliveryMergedTimelineNodeTone::*;

    if !log.success {
        return Critical;
    }

    match log.action {
        DeliveryActionKind::Retry => Warning,
        DeliveryActionKind::ForceRefreshSignals => Neutral,
        DeliveryActionKind::CaptureSnapshot => Neutral,
        DeliveryActionKind::EscalateOps => Critical,
        DeliveryActionKind::RequireManualIntervention => Critical,
    }
}

pub fn tone_from_timeline_node(
    node: &crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineNode,
) -> DeliveryMergedTimelineNodeTone {
    match node.tone {
        crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineNodeTone::Neutral => {
            DeliveryMergedTimelineNodeTone::Neutral
        }
        crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineNodeTone::Warning => {
            DeliveryMergedTimelineNodeTone::Warning
        }
        crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineNodeTone::Critical => {
            DeliveryMergedTimelineNodeTone::Critical
        }
        crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineNodeTone::Positive => {
            DeliveryMergedTimelineNodeTone::Positive
        }
    }
}

pub fn merged_node_from_timeline(
    idx: usize,
    node: &crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineNode,
) -> DeliveryMergedTimelineNode {
    DeliveryMergedTimelineNode {
        node_id: format!("merged_signal_{idx}"),
        source:
            crate::css_case_delivery_timeline_merge::types::DeliveryTimelineMergedSource::Signal,
        merged_kind:
            crate::css_case_delivery_timeline_merge::types::DeliveryTimelineMergedKind::State,
        kind: DeliveryMergedTimelineNodeKind::SignalState,
        tone: tone_from_timeline_node(node),
        title: node.title.clone(),
        body: node.body.clone(),
        created_at: node.created_at.clone().unwrap_or_default(),
        is_pivot: node.is_pivot,
        summary: node.summary.clone(),
        timestamp: node.timestamp.clone().unwrap_or_default(),
        badges: node.badges.clone(),
        is_turning_point: node.is_turning_point,
        signal_snapshot_id: None,
        action_log_id: None,
    }
}

pub fn merged_node_from_action_log(
    idx: usize,
    log: &crate::css_case_delivery_action_log::types::DeliveryActionLogRecord,
) -> DeliveryMergedTimelineNode {
    DeliveryMergedTimelineNode {
        node_id: format!("merged_action_{idx}"),
        source:
            crate::css_case_delivery_timeline_merge::types::DeliveryTimelineMergedSource::Action,
        merged_kind:
            crate::css_case_delivery_timeline_merge::types::DeliveryTimelineMergedKind::Action,
        kind: DeliveryMergedTimelineNodeKind::Action,
        tone: tone_from_action_log(log),
        title: action_title(&log.action),
        body: log.message.clone(),
        created_at: log.created_at.clone(),
        is_pivot: matches!(
            log.action,
            DeliveryActionKind::Retry
                | DeliveryActionKind::EscalateOps
                | DeliveryActionKind::RequireManualIntervention
        ),
        summary: log.result_message.clone(),
        timestamp: log.created_at.clone(),
        badges: vec![
            format!("actor: {}", log.actor_user_id),
            format!("success: {}", log.success),
        ],
        is_turning_point: matches!(
            log.action,
            DeliveryActionKind::Retry
                | DeliveryActionKind::EscalateOps
                | DeliveryActionKind::RequireManualIntervention
        ),
        signal_snapshot_id: log.snapshot_id.clone(),
        action_log_id: Some(log.action_log_id.clone()),
    }
}

pub fn sort_merged_nodes(
    mut nodes: Vec<DeliveryMergedTimelineNode>,
) -> Vec<DeliveryMergedTimelineNode> {
    nodes.sort_by(|a, b| {
        a.timestamp
            .cmp(&b.timestamp)
            .then_with(|| a.node_id.cmp(&b.node_id))
    });
    nodes
}
