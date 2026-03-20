fn governance_severity_string(
    grade: &crate::css_case_delivery_trust_view::types::DeliveryGovernanceGrade,
) -> String {
    match grade {
        crate::css_case_delivery_trust_view::types::DeliveryGovernanceGrade::Normal => {
            "normal".into()
        }
        crate::css_case_delivery_trust_view::types::DeliveryGovernanceGrade::Elevated
        | crate::css_case_delivery_trust_view::types::DeliveryGovernanceGrade::Warning => {
            "elevated".into()
        }
        crate::css_case_delivery_trust_view::types::DeliveryGovernanceGrade::Critical => {
            "critical".into()
        }
    }
}

fn trust_level_string(
    level: &crate::css_case_delivery_trust_view::types::DeliveryTrustLevel,
) -> String {
    format!("{level:?}").to_lowercase()
}

fn risk_level_string(
    level: &crate::css_case_delivery_risk_view::types::DeliveryRiskLevel,
) -> String {
    format!("{level:?}").to_lowercase()
}

fn assurance_level_string(
    level: &crate::css_case_delivery_assurance_view::types::DeliveryAssuranceLevel,
) -> String {
    format!("{level:?}").to_lowercase()
}

fn view_request_from_legacy(
    req: &crate::css_case_delivery_signals_hub::types::DeliverySignalsHubRequest,
) -> crate::css_case_delivery_signals_hub::types::DeliverySignalsHubViewRequest {
    let consecutive_failures =
        req.consecutive_failures
            .unwrap_or(if req.delivered { 0 } else { req.failure_streak });

    crate::css_case_delivery_signals_hub::types::DeliverySignalsHubViewRequest {
        target: crate::css_case_delivery_decision_trace::runtime::api_target_from_log_target(
            &req.target,
        ),
        consecutive_failures,
        latest_failed: !req.delivered,
    }
}

fn input_signals(
    req: &crate::css_case_delivery_signals_hub::types::DeliverySignalsHubViewRequest,
) -> crate::css_case_delivery_signals_hub::types::DeliveryInputSignals {
    crate::css_case_delivery_signals_hub::types::DeliveryInputSignals {
        target: req.target.clone(),
        consecutive_failures: req.consecutive_failures,
        latest_failed: req.latest_failed,
    }
}

fn governance_signals(
    trace: &crate::css_case_delivery_decision_trace::types::CssCaseDeliveryDecisionTrace,
) -> crate::css_case_delivery_signals_hub::types::DeliveryGovernanceSignals {
    crate::css_case_delivery_signals_hub::types::DeliveryGovernanceSignals {
        policy_version_id: trace.policy_version_id.clone(),
        policy_version_label: trace.policy_version_name.clone(),
        severity: format!("{:?}", trace.decision.severity).to_lowercase(),
        escalate: trace.decision.escalate,
        require_manual_intervention: trace.decision.require_manual_intervention,
        must_deliver: trace.decision.must_deliver,
        no_silent_failure: trace.decision.no_silent_failure,
    }
}

fn trust_signals(
    trust: &crate::css_case_delivery_trust_view::types::CssCaseDeliveryTrustView,
) -> crate::css_case_delivery_signals_hub::types::DeliveryTrustSignals {
    crate::css_case_delivery_signals_hub::types::DeliveryTrustSignals {
        trust_level: trust_level_string(&trust.trust_level),
        is_trusted: trust.is_trusted,
        is_high_attention: trust.is_high_attention,
    }
}

fn risk_signals(
    risk: &crate::css_case_delivery_risk_view::types::CssCaseDeliveryRiskView,
) -> crate::css_case_delivery_signals_hub::types::DeliveryRiskSignals {
    crate::css_case_delivery_signals_hub::types::DeliveryRiskSignals {
        risk_level: risk_level_string(&risk.risk_level),
        is_high_risk: risk.is_high_risk,
        active_risk_factor_keys: risk
            .factors
            .iter()
            .filter(|factor| factor.active)
            .map(|factor| factor.key.clone())
            .collect(),
    }
}

fn assurance_signals(
    assurance: &crate::css_case_delivery_assurance_view::types::CssCaseDeliveryAssuranceView,
) -> crate::css_case_delivery_signals_hub::types::DeliveryAssuranceSignals {
    crate::css_case_delivery_signals_hub::types::DeliveryAssuranceSignals {
        assurance_level: assurance_level_string(&assurance.assurance_level),
        is_under_watch: assurance.is_under_watch,
        requires_manual_intervention: assurance.requires_manual_intervention,
        requires_recovery: assurance.is_in_mandatory_recovery_queue,
    }
}

fn explain_signals(
    explain: &crate::css_case_delivery_explain_view::types::CssCaseDeliveryExplainView,
) -> crate::css_case_delivery_signals_hub::types::DeliveryExplainSignals {
    crate::css_case_delivery_signals_hub::types::DeliveryExplainSignals {
        management_summary: explain.management_summary.clone(),
        highlights: explain.highlights.clone(),
    }
}

