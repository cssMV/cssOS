fn risk_request_from_legacy(
    req: &crate::css_case_delivery_risk_view::types::DeliveryRiskRequest,
) -> crate::css_case_delivery_risk_view::types::DeliveryRiskViewRequest {
    crate::css_case_delivery_risk_view::types::DeliveryRiskViewRequest {
        target: crate::css_case_delivery_decision_trace::runtime::api_target_from_log_target(
            &req.target,
        ),
        consecutive_failures: req.consecutive_failures.unwrap_or(req.failure_streak),
        latest_failed: !req.delivered,
    }
}

pub async fn build_delivery_risk_view(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_risk_view::types::DeliveryRiskViewRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_risk_view::types::CssCaseDeliveryRiskView> {
    let trace = crate::css_case_delivery_decision_trace::runtime::build_delivery_decision_trace(
        pool,
        crate::css_case_delivery_decision_trace::types::DeliveryDecisionTraceRequest {
            target: req.target.clone(),
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

    let trust = crate::css_case_delivery_trust_view::runtime::build_delivery_trust_view(
        pool,
        crate::css_case_delivery_trust_view::types::DeliveryTrustViewRequest {
            target: req.target,
            consecutive_failures: req.consecutive_failures,
            latest_failed: req.latest_failed,
        },
        now_rfc3339,
    )
    .await?;

    let factors = crate::css_case_delivery_risk_view::composer::factors_from_trace(&trace);
    let risk_level = crate::css_case_delivery_risk_view::composer::risk_level(&trust, &trace);
    let primary_factor = crate::css_case_delivery_risk_view::composer::primary_factor(&factors);
    let primary_factor_key =
        crate::css_case_delivery_risk_view::composer::primary_factor_key(&factors);
    let active_factor_keys =
        crate::css_case_delivery_risk_view::composer::active_factor_keys(&factors);

    Ok(
        crate::css_case_delivery_risk_view::types::CssCaseDeliveryRiskView {
            risk_level: risk_level.clone(),
            is_high_risk: crate::css_case_delivery_risk_view::composer::is_high_risk(&risk_level),
            summary: crate::css_case_delivery_risk_view::composer::risk_summary(&risk_level),
            factors,
            primary_factor,
            primary_factor_key,
            active_factor_keys,
        },
    )
}

pub async fn build_delivery_risk_view_from_legacy(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_risk_view::types::DeliveryRiskRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_risk_view::types::CssCaseDeliveryRiskView> {
    build_delivery_risk_view(pool, risk_request_from_legacy(&req), now_rfc3339).await
}
