fn trust_request_from_legacy(
    req: &crate::css_case_delivery_trust_view::types::DeliveryTrustRequest,
) -> crate::css_case_delivery_trust_view::types::DeliveryTrustViewRequest {
    crate::css_case_delivery_trust_view::types::DeliveryTrustViewRequest {
        target: crate::css_case_delivery_decision_trace::runtime::api_target_from_log_target(
            &req.target,
        ),
        consecutive_failures: req.consecutive_failures.unwrap_or(req.failure_streak),
        latest_failed: !req.delivered,
    }
}

pub async fn build_delivery_trust_view(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_trust_view::types::DeliveryTrustViewRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_trust_view::types::CssCaseDeliveryTrustView> {
    let trace = crate::css_case_delivery_decision_trace::runtime::build_delivery_decision_trace(
        pool,
        crate::css_case_delivery_decision_trace::types::DeliveryDecisionTraceRequest {
            target: req.target,
            consecutive_failures: req.consecutive_failures,
            latest_failed: req.latest_failed,
            source_target: None,
            source_mode: None,
            retry_still_failing: req.consecutive_failures >= 2,
            delivered: Some(!req.latest_failed),
            failure_streak: Some(req.consecutive_failures),
        },
        now_rfc3339,
    )
    .await?;

    let explain = crate::css_case_delivery_explain_view::runtime::build_delivery_explain_view(
        pool,
        crate::css_case_delivery_explain_view::types::DeliveryExplainViewRequest {
            target: trace.input.target.clone(),
            consecutive_failures: trace.input.consecutive_failures,
            latest_failed: trace.input.latest_failed,
        },
        now_rfc3339,
    )
    .await?;

    let trust_level = crate::css_case_delivery_trust_view::composer::trust_level_from_trace(&trace);
    let governance_grade =
        crate::css_case_delivery_trust_view::composer::governance_grade_from_trace(&trace);
    let is_trusted = crate::css_case_delivery_trust_view::composer::is_trusted(&trust_level);
    let is_high_attention =
        crate::css_case_delivery_trust_view::composer::is_high_attention(&trust_level);
    let requires_manual_intervention = trace.decision.require_manual_intervention;
    let highlights = crate::css_case_delivery_trust_view::composer::trust_highlights(&trace);
    let summary = crate::css_case_delivery_trust_view::composer::trust_summary(&trust_level);

    Ok(
        crate::css_case_delivery_trust_view::types::CssCaseDeliveryTrustView {
            trust_level,
            is_trusted,
            is_high_attention,
            requires_manual_intervention,
            summary,
            highlights: highlights.clone(),
            governance_grade,
            is_consecutive_failure: trace.input.consecutive_failures >= 2,
            has_must_deliver_violation: trace.decision.must_deliver && trace.input.latest_failed,
            signals: if highlights.is_empty() {
                crate::css_case_delivery_trust_view::composer::trust_signals(&explain)
            } else {
                highlights
            },
        },
    )
}

pub async fn build_delivery_trust_view_from_legacy(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_trust_view::types::DeliveryTrustRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_trust_view::types::CssCaseDeliveryTrustView> {
    build_delivery_trust_view(pool, trust_request_from_legacy(&req), now_rfc3339).await
}
