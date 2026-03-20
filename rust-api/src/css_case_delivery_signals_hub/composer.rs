pub fn consecutive_failure_signal(
    failure_streak: usize,
) -> Option<crate::css_case_delivery_signals_hub::types::DeliverySignal> {
    if failure_streak == 0 {
        return None;
    }

    let level = if failure_streak >= 3 {
        crate::css_case_delivery_signals_hub::types::DeliverySignalLevel::Critical
    } else if failure_streak >= 2 {
        crate::css_case_delivery_signals_hub::types::DeliverySignalLevel::Warning
    } else {
        crate::css_case_delivery_signals_hub::types::DeliverySignalLevel::Info
    };

    Some(
        crate::css_case_delivery_signals_hub::types::DeliverySignal {
            kind:
                crate::css_case_delivery_signals_hub::types::DeliverySignalKind::ConsecutiveFailure,
            key: "failure_streak".into(),
            value: failure_streak.to_string(),
            level,
            source: "delivery_input".into(),
        },
    )
}

pub fn must_deliver_violation_signal(
    trust: &crate::css_case_delivery_trust_view::types::CssCaseDeliveryTrustView,
) -> Option<crate::css_case_delivery_signals_hub::types::DeliverySignal> {
    if !trust.has_must_deliver_violation {
        return None;
    }

    Some(crate::css_case_delivery_signals_hub::types::DeliverySignal {
        kind:
            crate::css_case_delivery_signals_hub::types::DeliverySignalKind::MustDeliverViolation,
        key: "must_deliver_violation".into(),
        value: "true".into(),
        level: crate::css_case_delivery_signals_hub::types::DeliverySignalLevel::Critical,
        source: "trust_view".into(),
    })
}

pub fn manual_intervention_signal(
    trust: &crate::css_case_delivery_trust_view::types::CssCaseDeliveryTrustView,
) -> Option<crate::css_case_delivery_signals_hub::types::DeliverySignal> {
    if !trust.requires_manual_intervention {
        return None;
    }

    Some(crate::css_case_delivery_signals_hub::types::DeliverySignal {
        kind: crate::css_case_delivery_signals_hub::types::DeliverySignalKind::ManualInterventionRequired,
        key: "requires_manual_intervention".into(),
        value: "true".into(),
        level: crate::css_case_delivery_signals_hub::types::DeliverySignalLevel::Critical,
        source: "trust_view".into(),
    })
}

pub fn silent_failure_signal(
    explain: &crate::css_case_delivery_explain_view::types::CssCaseDeliveryExplainView,
) -> Option<crate::css_case_delivery_signals_hub::types::DeliverySignal> {
    if explain.fields.decisive_rule.as_deref() != Some("silent_failure_not_allowed") {
        return None;
    }

    Some(crate::css_case_delivery_signals_hub::types::DeliverySignal {
        kind:
            crate::css_case_delivery_signals_hub::types::DeliverySignalKind::SilentFailureNotAllowed,
        key: "silent_failure_not_allowed".into(),
        value: "true".into(),
        level: crate::css_case_delivery_signals_hub::types::DeliverySignalLevel::Warning,
        source: "explain_view".into(),
    })
}

pub fn governance_severity_signal(
    trust: &crate::css_case_delivery_trust_view::types::CssCaseDeliveryTrustView,
) -> crate::css_case_delivery_signals_hub::types::DeliverySignal {
    let (value, level) = match trust.governance_grade {
        crate::css_case_delivery_trust_view::types::DeliveryGovernanceGrade::Normal => (
            "normal".into(),
            crate::css_case_delivery_signals_hub::types::DeliverySignalLevel::Info,
        ),
        crate::css_case_delivery_trust_view::types::DeliveryGovernanceGrade::Elevated => (
            "elevated".into(),
            crate::css_case_delivery_signals_hub::types::DeliverySignalLevel::Warning,
        ),
        crate::css_case_delivery_trust_view::types::DeliveryGovernanceGrade::Warning => (
            "warning".into(),
            crate::css_case_delivery_signals_hub::types::DeliverySignalLevel::Warning,
        ),
        crate::css_case_delivery_trust_view::types::DeliveryGovernanceGrade::Critical => (
            "critical".into(),
            crate::css_case_delivery_signals_hub::types::DeliverySignalLevel::Critical,
        ),
    };

    crate::css_case_delivery_signals_hub::types::DeliverySignal {
        kind: crate::css_case_delivery_signals_hub::types::DeliverySignalKind::GovernanceSeverity,
        key: "governance_severity".into(),
        value,
        level,
        source: "trust_view".into(),
    }
}

