pub fn governance_entry_to_item(
    entry: &crate::css_governance_timeline::types::GovernanceTimelineEntry,
) -> crate::css_timeline_ui_model::types::TimelineUiItem {
    use crate::css_governance_timeline::types::TimelineEventKind;
    use crate::css_timeline_ui_model::types::{TimelineUiItem, TimelineUiItemKind, TimelineUiTone};

    let tone = match entry.event_kind {
        TimelineEventKind::CreditScoreDecreased
        | TimelineEventKind::ModerationRestrictionApplied
        | TimelineEventKind::ReviewRejected
        | TimelineEventKind::AuctionFrozen
        | TimelineEventKind::DealFrozen => TimelineUiTone::Danger,
        TimelineEventKind::ReviewOpened | TimelineEventKind::CreditWarningTriggered => {
            TimelineUiTone::Warning
        }
        TimelineEventKind::CreditScoreIncreased
        | TimelineEventKind::DealReleased
        | TimelineEventKind::AuctionUnfrozen => TimelineUiTone::Recovery,
        _ => TimelineUiTone::Info,
    };

    TimelineUiItem {
        item_id: format!("ui_gtl_{}", entry.timeline_id),
        kind: TimelineUiItemKind::GovernanceEvent,
        tone,
        title: format!("{:?}", entry.event_kind).to_lowercase(),
        subtitle: entry.source_system.clone(),
        body: entry.message.clone(),
        created_at: Some(entry.created_at.clone()),
        source_system: Some(entry.source_system.clone()),
        source_id: Some(entry.source_id.clone()),
    }
}

pub fn replay_frame_to_item(
    frame: &crate::css_signals_replay::types::SignalsReplayFrame,
) -> crate::css_timeline_ui_model::types::TimelineUiItem {
    use crate::css_signals_replay::types::ReplayChangeKind;
    use crate::css_timeline_ui_model::types::{TimelineUiItem, TimelineUiItemKind, TimelineUiTone};

    let tone = if frame
        .deltas_from_previous
        .iter()
        .any(|delta| matches!(delta.change_kind, ReplayChangeKind::SeverityIncreased))
    {
        TimelineUiTone::Warning
    } else if frame
        .deltas_from_previous
        .iter()
        .any(|delta| matches!(delta.change_kind, ReplayChangeKind::SeverityDecreased))
    {
        TimelineUiTone::Recovery
    } else {
        TimelineUiTone::Neutral
    };

    let body = if frame.deltas_from_previous.is_empty() {
        "该帧没有可见信号变化。".into()
    } else {
        frame
            .deltas_from_previous
            .iter()
            .map(|delta| delta.description.clone())
            .collect::<Vec<_>>()
            .join("；")
    };

    TimelineUiItem {
        item_id: format!("ui_replay_{}", frame.snapshot_id),
        kind: TimelineUiItemKind::SignalFrame,
        tone,
        title: "signals frame".into(),
        subtitle: format!("{:?}", frame.purpose).to_lowercase(),
        body,
        created_at: Some(frame.created_at.clone()),
        source_system: Some("css_signals_snapshot".into()),
        source_id: Some(frame.snapshot_id.clone()),
    }
}

pub fn storyboard_card_to_item(
    card: &crate::css_signals_storyboard::types::StoryboardCard,
) -> crate::css_timeline_ui_model::types::TimelineUiItem {
    use crate::css_signals_storyboard::types::StoryboardTone;
    use crate::css_timeline_ui_model::types::{TimelineUiItem, TimelineUiItemKind, TimelineUiTone};

    let tone = match card.tone {
        StoryboardTone::Neutral => TimelineUiTone::Neutral,
        StoryboardTone::Warning => TimelineUiTone::Warning,
        StoryboardTone::Danger => TimelineUiTone::Danger,
        StoryboardTone::Recovery => TimelineUiTone::Recovery,
        StoryboardTone::Positive => TimelineUiTone::Positive,
    };

    let kind = match card.kind {
        crate::css_signals_storyboard::types::StoryboardCardKind::CurrentState => {
            TimelineUiItemKind::CurrentState
        }
        _ => TimelineUiItemKind::StoryCard,
    };

    TimelineUiItem {
        item_id: format!("ui_story_{}", card.card_id),
        kind,
        tone,
        title: card.title.clone(),
        subtitle: card.subtitle.clone(),
        body: card.body.clone(),
        created_at: card.created_at.clone(),
        source_system: Some("css_signals_storyboard".into()),
        source_id: card.snapshot_id.clone(),
    }
}

pub fn sort_items(
    mut items: Vec<crate::css_timeline_ui_model::types::TimelineUiItem>,
) -> Vec<crate::css_timeline_ui_model::types::TimelineUiItem> {
    items.sort_by(|a, b| a.created_at.cmp(&b.created_at));
    items
}

#[cfg(test)]
mod tests {
    #[test]
    fn v188_storyboard_current_state_becomes_current_ui_item() {
        let item =
            super::storyboard_card_to_item(&crate::css_signals_storyboard::types::StoryboardCard {
                card_id: "sb_1".into(),
                kind: crate::css_signals_storyboard::types::StoryboardCardKind::CurrentState,
                tone: crate::css_signals_storyboard::types::StoryboardTone::Neutral,
                title: "当前状态".into(),
                subtitle: "最新评估".into(),
                body: "当前稳定。".into(),
                created_at: None,
                snapshot_id: None,
            });
        assert_eq!(
            item.kind,
            crate::css_timeline_ui_model::types::TimelineUiItemKind::CurrentState
        );
    }
}
