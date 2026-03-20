use crate::css_case_action_log::types::{
    CaseActionLogKind, CaseActionLogSubjectKind, CssCaseActionLogRecord,
};
use crate::css_case_timeline_merge::types::{
    CaseTimelineItemKind, CaseTimelineTone, CssCaseTimelineItem,
};
use crate::css_timeline_ui_model::types::{TimelineUiItem, TimelineUiItemKind, TimelineUiTone};

fn action_kind_label(action: &CaseActionLogKind) -> &'static str {
    match action {
        CaseActionLogKind::Approve => "approve",
        CaseActionLogKind::Reject => "reject",
        CaseActionLogKind::Freeze => "freeze",
        CaseActionLogKind::Escalate => "escalate",
        CaseActionLogKind::Release => "release",
        CaseActionLogKind::RequireReview => "require_review",
    }
}

fn subject_kind_label(kind: &CaseActionLogSubjectKind) -> &'static str {
    match kind {
        CaseActionLogSubjectKind::User => "user",
        CaseActionLogSubjectKind::Catalog => "catalog",
        CaseActionLogSubjectKind::Deal => "deal",
        CaseActionLogSubjectKind::Ownership => "ownership",
    }
}

pub fn from_timeline_ui_item(item: &TimelineUiItem) -> CssCaseTimelineItem {
    let kind = match item.kind {
        TimelineUiItemKind::GovernanceEvent => CaseTimelineItemKind::GovernanceEvent,
        TimelineUiItemKind::SignalFrame => CaseTimelineItemKind::SignalFrame,
        TimelineUiItemKind::StoryCard => CaseTimelineItemKind::StoryCard,
        TimelineUiItemKind::CurrentState => CaseTimelineItemKind::CurrentState,
    };

    let tone = match item.tone {
        TimelineUiTone::Neutral => CaseTimelineTone::Neutral,
        TimelineUiTone::Info => CaseTimelineTone::Info,
        TimelineUiTone::Warning => CaseTimelineTone::Warning,
        TimelineUiTone::Danger => CaseTimelineTone::Danger,
        TimelineUiTone::Recovery => CaseTimelineTone::Recovery,
        TimelineUiTone::Positive => CaseTimelineTone::Positive,
    };

    CssCaseTimelineItem {
        item_id: format!("ctm_{}", item.item_id),
        kind,
        tone,
        created_at: item.created_at.clone(),
        title: item.title.clone(),
        subtitle: item.subtitle.clone(),
        body: item.body.clone(),
        tags: Vec::new(),
        source_system: item.source_system.clone(),
        source_id: item.source_id.clone(),
    }
}

pub fn from_case_action_log(log: &CssCaseActionLogRecord) -> CssCaseTimelineItem {
    let tone = match (&log.action, log.accepted) {
        (CaseActionLogKind::Approve, true) => CaseTimelineTone::Positive,
        (CaseActionLogKind::Release, true) => CaseTimelineTone::Recovery,
        (CaseActionLogKind::Freeze, true) | (CaseActionLogKind::Reject, true) => {
            CaseTimelineTone::Danger
        }
        (CaseActionLogKind::Escalate, true) | (CaseActionLogKind::RequireReview, true) => {
            CaseTimelineTone::Warning
        }
        _ => CaseTimelineTone::Info,
    };

    CssCaseTimelineItem {
        item_id: format!("ctm_action_{}", log.log_id),
        kind: CaseTimelineItemKind::CaseAction,
        tone,
        created_at: Some(log.created_at.clone()),
        title: action_kind_label(&log.action).into(),
        subtitle: format!("actor: {}", log.actor_user_id),
        body: format!("理由：{}；结果：{}", log.reason, log.result_message),
        tags: vec![
            "case_action".into(),
            subject_kind_label(&log.subject_kind).into(),
        ],
        source_system: Some("css_case_action_log".into()),
        source_id: Some(log.log_id.clone()),
    }
}

pub fn sort_items(mut items: Vec<CssCaseTimelineItem>) -> Vec<CssCaseTimelineItem> {
    items.sort_by(|a, b| {
        a.created_at
            .cmp(&b.created_at)
            .then_with(|| a.item_id.cmp(&b.item_id))
    });
    items
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v193_action_log_items_keep_case_action_identity() {
        let item = from_case_action_log(&CssCaseActionLogRecord {
            log_id: "log_1".into(),
            case_id: "case:deal:deal_1".into(),
            subject_kind: CaseActionLogSubjectKind::Deal,
            subject_id: "deal_1".into(),
            action: CaseActionLogKind::RequireReview,
            actor_user_id: "operator_1".into(),
            reason: "needs manual review".into(),
            accepted: true,
            result_message: "review created".into(),
            review_id: Some("rev_1".into()),
            created_at: "2026-03-13T00:00:00Z".into(),
        });

        assert_eq!(item.kind, CaseTimelineItemKind::CaseAction);
        assert_eq!(item.title, "require_review");
        assert!(item.tags.iter().any(|tag| tag == "case_action"));
        assert!(matches!(item.tone, CaseTimelineTone::Warning));
    }
}
