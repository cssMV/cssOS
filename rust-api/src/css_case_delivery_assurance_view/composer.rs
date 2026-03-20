pub fn monitoring_level(
    trust: &crate::css_case_delivery_trust_view::types::CssCaseDeliveryTrustView,
    risk: &crate::css_case_delivery_risk_view::types::CssCaseDeliveryRiskView,
) -> crate::css_case_delivery_assurance_view::types::DeliveryMonitoringLevel {
    use crate::css_case_delivery_assurance_view::types::DeliveryMonitoringLevel::{
        Critical, Heightened, None as NoMonitoring, Standard,
    };
    use crate::css_case_delivery_risk_view::types::DeliveryRiskLevel::{
        Critical as RiskCritical, High, Low, Medium,
    };
    use crate::css_case_delivery_trust_view::types::DeliveryTrustLevel::{
        Guarded, Healthy, Risky, Untrusted,
    };

    match (&trust.trust_level, &risk.risk_level) {
        (Healthy, Low) => NoMonitoring,
        (Guarded, Medium) => Standard,
        (Risky, High) => Heightened,
        (Untrusted, RiskCritical) => Critical,
        (_, RiskCritical) => Critical,
        (_, High) => Heightened,
        (_, Medium) => Standard,
        _ => Standard,
    }
}

pub fn assurance_level(
    trust: &crate::css_case_delivery_trust_view::types::CssCaseDeliveryTrustView,
    risk: &crate::css_case_delivery_risk_view::types::CssCaseDeliveryRiskView,
) -> crate::css_case_delivery_assurance_view::types::DeliveryAssuranceLevel {
    use crate::css_case_delivery_assurance_view::types::DeliveryAssuranceLevel;

    if trust.requires_manual_intervention {
        return DeliveryAssuranceLevel::Intervention;
    }

    if trust.is_high_attention || risk.is_high_risk {
        return DeliveryAssuranceLevel::Watched;
    }

    if trust.has_must_deliver_violation || has_governance_protection(trust) {
        return DeliveryAssuranceLevel::Protected;
    }

    DeliveryAssuranceLevel::Standard
}

pub fn is_in_mandatory_recovery_queue(
    trust: &crate::css_case_delivery_trust_view::types::CssCaseDeliveryTrustView,
    risk: &crate::css_case_delivery_risk_view::types::CssCaseDeliveryRiskView,
) -> bool {
    trust.requires_manual_intervention
        || trust.has_must_deliver_violation
        || matches!(
            risk.risk_level,
            crate::css_case_delivery_risk_view::types::DeliveryRiskLevel::Critical
        )
}

pub fn has_governance_protection(
    trust: &crate::css_case_delivery_trust_view::types::CssCaseDeliveryTrustView,
) -> bool {
    !matches!(
        trust.governance_grade,
        crate::css_case_delivery_trust_view::types::DeliveryGovernanceGrade::Normal
    )
}

pub fn assurance_measures(
    trust: &crate::css_case_delivery_trust_view::types::CssCaseDeliveryTrustView,
    risk: &crate::css_case_delivery_risk_view::types::CssCaseDeliveryRiskView,
    explain: &crate::css_case_delivery_explain_view::types::CssCaseDeliveryExplainView,
    is_in_mandatory_recovery_queue: bool,
) -> Vec<String> {
    let mut out = Vec::new();

    if !matches!(
        trust.trust_level,
        crate::css_case_delivery_trust_view::types::DeliveryTrustLevel::Healthy
    ) {
        out.push("已进入重点监控范围。".into());
    }

    if trust.requires_manual_intervention {
        out.push("已触发人工介入要求。".into());
    }

    if trust.has_must_deliver_violation || explain.api_fields.must_deliver {
        out.push("属于 must-deliver 保护对象。".into());
    }

    if risk.factors.iter().any(|factor| {
        matches!(
            factor.kind,
            crate::css_case_delivery_risk_view::types::DeliveryRiskFactorKind::ConsecutiveFailure
        ) && factor.active
    }) {
        out.push("已因连续失败信号进入恢复关注范围。".into());
    }

    if is_in_mandatory_recovery_queue {
        out.push("已进入必须恢复队列。".into());
    }

    out.push(format!(
        "当前治理严重度为 {}。",
        explain.api_fields.severity
    ));

    out
}