pub fn trust_level_signal(
    trust: &crate::css_case_delivery_trust_view::types::CssCaseDeliveryTrustView,
) -> crate::css_case_delivery_signals_hub::types::DeliverySignal {
    let (value, level) = match trust.trust_level {
        crate::css_case_delivery_trust_view::types::DeliveryTrustLevel::Healthy => (
            "healthy".into(),
            crate::css_case_delivery_signals_hub::types::DeliverySignalLevel::Info,
        ),
        crate::css_case_delivery_trust_view::types::DeliveryTrustLevel::Guarded => (
            "guarded".into(),
            crate::css_case_delivery_signals_hub::types::DeliverySignalLevel::Warning,
        ),
        crate::css_case_delivery_trust_view::types::DeliveryTrustLevel::Risky => (
            "risky".into(),
            crate::css_case_delivery_signals_hub::types::DeliverySignalLevel::Warning,
        ),
        crate::css_case_delivery_trust_view::types::DeliveryTrustLevel::Untrusted => (
            "untrusted".into(),
            crate::css_case_delivery_signals_hub::types::DeliverySignalLevel::Critical,
        ),
    };

    crate::css_case_delivery_signals_hub::types::DeliverySignal {
        kind: crate::css_case_delivery_signals_hub::types::DeliverySignalKind::TrustLevel,
        key: "trust_level".into(),
        value,
        level,
        source: "trust_view".into(),
    }
}

pub fn risk_level_signal(
    risk: &crate::css_case_delivery_risk_view::types::CssCaseDeliveryRiskView,
) -> crate::css_case_delivery_signals_hub::types::DeliverySignal {
    let (value, level) = match risk.risk_level {
        crate::css_case_delivery_risk_view::types::DeliveryRiskLevel::Low => (
            "low".into(),
            crate::css_case_delivery_signals_hub::types::DeliverySignalLevel::Info,
        ),
        crate::css_case_delivery_risk_view::types::DeliveryRiskLevel::Medium => (
            "medium".into(),
            crate::css_case_delivery_signals_hub::types::DeliverySignalLevel::Warning,
        ),
        crate::css_case_delivery_risk_view::types::DeliveryRiskLevel::High => (
            "high".into(),
            crate::css_case_delivery_signals_hub::types::DeliverySignalLevel::Warning,
        ),
        crate::css_case_delivery_risk_view::types::DeliveryRiskLevel::Critical => (
            "critical".into(),
            crate::css_case_delivery_signals_hub::types::DeliverySignalLevel::Critical,
        ),
    };

    crate::css_case_delivery_signals_hub::types::DeliverySignal {
        kind: crate::css_case_delivery_signals_hub::types::DeliverySignalKind::RiskLevel,
        key: "risk_level".into(),
        value,
        level,
        source: "risk_view".into(),
    }
}

pub fn assurance_monitoring_signal(
    assurance: &crate::css_case_delivery_assurance_view::types::CssCaseDeliveryAssuranceView,
) -> crate::css_case_delivery_signals_hub::types::DeliverySignal {
    let (value, level) = match assurance.monitoring_level {
        crate::css_case_delivery_assurance_view::types::DeliveryMonitoringLevel::None => (
            "none".into(),
            crate::css_case_delivery_signals_hub::types::DeliverySignalLevel::Info,
        ),
        crate::css_case_delivery_assurance_view::types::DeliveryMonitoringLevel::Standard => (
            "standard".into(),
            crate::css_case_delivery_signals_hub::types::DeliverySignalLevel::Info,
        ),
        crate::css_case_delivery_assurance_view::types::DeliveryMonitoringLevel::Heightened => (
            "heightened".into(),
            crate::css_case_delivery_signals_hub::types::DeliverySignalLevel::Warning,
        ),
        crate::css_case_delivery_assurance_view::types::DeliveryMonitoringLevel::Critical => (
            "critical".into(),
            crate::css_case_delivery_signals_hub::types::DeliverySignalLevel::Critical,
        ),
    };

    crate::css_case_delivery_signals_hub::types::DeliverySignal {
        kind: crate::css_case_delivery_signals_hub::types::DeliverySignalKind::AssuranceMonitoring,
        key: "monitoring_level".into(),
        value,
        level,
        source: "assurance_view".into(),
    }
}
