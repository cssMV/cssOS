use crate::css_case_timeline_explain::types::{
    CssCaseTimelineExplainView, TimelineKeyNode, TimelineKeyNodeKind,
};
use crate::css_case_timeline_merge::types::{
    CaseTimelineItemKind, CaseTimelineTone, CssCaseTimelineItem, CssCaseTimelineView,
};

fn is_case_action(item: &CssCaseTimelineItem) -> bool {
    matches!(item.kind, CaseTimelineItemKind::CaseAction)
}

fn is_turning_point(item: &CssCaseTimelineItem) -> bool {
    matches!(
        item.tone,
        CaseTimelineTone::Warning | CaseTimelineTone::Danger
    )
}

fn is_outcome_changing(item: &CssCaseTimelineItem) -> bool {
    if matches!(item.kind, CaseTimelineItemKind::CurrentState) {
        return true;
    }

    let title = item.title.to_lowercase();
    title.contains("freeze")
        || title.contains("release")
        || title.contains("approve")
        || title.contains("reject")
        || title.contains("review_rejected")
        || title.contains("dealreleased")
        || title.contains("auctionunfrozen")
}

pub fn maybe_to_key_node(item: &CssCaseTimelineItem) -> Option<TimelineKeyNode> {
    if is_case_action(item) {
        return Some(TimelineKeyNode {
            item_id: item.item_id.clone(),
            kind: TimelineKeyNodeKind::HumanIntervention,
            created_at: item.created_at.clone(),
            title: item.title.clone(),
            explanation: "这是一次人工处理动作，代表审核员或运营人员正式介入案件流程。".into(),
            source_system: item.source_system.clone(),
            source_id: item.source_id.clone(),
        });
    }

    if is_outcome_changing(item) {
        return Some(TimelineKeyNode {
            item_id: item.item_id.clone(),
            kind: TimelineKeyNodeKind::OutcomeChangingNode,
            created_at: item.created_at.clone(),
            title: item.title.clone(),
            explanation: "这是一个直接改变案件结果或当前状态的重要节点。".into(),
            source_system: item.source_system.clone(),
            source_id: item.source_id.clone(),
        });
    }

    if is_turning_point(item) {
        return Some(TimelineKeyNode {
            item_id: item.item_id.clone(),
            kind: TimelineKeyNodeKind::TurningPoint,
            created_at: item.created_at.clone(),
            title: item.title.clone(),
            explanation: "这是案件时间线中的关键转折点，说明风险、治理或状态发生了明显变化。"
                .into(),
            source_system: item.source_system.clone(),
            source_id: item.source_id.clone(),
        });
    }

    None
}

pub fn extract_key_nodes(timeline: &CssCaseTimelineView) -> Vec<TimelineKeyNode> {
    timeline
        .items
        .iter()
        .filter_map(maybe_to_key_node)
        .collect()
}

pub fn build_summary(timeline: &CssCaseTimelineView, key_nodes: &[TimelineKeyNode]) -> String {
    let has_intervention = key_nodes
        .iter()
        .any(|node| matches!(node.kind, TimelineKeyNodeKind::HumanIntervention));
    let has_turning = key_nodes
        .iter()
        .any(|node| matches!(node.kind, TimelineKeyNodeKind::TurningPoint));
    let has_outcome = key_nodes
        .iter()
        .any(|node| matches!(node.kind, TimelineKeyNodeKind::OutcomeChangingNode));

    match (has_turning, has_intervention, has_outcome, timeline.items.len()) {
        (_, _, _, 0) => "当前案件时间线为空，暂无可解释节点。".into(),
        (true, true, true, _) => {
            "该案件时间线中同时存在关键转折、人工干预以及结果改变节点，说明案件经历了完整的风险演化与正式处理过程。".into()
        }
        (true, true, false, _) => {
            "该案件时间线已经出现关键转折并伴随人工介入，但尚未形成明显的结果改变节点。".into()
        }
        (true, false, false, _) => {
            "该案件主要表现为风险与治理状态的自然演化，目前尚未见明显人工干预。".into()
        }
        _ => "该案件时间线已形成基本事件流，但关键节点仍较少。".into(),
    }
}

pub fn build_view(
    timeline: &CssCaseTimelineView,
    subject_kind: crate::css_case_timeline_explain::types::CaseTimelineExplainSubjectKind,
) -> CssCaseTimelineExplainView {
    let key_nodes = extract_key_nodes(timeline);
    let summary = build_summary(timeline, &key_nodes);

    CssCaseTimelineExplainView {
        subject_kind,
        subject_id: timeline.subject_id.clone(),
        summary,
        key_nodes,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::css_case_timeline_explain::types::CaseTimelineExplainSubjectKind;
    use crate::css_case_timeline_merge::types::{CaseTimelineSubjectKind, CssCaseTimelineItem};

    #[test]
    fn v194_marks_case_actions_as_human_intervention() {
        let item = CssCaseTimelineItem {
            item_id: "ctm_action_1".into(),
            kind: CaseTimelineItemKind::CaseAction,
            tone: CaseTimelineTone::Danger,
            created_at: Some("2026-03-13T00:00:00Z".into()),
            title: "freeze".into(),
            subtitle: "actor: op_1".into(),
            body: "body".into(),
            tags: vec!["case_action".into()],
            source_system: Some("css_case_action_log".into()),
            source_id: Some("log_1".into()),
        };

        let node = maybe_to_key_node(&item).expect("key node");
        assert_eq!(node.kind, TimelineKeyNodeKind::HumanIntervention);
    }

    #[test]
    fn v194_summary_mentions_full_path_when_all_key_node_types_exist() {
        let timeline = CssCaseTimelineView {
            subject_kind: CaseTimelineSubjectKind::Deal,
            subject_id: "deal_1".into(),
            items: vec![
                CssCaseTimelineItem {
                    item_id: "1".into(),
                    kind: CaseTimelineItemKind::GovernanceEvent,
                    tone: CaseTimelineTone::Warning,
                    created_at: None,
                    title: "review_opened".into(),
                    subtitle: "".into(),
                    body: "".into(),
                    tags: vec![],
                    source_system: None,
                    source_id: None,
                },
                CssCaseTimelineItem {
                    item_id: "2".into(),
                    kind: CaseTimelineItemKind::CaseAction,
                    tone: CaseTimelineTone::Danger,
                    created_at: None,
                    title: "freeze".into(),
                    subtitle: "".into(),
                    body: "".into(),
                    tags: vec![],
                    source_system: None,
                    source_id: None,
                },
                CssCaseTimelineItem {
                    item_id: "3".into(),
                    kind: CaseTimelineItemKind::CurrentState,
                    tone: CaseTimelineTone::Recovery,
                    created_at: None,
                    title: "released".into(),
                    subtitle: "".into(),
                    body: "".into(),
                    tags: vec![],
                    source_system: None,
                    source_id: None,
                },
            ],
        };

        let view = build_view(&timeline, CaseTimelineExplainSubjectKind::Deal);
        assert!(view.summary.contains("关键转折"));
        assert_eq!(view.key_nodes.len(), 3);
    }
}
