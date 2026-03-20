pub fn trust_changed(
    prev: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayNode,
    curr: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayNode,
) -> bool {
    prev.trust_level != curr.trust_level
}

pub fn opening_sentence(
    first: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayNode,
) -> String {
    format!("该对象最初处于 {} 状态。", first.trust_level)
}

pub fn transition_sentence_from_nodes(
    prev: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayNode,
    curr: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayNode,
) -> Option<String> {
    if !trust_changed(prev, curr) {
        return None;
    }

    let reason_hint = match curr.reason {
        crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotReason::RecoveryAfter => {
            "在恢复动作后"
        }
        crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotReason::RecoveryBefore
        | crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotReason::RecoveryReview => {
            "在恢复前后检查时"
        }
        crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotReason::DeliveryDecision => {
            "在一次交付判定后"
        }
        crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotReason::GovernanceAction => {
            "在一次治理动作后"
        }
        crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotReason::ManualCapture => {
            "在一次手动抓拍时"
        }
        crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotReason::RetryBefore => {
            "在一次重试前"
        }
        crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotReason::RetryAfter => {
            "在一次重试后"
        }
    };

    Some(format!(
        "{}，该对象从 {} 变化为 {}。",
        reason_hint, prev.trust_level, curr.trust_level
    ))
}

pub fn closing_sentence(
    last: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayNode,
) -> String {
    format!(
        "当前对象处于 {} 状态，风险级别为 {}，保障级别为 {}。",
        last.trust_level, last.risk_level, last.assurance_level
    )
}

pub fn narrative_title() -> String {
    "交付信号演化叙事".into()
}

pub fn narrative_summary_from_nodes(
    first: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayNode,
    last: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayNode,
) -> String {
    if first.trust_level == last.trust_level {
        format!("该对象整体维持在 {} 状态。", last.trust_level)
    } else {
        format!(
            "该对象从 {} 演化为 {}。",
            first.trust_level, last.trust_level
        )
    }
}

pub fn initial_sentence(
    first: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayStep,
) -> String {
    format!(
        "该交付对象最初处于 {} 状态，风险等级为 {}，监控等级为 {}。",
        first.trust_level, first.risk_level, first.monitoring_level
    )
}

pub fn transition_sentence(
    step: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayStep,
) -> String {
    use crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayTransitionKind::*;

    match step.transition {
        Initial => step.summary.clone(),
        TrustChanged => format!("随后 trust 状态发生变化：{}。", step.summary),
        RiskChanged => format!("随后 risk 等级发生变化：{}。", step.summary),
        AssuranceChanged => format!("随后 assurance/monitoring 发生变化：{}。", step.summary),
        ExplainChanged => format!("随后解释依据发生变化：{}。", step.summary),
        Recovered => format!("之后对象出现恢复：{}。", step.summary),
        Degraded => format!("之后对象进一步恶化：{}。", step.summary),
    }
}

pub fn trust_of(
    node: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayNode,
) -> String {
    node.trust_level.clone()
}

pub fn initial_narrative_step(
    first: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayNode,
) -> crate::css_case_delivery_signals_narrative::types::DeliverySignalsNarrativeStep {
    crate::css_case_delivery_signals_narrative::types::DeliverySignalsNarrativeStep {
        created_at: first.created_at.clone(),
        text: format!("该对象最初处于 {} 状态。", trust_of(first)),
    }
}

pub fn transition_narrative_step(
    prev: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayNode,
    curr: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayNode,
) -> Option<crate::css_case_delivery_signals_narrative::types::DeliverySignalsNarrativeStep> {
    let prev_trust = trust_of(prev);
    let curr_trust = trust_of(curr);

    if prev_trust == curr_trust {
        return None;
    }

    Some(
        crate::css_case_delivery_signals_narrative::types::DeliverySignalsNarrativeStep {
            created_at: curr.created_at.clone(),
            text: format!("随后状态从 {} 变化为 {}。", prev_trust, curr_trust),
        },
    )
}

pub fn current_narrative_step(
    last: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayNode,
) -> crate::css_case_delivery_signals_narrative::types::DeliverySignalsNarrativeStep {
    crate::css_case_delivery_signals_narrative::types::DeliverySignalsNarrativeStep {
        created_at: last.created_at.clone(),
        text: format!("当前该对象处于 {} 状态。", trust_of(last)),
    }
}

pub fn narrative_steps_summary(
    steps: &[crate::css_case_delivery_signals_narrative::types::DeliverySignalsNarrativeStep],
) -> String {
    if steps.is_empty() {
        return "当前暂无可用的交付信号叙事。".into();
    }

    if steps.len() == 1 {
        return steps[0].text.clone();
    }

    format!("{} {}", steps[0].text, steps[steps.len() - 1].text)
}

pub fn current_sentence(
    last: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayStep,
) -> String {
    format!(
        "当前对象处于 {} 状态，风险等级为 {}，监控等级为 {}。",
        last.trust_level, last.risk_level, last.monitoring_level
    )
}

pub fn narrative_summary(
    first: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayStep,
    last: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayStep,
) -> String {
    format!(
        "该交付对象从 {} 演化到 {}，风险从 {} 变化为 {}。",
        first.trust_level, last.trust_level, first.risk_level, last.risk_level
    )
}

pub fn key_steps(
    replay: &crate::css_case_delivery_signals_replay::types::CssCaseDeliverySignalsReplayView,
) -> Vec<crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayStep> {
    if replay.steps.is_empty() {
        return vec![];
    }

    let mut out = Vec::new();

    if let Some(first) = replay.steps.first() {
        out.push(first.clone());
    }

    for step in replay.steps.iter().skip(1).take(10) {
        use crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayTransitionKind::*;
        if !matches!(step.transition, ExplainChanged) {
            out.push(step.clone());
        }
    }

    if let Some(last) = replay.steps.last() {
        if out.last().map(|x| x.snapshot_id.clone()) != Some(last.snapshot_id.clone()) {
            out.push(last.clone());
        }
    }

    out
}

pub fn build_paragraphs(
    replay: &crate::css_case_delivery_signals_replay::types::CssCaseDeliverySignalsReplayView,
) -> Vec<String> {
    if replay.steps.is_empty() {
        return vec!["该交付对象当前没有可用于叙事的信号回放记录。".into()];
    }

    let key_steps = key_steps(replay);
    let mut paragraphs = Vec::new();

    if let Some(first) = key_steps.first() {
        paragraphs.push(initial_sentence(first));
    }

    let middle_count = key_steps.len().saturating_sub(2);
    for step in key_steps.iter().skip(1).take(middle_count) {
        paragraphs.push(transition_sentence(step));
    }

    if let Some(last) = key_steps.last() {
        paragraphs.push(current_sentence(last));
    }

    paragraphs
}
