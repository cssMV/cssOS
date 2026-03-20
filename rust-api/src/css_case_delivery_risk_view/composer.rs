use crate::css_case_delivery_risk_view::types::{
    DeliveryRiskFactor, DeliveryRiskFactorKind, DeliveryRiskLevel,
};

fn factor(
    key: &str,
    label: &str,
    active: bool,
    detail: String,
    kind: DeliveryRiskFactorKind,
    level: DeliveryRiskLevel,
) -> DeliveryRiskFactor {
    DeliveryRiskFactor {
        key: key.to_string(),
        label: label.to_string(),
        active,
        detail: detail.clone(),
        title: label.to_string(),
        explanation: detail.clone(),
        kind,
        level,
        message: detail,
    }
}

pub fn consecutive_failures_factor(
    trace: &crate::css_case_delivery_decision_trace::types::CssCaseDeliveryDecisionTrace,
) -> DeliveryRiskFactor {
    let active = trace.input.consecutive_failures > 0;
    let level = if !active {
        DeliveryRiskLevel::Low
    } else if trace.input.consecutive_failures >= 3 {
        DeliveryRiskLevel::Critical
    } else if trace.input.consecutive_failures >= 2 {
        DeliveryRiskLevel::High
    } else {
        DeliveryRiskLevel::Medium
    };

    factor(
        "consecutive_failures_risk",
        "连续失败风险",
        active,
        format!("当前连续失败次数为 {}。", trace.input.consecutive_failures),
        DeliveryRiskFactorKind::ConsecutiveFailure,
        level,
    )
}

pub fn escalation_factor(
    trace: &crate::css_case_delivery_decision_trace::types::CssCaseDeliveryDecisionTrace,
) -> DeliveryRiskFactor {
    factor(
        "escalation_risk",
        "升级风险",
        trace.decision.escalate,
        format!("escalate={}", trace.decision.escalate),
        DeliveryRiskFactorKind::Escalation,
        if trace.decision.escalate {
            DeliveryRiskLevel::High
        } else {
            DeliveryRiskLevel::Low
        },
    )
}

pub fn manual_intervention_factor(
    trace: &crate::css_case_delivery_decision_trace::types::CssCaseDeliveryDecisionTrace,
) -> DeliveryRiskFactor {
    factor(
        "manual_intervention_risk",
        "人工介入风险",
        trace.decision.require_manual_intervention,
        format!(
            "require_manual_intervention={}",
            trace.decision.require_manual_intervention
        ),
        DeliveryRiskFactorKind::ManualInterventionRequired,
        if trace.decision.require_manual_intervention {
            DeliveryRiskLevel::Critical
        } else {
            DeliveryRiskLevel::Low
        },
    )
}

pub fn must_deliver_factor(
    trace: &crate::css_case_delivery_decision_trace::types::CssCaseDeliveryDecisionTrace,
) -> DeliveryRiskFactor {
    factor(
        "must_deliver_risk",
        "必须送达风险",
        trace.decision.must_deliver,
        format!("must_deliver={}", trace.decision.must_deliver),
        DeliveryRiskFactorKind::MustDeliverViolation,
        if trace.decision.must_deliver {
            DeliveryRiskLevel::Medium
        } else {
            DeliveryRiskLevel::Low
        },
    )
}

pub fn no_silent_failure_factor(
    trace: &crate::css_case_delivery_decision_trace::types::CssCaseDeliveryDecisionTrace,
) -> DeliveryRiskFactor {
    factor(
        "no_silent_failure_risk",
        "禁止静默失败风险",
        trace.decision.no_silent_failure,
        format!("no_silent_failure={}", trace.decision.no_silent_failure),
        DeliveryRiskFactorKind::SilentFailureNotAllowed,
        if trace.decision.no_silent_failure {
            DeliveryRiskLevel::Medium
        } else {
            DeliveryRiskLevel::Low
        },
    )
}

pub fn factors_from_trace(
    trace: &crate::css_case_delivery_decision_trace::types::CssCaseDeliveryDecisionTrace,
) -> Vec<DeliveryRiskFactor> {
    vec![
        consecutive_failures_factor(trace),
        escalation_factor(trace),
        manual_intervention_factor(trace),
        must_deliver_factor(trace),
        no_silent_failure_factor(trace),
    ]
}

pub fn risk_level(
    trust: &crate::css_case_delivery_trust_view::types::CssCaseDeliveryTrustView,
    trace: &crate::css_case_delivery_decision_trace::types::CssCaseDeliveryDecisionTrace,
) -> DeliveryRiskLevel {
    use crate::css_case_delivery_trust_view::types::DeliveryTrustLevel;

    if trace.decision.require_manual_intervention {
        return DeliveryRiskLevel::Critical;
    }

    if matches!(trust.trust_level, DeliveryTrustLevel::Untrusted) {
        return DeliveryRiskLevel::Critical;
    }

    if matches!(trust.trust_level, DeliveryTrustLevel::Risky) || trace.decision.escalate {
        return DeliveryRiskLevel::High;
    }

    if matches!(trust.trust_level, DeliveryTrustLevel::Guarded)
        || trace.decision.must_deliver
        || trace.decision.no_silent_failure
    {
        return DeliveryRiskLevel::Medium;
    }

    DeliveryRiskLevel::Low
}

pub fn is_high_risk(level: &DeliveryRiskLevel) -> bool {
    matches!(level, DeliveryRiskLevel::High | DeliveryRiskLevel::Critical)
}

fn level_weight(level: &DeliveryRiskLevel) -> usize {
    match level {
        DeliveryRiskLevel::Low => 1,
        DeliveryRiskLevel::Medium => 2,
        DeliveryRiskLevel::High => 3,
        DeliveryRiskLevel::Critical => 4,
    }
}

pub fn primary_factor(factors: &[DeliveryRiskFactor]) -> Option<DeliveryRiskFactorKind> {
    factors
        .iter()
        .filter(|factor| factor.active)
        .max_by_key(|factor| level_weight(&factor.level))
        .map(|factor| factor.kind.clone())
}

pub fn primary_factor_key(factors: &[DeliveryRiskFactor]) -> Option<String> {
    factors
        .iter()
        .filter(|factor| factor.active)
        .max_by_key(|factor| level_weight(&factor.level))
        .map(|factor| factor.key.clone())
}

pub fn active_factor_keys(factors: &[DeliveryRiskFactor]) -> Vec<String> {
    factors
        .iter()
        .filter(|factor| factor.active)
        .map(|factor| factor.key.clone())
        .collect()
}

pub fn risk_summary(level: &DeliveryRiskLevel) -> String {
    match level {
        DeliveryRiskLevel::Low => "当前对象风险较低。".into(),
        DeliveryRiskLevel::Medium => "当前对象存在中等风险，需要持续关注。".into(),
        DeliveryRiskLevel::High => "当前对象已进入高风险区，需要重点处理。".into(),
        DeliveryRiskLevel::Critical => "当前对象已进入关键风险区，应优先治理。".into(),
    }
}
