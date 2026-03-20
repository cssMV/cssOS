fn explain_request_from_legacy(
    req: &crate::css_case_delivery_explain_view::types::DeliveryExplainRequest,
) -> crate::css_case_delivery_explain_view::types::DeliveryExplainViewRequest {
    let consecutive_failures = req.consecutive_failures.unwrap_or(req.failure_streak);

    crate::css_case_delivery_explain_view::types::DeliveryExplainViewRequest {
        target: crate::css_case_delivery_decision_trace::runtime::api_target_from_log_target(
            &req.target,
        ),
        consecutive_failures,
        latest_failed: !req.delivered,
    }
}

pub async fn build_delivery_explain_view(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_explain_view::types::DeliveryExplainViewRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_explain_view::types::CssCaseDeliveryExplainView> {
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

    let ops_explanation = crate::css_case_delivery_explain_view::composer::ops_explanation(&trace);
    let management_summary =
        crate::css_case_delivery_explain_view::composer::management_summary(&trace);
    let api_fields = crate::css_case_delivery_explain_view::composer::api_fields(&trace);
    let highlights = crate::css_case_delivery_explain_view::composer::highlights(&trace);
    let reasons = crate::css_case_delivery_explain_view::composer::reasons(&trace);
    let fields = crate::css_case_delivery_explain_view::composer::fields(&trace);
    let ops_summary = crate::css_case_delivery_explain_view::composer::ops_summary(&trace);

    Ok(
        crate::css_case_delivery_explain_view::types::CssCaseDeliveryExplainView {
            ops_explanation: ops_explanation.clone(),
            management_summary: management_summary.clone(),
            api_fields,
            highlights,
            ops_summary: ops_summary.clone(),
            reasons,
            fields: fields.clone(),
            summary: crate::css_case_delivery_explain_view::types::DeliveryExplainSummary {
                title: crate::css_case_delivery_explain_view::composer::summary_title(&trace),
                status: crate::css_case_delivery_explain_view::composer::summary_status(&trace),
            },
            evidence: crate::css_case_delivery_explain_view::composer::evidence(&trace),
        },
    )
}

pub async fn build_delivery_explain_view_from_legacy(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_explain_view::types::DeliveryExplainRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_explain_view::types::CssCaseDeliveryExplainView> {
    build_delivery_explain_view(pool, explain_request_from_legacy(&req), now_rfc3339).await
}
