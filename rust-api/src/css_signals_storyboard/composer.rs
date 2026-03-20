pub fn initial_card(
    first_frame: &crate::css_signals_replay::types::SignalsReplayFrame,
) -> crate::css_signals_storyboard::types::StoryboardCard {
    crate::css_signals_storyboard::types::StoryboardCard {
        card_id: format!("sb_{}", uuid::Uuid::new_v4()),
        kind: crate::css_signals_storyboard::types::StoryboardCardKind::InitialState,
        tone: crate::css_signals_storyboard::types::StoryboardTone::Neutral,
        title: "初始状态".into(),
        subtitle: "最早可回放信号帧".into(),
        body: "这是当前故事板中的起点状态。".into(),
        created_at: Some(first_frame.created_at.clone()),
        snapshot_id: Some(first_frame.snapshot_id.clone()),
    }
}

pub fn card_from_milestone(
    milestone: &crate::css_signals_narrative::types::NarrativeMilestone,
) -> crate::css_signals_storyboard::types::StoryboardCard {
    use crate::css_signals_narrative::types::NarrativePhase;
    use crate::css_signals_storyboard::types::{
        StoryboardCard, StoryboardCardKind, StoryboardTone,
    };

    let (kind, tone) = match milestone.phase {
        NarrativePhase::Initial => (StoryboardCardKind::InitialState, StoryboardTone::Neutral),
        NarrativePhase::Escalating => {
            if milestone.title.contains("人工复核") || milestone.description.contains("review")
            {
                (StoryboardCardKind::ReviewStarted, StoryboardTone::Warning)
            } else {
                (StoryboardCardKind::RiskEscalation, StoryboardTone::Warning)
            }
        }
        NarrativePhase::Restricted => (StoryboardCardKind::Restricted, StoryboardTone::Danger),
        NarrativePhase::Frozen => (StoryboardCardKind::Frozen, StoryboardTone::Danger),
        NarrativePhase::Recovering => (
            StoryboardCardKind::RecoveryStarted,
            StoryboardTone::Recovery,
        ),
        NarrativePhase::Stable => (StoryboardCardKind::StableState, StoryboardTone::Positive),
    };

    StoryboardCard {
        card_id: format!("sb_{}", uuid::Uuid::new_v4()),
        kind,
        tone,
        title: milestone.title.clone(),
        subtitle: format!("{:?}", milestone.phase).to_lowercase(),
        body: milestone.description.clone(),
        created_at: Some(milestone.created_at.clone()),
        snapshot_id: None,
    }
}

pub fn current_state_card(
    assessment: &str,
) -> crate::css_signals_storyboard::types::StoryboardCard {
    use crate::css_signals_storyboard::types::{
        StoryboardCard, StoryboardCardKind, StoryboardTone,
    };

    let lower = assessment.to_lowercase();
    let tone = if lower.contains("冻结") {
        StoryboardTone::Danger
    } else if lower.contains("限制") || lower.contains("复核") || lower.contains("高风险") {
        StoryboardTone::Warning
    } else if lower.contains("恢复") || lower.contains("稳定") {
        StoryboardTone::Positive
    } else {
        StoryboardTone::Neutral
    };

    StoryboardCard {
        card_id: format!("sb_{}", uuid::Uuid::new_v4()),
        kind: StoryboardCardKind::CurrentState,
        tone,
        title: "当前状态".into(),
        subtitle: "最新评估".into(),
        body: assessment.to_string(),
        created_at: None,
        snapshot_id: None,
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn v187_maps_recovering_milestone_to_recovery_card() {
        let card =
            super::card_from_milestone(&crate::css_signals_narrative::types::NarrativeMilestone {
                created_at: "2026-03-13T00:00:00Z".into(),
                title: "出现恢复迹象".into(),
                description: "高风险信号已明显下降。".into(),
                phase: crate::css_signals_narrative::types::NarrativePhase::Recovering,
            });

        assert_eq!(
            card.kind,
            crate::css_signals_storyboard::types::StoryboardCardKind::RecoveryStarted
        );
        assert_eq!(
            card.tone,
            crate::css_signals_storyboard::types::StoryboardTone::Recovery
        );
    }

    #[test]
    fn v187_current_state_card_marks_frozen_as_danger() {
        let card = super::current_state_card("当前处于冻结风险阶段，应以阻断和人工处理为主。");
        assert_eq!(
            card.tone,
            crate::css_signals_storyboard::types::StoryboardTone::Danger
        );
    }
}
