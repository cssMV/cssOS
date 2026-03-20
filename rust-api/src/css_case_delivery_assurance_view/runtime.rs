fn assurance_request_from_legacy(
    req: &crate::css_case_delivery_assurance_view::types::DeliveryAssuranceRequest,
) -> crate::css_case_delivery_assurance_view::types::DeliveryAssuranceViewRequest {
    let consecutive_failures = req.consecutive_failures.unwrap_or(req.failure_streak);

    crate::css_case_delivery_assurance_view::types::DeliveryAssuranceViewRequest {
        target: crate::css_case_delivery_decision_trace::runtime::api_target_from_log_target(
            &req.target,
        ),
        consecutive_failures,
        latest_failed: !req.delivered,
    }
}

pub async fn build_delivery_assurance_view(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_assurance_view::types::DeliveryAssuranceViewRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_assurance_view::types::CssCaseDeliveryAssuranceView> {
    let _trace = crate::css_case_delivery_decision_trace::runtime::build_delivery_decision_trace(
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

    let explain = crate::css_case_delivery_explain_view::runtime::build_delivery_explain_view(
        pool,
        crate::css_case_delivery_explain_view::types::DeliveryExplainViewRequest {
            target: req.target,
            consecutive_failures: req.consecutive_failures,
            latest_failed: req.latest_failed,
        },
        now_rfc3339,
    )
    .await?;

    let monitoring_level =
        crate::css_case_delivery_assurance_view::composer::monitoring_level(&trust, &risk);
    let assurance_level =
        crate::css_case_delivery_assurance_view::composer::assurance_level(&trust, &risk);
    let requires_manual_intervention = trust.requires_manual_intervention;
    let is_in_mandatory_recovery_queue =
        crate::css_case_delivery_assurance_view::composer::is_in_mandatory_recovery_queue(
            &trust, &risk,
        );
    let is_must_deliver_protected = explain.api_fields.must_deliver;
    let has_governance_protection =
        crate::css_case_delivery_assurance_view::composer::has_governance_protection(&trust);
    let protections = crate::css_case_delivery_assurance_view::composer::assurance_protections(
        &trust,
        &explain,
        is_in_mandatory_recovery_queue,
    );
    let limitations = crate::css_case_delivery_assurance_view::composer::assurance_limitations(
        &trust, &risk, &explain,
    );
    let measures = crate::css_case_delivery_assurance_view::composer::assurance_measures(
        &trust,
        &risk,
        &explain,
        is_in_mandatory_recovery_queue,
    );
    let summary = crate::css_case_delivery_assurance_view::composer::assurance_summary(
        &assurance_level,
        &monitoring_level,
        requires_manual_intervention,
        is_in_mandatory_recovery_queue,
        is_must_deliver_protected,
    );

    Ok(
        crate::css_case_delivery_assurance_view::types::CssCaseDeliveryAssuranceView {
            assurance_level: assurance_level.clone(),
            is_protected: !matches!(
                assurance_level,
                crate::css_case_delivery_assurance_view::types::DeliveryAssuranceLevel::Standard
            ),
            is_under_watch: !matches!(
                monitoring_level,
                crate::css_case_delivery_assurance_view::types::DeliveryMonitoringLevel::None
            ),
            monitoring_level,
            requires_manual_intervention,
            is_in_mandatory_recovery_queue,
            is_must_deliver_protected,
            has_governance_protection,
            summary,
            protections,
            limitations,
            measures,
        },
    )
}

pub async fn build_delivery_assurance_view_from_legacy(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_assurance_view::types::DeliveryAssuranceRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_assurance_view::types::CssCaseDeliveryAssuranceView> {
    build_delivery_assurance_view(pool, assurance_request_from_legacy(&req), now_rfc3339).await
}