pub fn assurance_protections(
    trust: &crate::css_case_delivery_trust_view::types::CssCaseDeliveryTrustView,
    explain: &crate::css_case_delivery_explain_view::types::CssCaseDeliveryExplainView,
    is_in_mandatory_recovery_queue: bool,
) -> Vec<String> {
    let mut out = Vec::new();

    if explain.api_fields.must_deliver {
        out.push("当前对象处于 must-deliver 保护范围。".into());
    }

    if explain.api_fields.no_silent_failure {
        out.push("当前对象受禁止静默失败规则保护。".into());
    }

    if trust.is_high_attention {
        out.push("当前对象已进入高治理关注监控。".into());
    }

    if is_in_mandatory_recovery_queue {
        out.push("当前对象已进入必须恢复队列。".into());
    }

    if trust.requires_manual_intervention {
        out.push("当前对象已进入人工介入保护路径。".into());
    }

    out
}

pub fn assurance_limitations(
    trust: &crate::css_case_delivery_trust_view::types::CssCaseDeliveryTrustView,
    risk: &crate::css_case_delivery_risk_view::types::CssCaseDeliveryRiskView,
    explain: &crate::css_case_delivery_explain_view::types::CssCaseDeliveryExplainView,
) -> Vec<String> {
    let mut out = Vec::new();

    if risk
        .factors
        .iter()
        .any(|factor| factor.key == "consecutive_failures_risk" && factor.active)
    {
        out.push("当前对象存在连续失败限制。".into());
    }

    if explain.api_fields.escalate {
        out.push("当前对象已进入升级处理路径。".into());
    }

    if explain.api_fields.require_manual_intervention {
        out.push("当前对象不能继续按常规自动恢复处理。".into());
    }

    if risk.is_high_risk {
        out.push("当前对象处于高风险状态，需优先治理。".into());
    }

    if out.is_empty() && !trust.is_trusted {
        out.push("当前对象不宜视为常规稳定交付对象。".into());
    }

    out
}

pub fn assurance_summary(
    assurance_level: &crate::css_case_delivery_assurance_view::types::DeliveryAssuranceLevel,
    monitoring_level: &crate::css_case_delivery_assurance_view::types::DeliveryMonitoringLevel,
    requires_manual_intervention: bool,
    is_in_mandatory_recovery_queue: bool,
    is_must_deliver_protected: bool,
) -> String {
    if matches!(
        assurance_level,
        crate::css_case_delivery_assurance_view::types::DeliveryAssuranceLevel::Intervention
    ) {
        return "当前交付对象已进入人工介入保障状态。".into();
    }

    if requires_manual_intervention {
        return "当前交付对象已进入人工介入保障路径。".into();
    }

    if is_in_mandatory_recovery_queue {
        return "当前交付对象已进入必须恢复保障路径。".into();
    }

    if !matches!(
        monitoring_level,
        crate::css_case_delivery_assurance_view::types::DeliveryMonitoringLevel::None
    ) && is_must_deliver_protected
    {
        return "当前交付对象处于重点监控下的 must-deliver 保护状态。".into();
    }

    if !matches!(
        monitoring_level,
        crate::css_case_delivery_assurance_view::types::DeliveryMonitoringLevel::None
    ) {
        return "当前交付对象已进入重点监控状态。".into();
    }

    if is_must_deliver_protected {
        return "当前交付对象属于 must-deliver 保护对象。".into();
    }

    "当前交付对象处于常规保障状态。".into()
}
