pub async fn build_delivery_timeline_ui_model(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineUiViewRequest,
) -> anyhow::Result<crate::css_case_delivery_timeline_ui_model::types::CssCaseDeliveryTimelineUiModel>
{
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
                target: req.target.clone(),
                consecutive_failures: req.consecutive_failures,
                latest_failed: req.latest_failed,
            },
        )
        .await?;

    let storyboard = crate::css_case_delivery_storyboard::runtime::build_delivery_storyboard(
        pool,
        crate::css_case_delivery_storyboard::types::DeliveryStoryboardViewRequest {
            target: req.target,
            consecutive_failures: req.consecutive_failures,
            latest_failed: req.latest_failed,
        },
    )
    .await?;

    if replay.nodes.is_empty() {
        return Ok(
            crate::css_case_delivery_timeline_ui_model::types::CssCaseDeliveryTimelineUiModel {
                title: crate::css_case_delivery_timeline_ui_model::composer::title(),
                summary: "当前没有可用的时间线历史。".into(),
                current_state:
                    crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineUiCurrentState {
                        trust_level: "unknown".into(),
                        risk_level: "unknown".into(),
                        assurance_level: "unknown".into(),
                        summary: "当前没有可用状态。".into(),
                    },
                nodes: vec![],
                subject_key:
                    crate::css_case_delivery_signals_snapshot::runtime::snapshot_key_hash(
                        &replay.snapshot_key,
                    )?,
                headline: "当前没有可用的时间线历史。".into(),
                current_status_summary: Some("当前没有可用状态。".into()),
            },
        );
    }

    let fallback_status = replay
        .nodes
        .last()
        .map(|node| node.trust_level.clone())
        .unwrap_or_else(|| "unknown".into());
    let current_state = crate::css_case_delivery_timeline_ui_model::composer::current_state(
        replay.nodes.last().expect("nodes checked non-empty"),
    );

    Ok(
        crate::css_case_delivery_timeline_ui_model::types::CssCaseDeliveryTimelineUiModel {
            title: crate::css_case_delivery_timeline_ui_model::composer::title(),
            summary: crate::css_case_delivery_timeline_ui_model::composer::summary(&narrative),
            current_state,
            nodes: crate::css_case_delivery_timeline_ui_model::composer::build_nodes(
                &storyboard,
                fallback_status,
            ),
            subject_key: crate::css_case_delivery_signals_snapshot::runtime::snapshot_key_hash(
                &replay.snapshot_key,
            )?,
            headline: crate::css_case_delivery_timeline_ui_model::composer::headline(&narrative),
            current_status_summary:
                crate::css_case_delivery_timeline_ui_model::composer::current_status_summary(
                    &storyboard,
                ),
        },
    )
}

pub async fn build_delivery_timeline_ui_model_from_legacy(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineUiModelRequest,
) -> anyhow::Result<crate::css_case_delivery_timeline_ui_model::types::CssCaseDeliveryTimelineUiModel>
{
    let narrative =
        crate::css_case_delivery_signals_narrative::runtime::build_delivery_signals_narrative_from_legacy(
            pool,
            crate::css_case_delivery_signals_narrative::types::DeliverySignalsNarrativeRequest {
                target: req.target.clone(),
                mode: req.mode.clone(),
                tone: crate::css_case_delivery_signals_narrative::types::DeliveryNarrativeTone::Neutral,
                limit: req.limit,
            },
        )
        .await?;

    let storyboard =
        crate::css_case_delivery_storyboard::runtime::build_delivery_storyboard_from_legacy(
            pool,
            crate::css_case_delivery_storyboard::types::DeliveryStoryboardRequest {
                target: req.target,
                mode: req.mode,
                limit: req.limit,
            },
        )
        .await?;

    let fallback_status = storyboard
        .cards
        .last()
        .and_then(|card| {
            card.badges
                .iter()
                .find_map(|badge| badge.strip_prefix("trust: ").map(|value| value.to_string()))
        })
        .unwrap_or_else(|| "unknown".into());

    let current_state =
        crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineUiCurrentState {
            trust_level: fallback_status.clone(),
            risk_level: storyboard
                .cards
                .last()
                .and_then(|card| {
                    card.badges.iter().find_map(|badge| {
                        badge.strip_prefix("risk: ").map(|value| value.to_string())
                    })
                })
                .unwrap_or_else(|| "unknown".into()),
            assurance_level: storyboard
                .cards
                .last()
                .and_then(|card| {
                    card.badges.iter().find_map(|badge| {
                        badge
                            .strip_prefix("assurance: ")
                            .or_else(|| badge.strip_prefix("monitoring: "))
                            .map(|value| value.to_string())
                    })
                })
                .unwrap_or_else(|| "unknown".into()),
            summary: storyboard
                .cards
                .last()
                .map(|card| card.summary.clone())
                .unwrap_or_else(|| "当前没有可用状态。".into()),
        };

    Ok(
        crate::css_case_delivery_timeline_ui_model::types::CssCaseDeliveryTimelineUiModel {
            title: crate::css_case_delivery_timeline_ui_model::composer::title(),
            summary: crate::css_case_delivery_timeline_ui_model::composer::summary(&narrative),
            current_state,
            nodes: crate::css_case_delivery_timeline_ui_model::composer::build_nodes(
                &storyboard,
                fallback_status,
            ),
            subject_key: storyboard.subject_key.clone(),
            headline: crate::css_case_delivery_timeline_ui_model::composer::headline(&narrative),
            current_status_summary:
                crate::css_case_delivery_timeline_ui_model::composer::current_status_summary(
                    &storyboard,
                ),
        },
    )
}
