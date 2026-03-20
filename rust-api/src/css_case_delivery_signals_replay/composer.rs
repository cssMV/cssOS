pub fn parse_envelope(
    record: &crate::css_case_delivery_signals_snapshot::types::CssCaseDeliverySignalsSnapshotRecord,
) -> anyhow::Result<crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotEnvelope>
{
    if let Ok(env) = serde_json::from_value::<
        crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotEnvelope,
    >(record.payload_json.clone())
    {
        return Ok(env);
    }

    let payload = serde_json::from_value::<
        crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotPayload,
    >(record.payload_json.clone())?;

    Ok(
        crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotEnvelope {
            trust: payload.trust,
            risk: payload.risk,
            explain: payload.explain,
            assurance: payload.assurance,
            signals: payload.hub,
        },
    )
}

pub fn trust_level(
    env: &crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotEnvelope,
) -> String {
    format!("{:?}", env.trust.trust_level).to_lowercase()
}

pub fn risk_level(
    env: &crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotEnvelope,
) -> String {
    format!("{:?}", env.risk.risk_level).to_lowercase()
}

pub fn monitoring_level(
    env: &crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotEnvelope,
) -> String {
    format!("{:?}", env.assurance.monitoring_level).to_lowercase()
}

pub fn assurance_level(
    env: &crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotEnvelope,
) -> String {
    format!("{:?}", env.assurance.assurance_level).to_lowercase()
}

pub fn transition_kind(
    prev: Option<
        &crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotEnvelope,
    >,
    curr: &crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotEnvelope,
) -> crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayTransitionKind {
    use crate::css_case_delivery_risk_view::types::DeliveryRiskLevel;
    use crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayTransitionKind;
    use crate::css_case_delivery_trust_view::types::DeliveryTrustLevel;

    let Some(prev) = prev else {
        return DeliverySignalsReplayTransitionKind::Initial;
    };

    if prev.trust.trust_level != curr.trust.trust_level {
        let recovered = matches!(
            (&prev.trust.trust_level, &curr.trust.trust_level),
            (
                DeliveryTrustLevel::Untrusted,
                DeliveryTrustLevel::Risky
                    | DeliveryTrustLevel::Guarded
                    | DeliveryTrustLevel::Healthy
            ) | (
                DeliveryTrustLevel::Risky,
                DeliveryTrustLevel::Guarded | DeliveryTrustLevel::Healthy
            )
        );

        return if recovered {
            DeliverySignalsReplayTransitionKind::Recovered
        } else {
            DeliverySignalsReplayTransitionKind::TrustChanged
        };
    }

    if prev.risk.risk_level != curr.risk.risk_level {
        let degraded = matches!(
            (&prev.risk.risk_level, &curr.risk.risk_level),
            (
                DeliveryRiskLevel::Low,
                DeliveryRiskLevel::Medium | DeliveryRiskLevel::High | DeliveryRiskLevel::Critical
            ) | (
                DeliveryRiskLevel::Medium,
                DeliveryRiskLevel::High | DeliveryRiskLevel::Critical
            ) | (DeliveryRiskLevel::High, DeliveryRiskLevel::Critical)
        );

        return if degraded {
            DeliverySignalsReplayTransitionKind::Degraded
        } else {
            DeliverySignalsReplayTransitionKind::RiskChanged
        };
    }

    if prev.assurance.monitoring_level != curr.assurance.monitoring_level {
        return DeliverySignalsReplayTransitionKind::AssuranceChanged;
    }

    if prev.explain.fields.decisive_rule != curr.explain.fields.decisive_rule {
        return DeliverySignalsReplayTransitionKind::ExplainChanged;
    }

    DeliverySignalsReplayTransitionKind::ExplainChanged
}

pub fn step_summary(
    kind: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayTransitionKind,
    env: &crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotEnvelope,
) -> String {
    match kind {
        crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayTransitionKind::Initial => {
            format!(
                "初始状态：trust = {:?}，risk = {:?}，monitoring = {:?}。",
                env.trust.trust_level, env.risk.risk_level, env.assurance.monitoring_level
            )
        }
        crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayTransitionKind::TrustChanged => {
            format!("trust 状态发生变化，当前为 {:?}。", env.trust.trust_level)
        }
        crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayTransitionKind::RiskChanged => {
            format!("risk 等级发生变化，当前为 {:?}。", env.risk.risk_level)
        }
        crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayTransitionKind::AssuranceChanged => {
            format!(
                "assurance monitoring 发生变化，当前为 {:?}。",
                env.assurance.monitoring_level
            )
        }
        crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayTransitionKind::ExplainChanged => {
            format!(
                "解释规则发生变化，当前 decisive_rule = {:?}。",
                env.explain.fields.decisive_rule
            )
        }
        crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayTransitionKind::Recovered => {
            format!("对象出现恢复，当前 trust = {:?}。", env.trust.trust_level)
        }
        crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayTransitionKind::Degraded => {
            format!("对象风险恶化，当前 risk = {:?}。", env.risk.risk_level)
        }
    }
}

pub fn governance_severity(
    env: &crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotEnvelope,
) -> Option<String> {
    Some(env.signals.derived.governance_severity.clone())
}

pub fn node_summary(
    env: &crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotEnvelope,
) -> String {
    format!(
        "trust={}, risk={}, governance={}",
        trust_level(env),
        risk_level(env),
        governance_severity(env).unwrap_or_else(|| "unknown".into())
    )
}
