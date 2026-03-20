pub fn trust_rank(level: &str) -> i32 {
    match level {
        "healthy" => 0,
        "guarded" => 1,
        "risky" => 2,
        "untrusted" => 3,
        _ => 0,
    }
}

pub fn is_escalation(
    prev: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayNode,
    curr: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayNode,
) -> bool {
    trust_rank(&curr.trust_level) > trust_rank(&prev.trust_level)
}

pub fn is_recovery(
    prev: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayNode,
    curr: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayNode,
) -> bool {
    trust_rank(&curr.trust_level) < trust_rank(&prev.trust_level)
}

pub fn start_card_from_node(
    first: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayNode,
) -> crate::css_case_delivery_storyboard::types::DeliveryStoryboardCard {
    crate::css_case_delivery_storyboard::types::DeliveryStoryboardCard {
        kind: crate::css_case_delivery_storyboard::types::DeliveryStoryboardCardKind::Start,
        title: "起点状态".into(),
        body: format!("该对象最初处于 {} 状态。", first.trust_level),
        created_at: Some(first.created_at.clone()),
        summary: format!(
            "对象最初处于 {}，风险等级为 {}，保障级别为 {}。",
            first.trust_level, first.risk_level, first.assurance_level
        ),
        timestamp: Some(first.created_at.clone()),
        badges: vec![
            format!("trust: {}", first.trust_level),
            format!("risk: {}", first.risk_level),
            format!("assurance: {}", first.assurance_level),
        ],
    }
}

pub fn escalation_card(
    prev: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayNode,
    curr: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayNode,
) -> crate::css_case_delivery_storyboard::types::DeliveryStoryboardCard {
    crate::css_case_delivery_storyboard::types::DeliveryStoryboardCard {
        kind:
            crate::css_case_delivery_storyboard::types::DeliveryStoryboardCardKind::RiskEscalation,
        title: "风险升级".into(),
        body: format!("对象从 {} 升级到 {}。", prev.trust_level, curr.trust_level),
        created_at: Some(curr.created_at.clone()),
        summary: format!("对象从 {} 升级到 {}。", prev.trust_level, curr.trust_level),
        timestamp: Some(curr.created_at.clone()),
        badges: vec![
            format!("trust: {}", curr.trust_level),
            format!("risk: {}", curr.risk_level),
        ],
    }
}

pub fn recovery_card_from_node(
    prev: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayNode,
    curr: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayNode,
) -> crate::css_case_delivery_storyboard::types::DeliveryStoryboardCard {
    crate::css_case_delivery_storyboard::types::DeliveryStoryboardCard {
        kind: crate::css_case_delivery_storyboard::types::DeliveryStoryboardCardKind::Recovery,
        title: "恢复节点".into(),
        body: format!("对象从 {} 恢复到 {}。", prev.trust_level, curr.trust_level),
        created_at: Some(curr.created_at.clone()),
        summary: format!("对象从 {} 恢复到 {}。", prev.trust_level, curr.trust_level),
        timestamp: Some(curr.created_at.clone()),
        badges: vec![
            format!("trust: {}", curr.trust_level),
            format!("risk: {}", curr.risk_level),
        ],
    }
}

pub fn current_state_card_from_node(
    last: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayNode,
) -> crate::css_case_delivery_storyboard::types::DeliveryStoryboardCard {
    crate::css_case_delivery_storyboard::types::DeliveryStoryboardCard {
        kind: crate::css_case_delivery_storyboard::types::DeliveryStoryboardCardKind::CurrentState,
        title: "当前状态".into(),
        body: format!(
            "当前处于 {}，风险为 {}，保障级别为 {}。",
            last.trust_level, last.risk_level, last.assurance_level
        ),
        created_at: Some(last.created_at.clone()),
        summary: format!(
            "对象当前处于 {}，风险等级为 {}，保障级别为 {}。",
            last.trust_level, last.risk_level, last.assurance_level
        ),
        timestamp: Some(last.created_at.clone()),
        badges: vec![
            format!("trust: {}", last.trust_level),
            format!("risk: {}", last.risk_level),
            format!("assurance: {}", last.assurance_level),
        ],
    }
}

pub fn storyboard_title() -> String {
    "交付故事板".into()
}

pub fn storyboard_summary(
    narrative: &crate::css_case_delivery_signals_narrative::types::CssCaseDeliverySignalsNarrative,
) -> String {
    narrative.summary.clone()
}

pub fn build_cards_from_nodes(
    replay: &crate::css_case_delivery_signals_replay::types::CssCaseDeliverySignalsReplay,
) -> Vec<crate::css_case_delivery_storyboard::types::DeliveryStoryboardCard> {
    if replay.nodes.is_empty() {
        return vec![];
    }

    let first = replay.nodes.first().expect("nodes checked non-empty");
    let last = replay.nodes.last().expect("nodes checked non-empty");
    let mut cards = vec![start_card_from_node(first)];

    for pair in replay.nodes.windows(2) {
        if let [prev, curr] = pair {
            if is_escalation(prev, curr) {
                cards.push(escalation_card(prev, curr));
            } else if is_recovery(prev, curr) {
                cards.push(recovery_card_from_node(prev, curr));
            }
        }
    }

    cards.push(current_state_card_from_node(last));
    cards
}

