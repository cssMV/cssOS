pub async fn build_delivery_storyboard(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_storyboard::types::DeliveryStoryboardViewRequest,
) -> anyhow::Result<crate::css_case_delivery_storyboard::types::CssCaseDeliveryStoryboard> {
    let replay = crate::css_case_delivery_signals_replay::runtime::build_delivery_signals_replay(
        pool,
        crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayViewRequest {
            target: req.target.clone(),
            consecutive_failures: req.consecutive_failures,
            latest_failed: req.latest_failed,
        },
    )
    .await?;

    let narrative =
        crate::css_case_delivery_signals_narrative::runtime::build_delivery_signals_narrative(
            pool,
            crate::css_case_delivery_signals_narrative::types::DeliverySignalsNarrativeViewRequest {
                target: req.target,
                consecutive_failures: req.consecutive_failures,
                latest_failed: req.latest_failed,
            },
        )
        .await?;

    if replay.nodes.is_empty() {
        return Ok(
            crate::css_case_delivery_storyboard::types::CssCaseDeliveryStoryboard {
                title: crate::css_case_delivery_storyboard::composer::storyboard_title(),
                summary: "当前没有可用的信号历史。".into(),
                cards: vec![],
                subject_key: crate::css_case_delivery_signals_snapshot::runtime::snapshot_key_hash(
                    &replay.snapshot_key,
                )?,
            },
        );
    }

    Ok(
        crate::css_case_delivery_storyboard::types::CssCaseDeliveryStoryboard {
            title: crate::css_case_delivery_storyboard::composer::storyboard_title(),
            summary: crate::css_case_delivery_storyboard::composer::storyboard_summary(&narrative),
            cards: crate::css_case_delivery_storyboard::composer::build_cards_from_nodes(&replay),
            subject_key: crate::css_case_delivery_signals_snapshot::runtime::snapshot_key_hash(
                &replay.snapshot_key,
            )?,
        },
    )
}

pub async fn build_delivery_storyboard_from_legacy(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_storyboard::types::DeliveryStoryboardRequest,
) -> anyhow::Result<crate::css_case_delivery_storyboard::types::CssCaseDeliveryStoryboard> {
    let replay =
        crate::css_case_delivery_signals_replay::runtime::build_delivery_signals_replay_from_legacy(
            pool,
            crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayRequest {
                target: req.target.clone(),
                mode: req.mode.clone(),
                limit: req.limit,
            },
        )
        .await?;

    Ok(
        crate::css_case_delivery_storyboard::types::CssCaseDeliveryStoryboard {
            title: crate::css_case_delivery_storyboard::composer::storyboard_title(),
            summary: replay
                .steps
                .last()
                .map(|step| step.summary.clone())
                .unwrap_or_else(|| "当前没有可用的信号历史。".into()),
            subject_key: replay.subject_key.clone(),
            cards: crate::css_case_delivery_storyboard::composer::build_cards(&replay, req.limit),
        },
    )
}
