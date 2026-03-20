pub fn ui_kind_from_storyboard_kind(
    kind: &crate::css_case_delivery_storyboard::types::DeliveryStoryboardCardKind,
) -> crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineUiNodeKind {
    use crate::css_case_delivery_storyboard::types::DeliveryStoryboardCardKind;
    use crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineUiNodeKind;

    match kind {
        DeliveryStoryboardCardKind::Start => DeliveryTimelineUiNodeKind::Start,
        DeliveryStoryboardCardKind::RiskEscalation => DeliveryTimelineUiNodeKind::Escalation,
        DeliveryStoryboardCardKind::Recovery => DeliveryTimelineUiNodeKind::Recovery,
        DeliveryStoryboardCardKind::CurrentState => DeliveryTimelineUiNodeKind::Current,
    }
}

pub fn is_pivot(
    kind: &crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineUiNodeKind,
) -> bool {
    matches!(
        kind,
        crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineUiNodeKind::Escalation
            | crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineUiNodeKind::Recovery
    )
}

fn tone_from_storyboard_kind(
    kind: &crate::css_case_delivery_storyboard::types::DeliveryStoryboardCardKind,
) -> crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineNodeTone {
    match kind {
        crate::css_case_delivery_storyboard::types::DeliveryStoryboardCardKind::Start => {
            crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineNodeTone::Neutral
        }
        crate::css_case_delivery_storyboard::types::DeliveryStoryboardCardKind::RiskEscalation => {
            crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineNodeTone::Warning
        }
        crate::css_case_delivery_storyboard::types::DeliveryStoryboardCardKind::Recovery => {
            crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineNodeTone::Positive
        }
        crate::css_case_delivery_storyboard::types::DeliveryStoryboardCardKind::CurrentState => {
            crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineNodeTone::Critical
        }
    }
}

pub fn node_from_card(
    idx: usize,
    _total: usize,
    card: &crate::css_case_delivery_storyboard::types::DeliveryStoryboardCard,
    status: String,
) -> crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineUiNode {
    let kind = ui_kind_from_storyboard_kind(&card.kind);
    let is_current = matches!(
        kind,
        crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineUiNodeKind::Current
    );

    crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineUiNode {
        kind: kind.clone(),
        title: card.title.clone(),
        body: card.body.clone(),
        status,
        is_pivot: is_pivot(&kind),
        is_current,
        created_at: card.created_at.clone().or_else(|| card.timestamp.clone()),
        node_id: format!("delivery_timeline_node_{}", idx),
        summary: card.summary.clone(),
        timestamp: card.timestamp.clone().or_else(|| card.created_at.clone()),
        badges: card.badges.clone(),
        tone: tone_from_storyboard_kind(&card.kind),
        is_turning_point: is_pivot(&kind),
    }
}

pub fn current_state(
    last: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayNode,
) -> crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineUiCurrentState {
    crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineUiCurrentState {
        trust_level: last.trust_level.clone(),
        risk_level: last.risk_level.clone(),
        assurance_level: last.assurance_level.clone(),
        summary: format!(
            "当前处于 {}，风险为 {}，保障级别为 {}。",
            last.trust_level, last.risk_level, last.assurance_level
        ),
    }
}

pub fn title() -> String {
    "交付时间线".into()
}

pub fn headline(
    narrative: &crate::css_case_delivery_signals_narrative::types::CssCaseDeliverySignalsNarrative,
) -> String {
    narrative.summary.clone()
}

pub fn summary(
    narrative: &crate::css_case_delivery_signals_narrative::types::CssCaseDeliverySignalsNarrative,
) -> String {
    narrative.summary.clone()
}

pub fn current_status_summary(
    storyboard: &crate::css_case_delivery_storyboard::types::CssCaseDeliveryStoryboard,
) -> Option<String> {
    storyboard.cards.last().map(|card| card.summary.clone())
}

pub fn build_nodes(
    storyboard: &crate::css_case_delivery_storyboard::types::CssCaseDeliveryStoryboard,
    fallback_status: String,
) -> Vec<crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineUiNode> {
    let total = storyboard.cards.len();
    storyboard
        .cards
        .iter()
        .enumerate()
        .map(|(idx, card)| node_from_card(idx, total, card, fallback_status.clone()))
        .collect()
}