pub async fn build_delivery_signals_hub(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_signals_hub::types::DeliverySignalsHubViewRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_signals_hub::types::CssCaseDeliverySignalsHubView> {
    let trace = crate::css_case_delivery_decision_trace::runtime::build_delivery_decision_trace(
        pool,
        crate::css_case_delivery_decision_trace::types::DeliveryDecisionTraceRequest {
            target: req.target.clone(),
            consecutive_failures: req.consecutive_failures,
            latest_failed: req.latest_failed,
            source_target: None,
            source_mode: None,
            retry_still_failing: req.latest_failed && req.consecutive_failures >= 2,
            delivered: Some(!req.latest_failed),
            failure_streak: Some(req.consecutive_failures),
        },
        now_rfc3339,
    )
    .await?;

    let trust = crate::css_case_delivery_trust_view::runtime::build_delivery_trust_view(
        pool,
        crate::css_case_delivery_trust_view::types::DeliveryTrustViewRequest {
            target: req.target.clone(),
            consecutive_failures: req.consecutive_failures,
            latest_failed: req.latest_failed,
        },
        now_rfc3339,
    )
    .await?;

    let risk = crate::css_case_delivery_risk_view::runtime::build_delivery_risk_view(
        pool,
        crate::css_case_delivery_risk_view::types::DeliveryRiskViewRequest {
            target: req.target.clone(),
            consecutive_failures: req.consecutive_failures,
            latest_failed: req.latest_failed,
        },
        now_rfc3339,
    )
    .await?;

    let assurance =
        crate::css_case_delivery_assurance_view::runtime::build_delivery_assurance_view(
            pool,
            crate::css_case_delivery_assurance_view::types::DeliveryAssuranceViewRequest {
                target: req.target.clone(),
                consecutive_failures: req.consecutive_failures,
                latest_failed: req.latest_failed,
            },
            now_rfc3339,
        )
        .await?;

    let explain = crate::css_case_delivery_explain_view::runtime::build_delivery_explain_view(
        pool,
        crate::css_case_delivery_explain_view::types::DeliveryExplainViewRequest {
            target: req.target.clone(),
            consecutive_failures: req.consecutive_failures,
            latest_failed: req.latest_failed,
        },
        now_rfc3339,
    )
    .await?;

    let mut signals = Vec::new();

    if let Some(signal) = crate::css_case_delivery_signals_hub::composer::consecutive_failure_signal(
        req.consecutive_failures,
    ) {
        signals.push(signal);
    }

    if let Some(signal) =
        crate::css_case_delivery_signals_hub::composer::must_deliver_violation_signal(&trust)
    {
        signals.push(signal);
    }

    if let Some(signal) =
        crate::css_case_delivery_signals_hub::composer::manual_intervention_signal(&trust)
    {
        signals.push(signal);
    }

    if let Some(signal) =
        crate::css_case_delivery_signals_hub::composer::silent_failure_signal(&explain)
    {
        signals.push(signal);
    }

    signals
        .push(crate::css_case_delivery_signals_hub::composer::governance_severity_signal(&trust));
    signals.push(crate::css_case_delivery_signals_hub::composer::trust_level_signal(&trust));
    signals.push(crate::css_case_delivery_signals_hub::composer::risk_level_signal(&risk));
    signals.push(
        crate::css_case_delivery_signals_hub::composer::assurance_monitoring_signal(&assurance),
    );

    Ok(
        crate::css_case_delivery_signals_hub::types::CssCaseDeliverySignalsHubView {
            input: input_signals(&req),
            governance: governance_signals(&trace),
            trust: trust_signals(&trust),
            risk: risk_signals(&risk),
            assurance: assurance_signals(&assurance),
            explain: explain_signals(&explain),
            subject: None,
            base: crate::css_case_delivery_signals_hub::types::DeliveryBaseSignals {
                consecutive_failures: req.consecutive_failures,
                retry_still_failing: req.latest_failed && req.consecutive_failures >= 2,
                must_deliver: trace.evaluation.must_deliver,
                silent_failure_allowed: trace.evaluation.silent_failure_allowed,
                should_escalate: trace.evaluation.should_escalate,
                require_manual_intervention: trace.evaluation.require_manual_intervention,
            },
            derived: crate::css_case_delivery_signals_hub::types::DeliveryDerivedSignals {
                governance_severity: governance_severity_string(&trust.governance_grade),
                trust_level: trust_level_string(&trust.trust_level),
                risk_level: risk_level_string(&risk.risk_level),
                is_trusted: trust.is_trusted,
                is_high_attention: trust.is_high_attention,
                is_under_watch: assurance.is_under_watch,
                is_in_mandatory_recovery_queue: assurance.is_in_mandatory_recovery_queue,
            },
            explain_reasons: trace.evaluation.reasons.clone(),
            signals,
        },
    )
}

pub async fn build_delivery_signals_hub_from_legacy(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_signals_hub::types::DeliverySignalsHubRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_signals_hub::types::CssCaseDeliverySignalsHubView> {
    let view_req = view_request_from_legacy(&req);
    let mut hub = build_delivery_signals_hub(pool, view_req, now_rfc3339).await?;

    let consecutive_failures =
        req.consecutive_failures
            .unwrap_or(if req.delivered { 0 } else { req.failure_streak });
    let retry_still_failing = req.retry_still_failing || consecutive_failures >= 2;

    hub.subject = Some(
        crate::css_case_delivery_signals_hub::types::DeliverySignalSubject {
            target: req.target.clone(),
            mode: req.mode.clone(),
        },
    );
    hub.base.retry_still_failing = retry_still_failing;

    Ok(hub)
}