// Legacy-kept functions for older replay-step consumers.
pub fn start_card(
    step: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayStep,
) -> crate::css_case_delivery_storyboard::types::DeliveryStoryboardCard {
    crate::css_case_delivery_storyboard::types::DeliveryStoryboardCard {
        kind: crate::css_case_delivery_storyboard::types::DeliveryStoryboardCardKind::Start,
        title: "起点".into(),
        body: format!("该对象最初处于 {} 状态。", step.trust_level),
        created_at: Some(step.created_at.clone()),
        summary: format!(
            "对象最初处于 {}，风险等级为 {}，监控等级为 {}。",
            step.trust_level, step.risk_level, step.monitoring_level
        ),
        timestamp: Some(step.created_at.clone()),
        badges: vec![
            format!("trust: {}", step.trust_level),
            format!("risk: {}", step.risk_level),
            format!("monitoring: {}", step.monitoring_level),
        ],
    }
}

pub fn risk_escalation_card(
    step: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayStep,
) -> crate::css_case_delivery_storyboard::types::DeliveryStoryboardCard {
    crate::css_case_delivery_storyboard::types::DeliveryStoryboardCard {
        kind:
            crate::css_case_delivery_storyboard::types::DeliveryStoryboardCardKind::RiskEscalation,
        title: "风险升级".into(),
        body: format!("状态变化后当前为 {}。", step.trust_level),
        created_at: Some(step.created_at.clone()),
        summary: step.summary.clone(),
        timestamp: Some(step.created_at.clone()),
        badges: vec![
            format!("trust: {}", step.trust_level),
            format!("risk: {}", step.risk_level),
        ],
    }
}

pub fn recovery_card(
    step: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayStep,
) -> crate::css_case_delivery_storyboard::types::DeliveryStoryboardCard {
    crate::css_case_delivery_storyboard::types::DeliveryStoryboardCard {
        kind: crate::css_case_delivery_storyboard::types::DeliveryStoryboardCardKind::Recovery,
        title: "恢复".into(),
        body: format!("对象恢复后当前为 {}。", step.trust_level),
        created_at: Some(step.created_at.clone()),
        summary: step.summary.clone(),
        timestamp: Some(step.created_at.clone()),
        badges: vec![
            format!("trust: {}", step.trust_level),
            format!("risk: {}", step.risk_level),
        ],
    }
}

pub fn current_state_card(
    step: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayStep,
) -> crate::css_case_delivery_storyboard::types::DeliveryStoryboardCard {
    crate::css_case_delivery_storyboard::types::DeliveryStoryboardCard {
        kind: crate::css_case_delivery_storyboard::types::DeliveryStoryboardCardKind::CurrentState,
        title: "当前状态".into(),
        body: format!("当前该对象处于 {} 状态。", step.trust_level),
        created_at: Some(step.created_at.clone()),
        summary: format!(
            "对象当前处于 {}，风险等级为 {}，监控等级为 {}。",
            step.trust_level, step.risk_level, step.monitoring_level
        ),
        timestamp: Some(step.created_at.clone()),
        badges: vec![
            format!("trust: {}", step.trust_level),
            format!("risk: {}", step.risk_level),
            format!("monitoring: {}", step.monitoring_level),
        ],
    }
}

pub fn select_story_steps(
    replay: &crate::css_case_delivery_signals_replay::types::CssCaseDeliverySignalsReplayView,
    limit: Option<usize>,
) -> Vec<crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayStep> {
    if replay.steps.is_empty() {
        return vec![];
    }

    let mut selected = Vec::new();

    if let Some(first) = replay.steps.first() {
        selected.push(first.clone());
    }

    for step in replay.steps.iter().skip(1).take(limit.unwrap_or(20)) {
        use crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayTransitionKind::*;
        if matches!(
            step.transition,
            Degraded | TrustChanged | RiskChanged | Recovered
        ) {
            selected.push(step.clone());
        }
    }

    if let Some(last) = replay.steps.last() {
        if selected.last().map(|x| x.snapshot_id.clone()) != Some(last.snapshot_id.clone()) {
            selected.push(last.clone());
        }
    }

    selected
}

pub fn build_cards(
    replay: &crate::css_case_delivery_signals_replay::types::CssCaseDeliverySignalsReplayView,
    limit: Option<usize>,
) -> Vec<crate::css_case_delivery_storyboard::types::DeliveryStoryboardCard> {
    let steps = select_story_steps(replay, limit);
    if steps.is_empty() {
        return vec![];
    }

    let mut cards = Vec::new();

    if let Some(first) = steps.first() {
        cards.push(start_card(first));
    }

    let middle_count = steps.len().saturating_sub(2);
    for step in steps.iter().skip(1).take(middle_count) {
        use crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayTransitionKind::*;
        match step.transition {
            Recovered => cards.push(recovery_card(step)),
            Degraded | TrustChanged | RiskChanged => cards.push(risk_escalation_card(step)),
            _ => {}
        }
    }

    if let Some(last) = steps.last() {
        cards.push(current_state_card(last));
    }

    cards
}
