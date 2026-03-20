pub fn governance_grade_from_trace(
    trace: &crate::css_case_delivery_decision_trace::types::CssCaseDeliveryDecisionTrace,
) -> crate::css_case_delivery_trust_view::types::DeliveryGovernanceGrade {
    use crate::css_case_delivery_governance::types::DeliveryGovernanceSeverity;
    use crate::css_case_delivery_trust_view::types::DeliveryGovernanceGrade;

    match trace.decision.severity {
        DeliveryGovernanceSeverity::Normal => DeliveryGovernanceGrade::Normal,
        DeliveryGovernanceSeverity::Elevated => DeliveryGovernanceGrade::Elevated,
        DeliveryGovernanceSeverity::Critical => DeliveryGovernanceGrade::Critical,
    }
}

pub fn trust_level_from_trace(
    trace: &crate::css_case_delivery_decision_trace::types::CssCaseDeliveryDecisionTrace,
) -> crate::css_case_delivery_trust_view::types::DeliveryTrustLevel {
    use crate::css_case_delivery_governance::types::DeliveryGovernanceSeverity;
    use crate::css_case_delivery_trust_view::types::DeliveryTrustLevel;

    if trace.decision.require_manual_intervention {
        return DeliveryTrustLevel::Untrusted;
    }

    if matches!(
        trace.decision.severity,
        DeliveryGovernanceSeverity::Critical
    ) {
        return DeliveryTrustLevel::Untrusted;
    }

    if trace.decision.escalate
        || matches!(
            trace.decision.severity,
            DeliveryGovernanceSeverity::Elevated
        )
    {
        return DeliveryTrustLevel::Risky;
    }

    if trace.decision.must_deliver || trace.decision.no_silent_failure {
        return DeliveryTrustLevel::Guarded;
    }

    DeliveryTrustLevel::Healthy
}

pub fn is_trusted(level: &crate::css_case_delivery_trust_view::types::DeliveryTrustLevel) -> bool {
    matches!(
        level,
        crate::css_case_delivery_trust_view::types::DeliveryTrustLevel::Healthy
            | crate::css_case_delivery_trust_view::types::DeliveryTrustLevel::Guarded
    )
}

pub fn is_high_attention(
    level: &crate::css_case_delivery_trust_view::types::DeliveryTrustLevel,
) -> bool {
    matches!(
        level,
        crate::css_case_delivery_trust_view::types::DeliveryTrustLevel::Risky
            | crate::css_case_delivery_trust_view::types::DeliveryTrustLevel::Untrusted
    )
}

pub fn trust_highlights(
    trace: &crate::css_case_delivery_decision_trace::types::CssCaseDeliveryDecisionTrace,
) -> Vec<String> {
    let mut out = Vec::new();

    if trace.decision.escalate {
        out.push("当前已进入升级关注路径".into());
    }

    if trace.decision.require_manual_intervention {
        out.push("当前已进入人工介入路径".into());
    }

    if trace.decision.must_deliver {
        out.push("当前对象属于 must-deliver".into());
    }

    if trace.decision.no_silent_failure {
        out.push("当前对象不允许静默失败".into());
    }

    out.push(format!("当前策略版本为 {}", trace.policy_version_name));
    out
}

pub fn trust_signals(
    explain: &crate::css_case_delivery_explain_view::types::CssCaseDeliveryExplainView,
) -> Vec<String> {
    let mut out = Vec::new();

    if explain.fields.consecutive_failures >= 2 {
        out.push(format!(
            "连续失败次数为 {}，已进入连续失败观察范围。",
            explain.fields.consecutive_failures
        ));
    }

    if explain.api_fields.must_deliver {
        out.push("当前对象命中了 must-deliver 相关规则。".into());
    }

    if explain.api_fields.require_manual_intervention {
        out.push("当前对象命中了必须人工介入的治理规则。".into());
    }

    if explain.api_fields.escalate {
        out.push("当前对象已达到升级关注阈值。".into());
    }

    out.push(format!(
        "当前治理严重度 = {}。",
        explain.api_fields.severity
    ));

    out
}

pub fn trust_summary(
    level: &crate::css_case_delivery_trust_view::types::DeliveryTrustLevel,
) -> String {
    match level {
        crate::css_case_delivery_trust_view::types::DeliveryTrustLevel::Healthy => {
            "当前对象整体可信，未进入明显治理关注状态。".into()
        }
        crate::css_case_delivery_trust_view::types::DeliveryTrustLevel::Guarded => {
            "当前对象仍可信任，但已处于受关注状态。".into()
        }
        crate::css_case_delivery_trust_view::types::DeliveryTrustLevel::Risky => {
            "当前对象已进入风险区，需要重点关注。".into()
        }
        crate::css_case_delivery_trust_view::types::DeliveryTrustLevel::Untrusted => {
            "当前对象已不应视为正常可信状态。".into()
        }
    }
}
