pub async fn build_delivery_timeline_explain(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_timeline_explain::types::DeliveryTimelineExplainViewRequest,
) -> anyhow::Result<crate::css_case_delivery_timeline_explain::types::CssCaseDeliveryTimelineExplain>
{
    let timeline = crate::css_case_delivery_timeline_merge::runtime::build_delivery_timeline_merge(
        pool,
        crate::css_case_delivery_timeline_merge::types::DeliveryTimelineMergeViewRequest {
            target: req.target,
            consecutive_failures: req.consecutive_failures,
            latest_failed: req.latest_failed,
        },
    )
    .await?;

    let key_nodes =
        crate::css_case_delivery_timeline_explain::composer::build_explained_nodes(&timeline);
    let summary = crate::css_case_delivery_timeline_explain::composer::explain_summary(&key_nodes);
    let key_findings =
        crate::css_case_delivery_timeline_explain::composer::key_findings(&key_nodes);

    Ok(
        crate::css_case_delivery_timeline_explain::types::CssCaseDeliveryTimelineExplain {
            subject_key: timeline.subject_key,
            summary,
            explained_nodes: key_nodes.clone(),
            key_nodes,
            key_findings,
        },
    )
}

pub async fn build_delivery_timeline_explain_from_legacy(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_timeline_explain::types::DeliveryTimelineExplainRequest,
) -> anyhow::Result<
    crate::css_case_delivery_timeline_explain::types::CssCaseDeliveryTimelineExplainView,
> {
    let timeline =
        crate::css_case_delivery_timeline_merge::runtime::build_delivery_timeline_merge_from_legacy(
            pool,
            crate::css_case_delivery_timeline_merge::types::DeliveryTimelineMergeRequest {
                target: req.target,
                mode: req.mode,
            },
        )
        .await?;

    let key_nodes =
        crate::css_case_delivery_timeline_explain::composer::build_explained_nodes(&timeline);
    let summary = crate::css_case_delivery_timeline_explain::composer::explain_summary(&key_nodes);
    let key_findings =
        crate::css_case_delivery_timeline_explain::composer::key_findings(&key_nodes);

    Ok(
        crate::css_case_delivery_timeline_explain::types::CssCaseDeliveryTimelineExplainView {
            subject_key: timeline.subject_key,
            summary,
            explained_nodes: key_nodes.clone(),
            key_nodes,
            key_findings,
        },
    )
}
