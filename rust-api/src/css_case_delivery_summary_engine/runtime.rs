pub async fn build_delivery_summary(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_summary_engine::types::DeliverySummaryRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_summary_engine::types::CssCaseDeliverySummary> {
    let status = crate::css_case_delivery_status_view::runtime::build_delivery_status_view(
        pool,
        crate::css_case_delivery_status_view::types::DeliveryStatusViewRequest {
            target: req.target.clone(),
            mode: req.mode.clone(),
            consecutive_failures: req.consecutive_failures,
            retry_still_failing: req.retry_still_failing,
            replay_limit: req.replay_limit,
            action_limit: req.action_limit,
        },
    )
    .await?;

    let lifecycle =
        crate::css_case_delivery_lifecycle_view::runtime::build_delivery_lifecycle_view_from_legacy(
            pool,
            crate::css_case_delivery_lifecycle_view::types::DeliveryLifecycleLegacyRequest {
                target: req.target.clone(),
                mode: req.mode.clone(),
                consecutive_failures: req.consecutive_failures,
                retry_still_failing: req.retry_still_failing,
                replay_limit: req.replay_limit,
                action_limit: req.action_limit,
            },
            now_rfc3339,
        )
        .await?;

    let timeline_explain =
        crate::css_case_delivery_timeline_explain::runtime::build_delivery_timeline_explain_from_legacy(
            pool,
            crate::css_case_delivery_timeline_explain::types::DeliveryTimelineExplainRequest {
                target: req.target.clone(),
                mode: req.mode.clone(),
            },
        )
        .await?;

    let workspace =
        crate::css_case_delivery_workspace::runtime::build_delivery_workspace_from_legacy(
            pool,
            crate::css_case_delivery_workspace::types::DeliveryWorkspaceRequest {
                target: req.target,
                mode: req.mode,
                delivered: req.consecutive_failures == 0,
                failure_streak: req.consecutive_failures,
                timeline_limit: req.timeline_limit,
            },
            now_rfc3339,
        )
        .await?;

    Ok(
        crate::css_case_delivery_summary_engine::types::CssCaseDeliverySummary {
            one_line: crate::css_case_delivery_summary_engine::composer::one_line(&status),
            three_line: crate::css_case_delivery_summary_engine::composer::three_line(
                &status,
                &lifecycle,
                &timeline_explain,
            ),
            card_items: crate::css_case_delivery_summary_engine::composer::card_items(
                &workspace, &lifecycle, &status,
            ),
            notification_text: crate::css_case_delivery_summary_engine::composer::notification_text(
                &status, &workspace,
            ),
        },
    )
}
