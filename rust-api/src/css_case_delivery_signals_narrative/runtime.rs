pub async fn build_delivery_signals_narrative(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_signals_narrative::types::DeliverySignalsNarrativeViewRequest,
) -> anyhow::Result<
    crate::css_case_delivery_signals_narrative::types::CssCaseDeliverySignalsNarrative,
> {
    let replay = crate::css_case_delivery_signals_replay::runtime::build_delivery_signals_replay(
        pool,
        crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayViewRequest {
            target: req.target,
            consecutive_failures: req.consecutive_failures,
            latest_failed: req.latest_failed,
        },
    )
    .await?;

    if replay.nodes.is_empty() {
        return Ok(
            crate::css_case_delivery_signals_narrative::types::CssCaseDeliverySignalsNarrative {
                title: crate::css_case_delivery_signals_narrative::composer::narrative_title(),
                summary: "当前没有可用的信号历史。".into(),
                sentences: vec![],
                subject_key: crate::css_case_delivery_signals_snapshot::runtime::snapshot_key_hash(
                    &replay.snapshot_key,
                )?,
                tone: crate::css_case_delivery_signals_narrative::types::DeliveryNarrativeTone::Neutral,
                steps: vec![],
                paragraphs: vec![],
            },
        );
    }

    let first = replay.nodes.first().expect("nodes checked non-empty");
    let last = replay.nodes.last().expect("nodes checked non-empty");

    let mut sentences = vec![
        crate::css_case_delivery_signals_narrative::types::DeliverySignalsNarrativeSentence {
            text: crate::css_case_delivery_signals_narrative::composer::opening_sentence(first),
        },
    ];

    let mut steps = vec![
        crate::css_case_delivery_signals_narrative::types::DeliverySignalsNarrativeStep {
            created_at: first.created_at.clone(),
            text: crate::css_case_delivery_signals_narrative::composer::opening_sentence(first),
        },
    ];

    for pair in replay.nodes.windows(2) {
        if let [prev, curr] = pair {
            if let Some(text) =
                crate::css_case_delivery_signals_narrative::composer::transition_sentence_from_nodes(
                    prev, curr,
                )
            {
                sentences.push(
                    crate::css_case_delivery_signals_narrative::types::DeliverySignalsNarrativeSentence {
                        text: text.clone(),
                    },
                );
                steps.push(
                    crate::css_case_delivery_signals_narrative::types::DeliverySignalsNarrativeStep {
                        created_at: curr.created_at.clone(),
                        text,
                    },
                );
            }
        }
    }

    let closing = crate::css_case_delivery_signals_narrative::composer::closing_sentence(last);
    sentences.push(
        crate::css_case_delivery_signals_narrative::types::DeliverySignalsNarrativeSentence {
            text: closing.clone(),
        },
    );
    steps.push(
        crate::css_case_delivery_signals_narrative::types::DeliverySignalsNarrativeStep {
            created_at: last.created_at.clone(),
            text: closing.clone(),
        },
    );

    Ok(
        crate::css_case_delivery_signals_narrative::types::CssCaseDeliverySignalsNarrative {
            title: crate::css_case_delivery_signals_narrative::composer::narrative_title(),
            summary:
                crate::css_case_delivery_signals_narrative::composer::narrative_summary_from_nodes(
                    first, last,
                ),
            paragraphs: sentences.iter().map(|item| item.text.clone()).collect(),
            subject_key: crate::css_case_delivery_signals_snapshot::runtime::snapshot_key_hash(
                &replay.snapshot_key,
            )?,
            tone: crate::css_case_delivery_signals_narrative::types::DeliveryNarrativeTone::Neutral,
            steps,
            sentences,
        },
    )
}

pub async fn build_delivery_signals_narrative_from_legacy(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_signals_narrative::types::DeliverySignalsNarrativeRequest,
) -> anyhow::Result<
    crate::css_case_delivery_signals_narrative::types::CssCaseDeliverySignalsNarrative,
> {
    let replay =
        crate::css_case_delivery_signals_replay::runtime::build_delivery_signals_replay_from_legacy(
            pool,
            crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayRequest {
                target: req.target,
                mode: req.mode,
                limit: req.limit,
            },
        )
        .await?;

    let mut steps = Vec::new();

    if let Some(first) = replay.nodes.first() {
        steps.push(
            crate::css_case_delivery_signals_narrative::composer::initial_narrative_step(first),
        );
    }

    for window in replay.nodes.windows(2) {
        let prev = &window[0];
        let curr = &window[1];

        if let Some(step) =
            crate::css_case_delivery_signals_narrative::composer::transition_narrative_step(
                prev, curr,
            )
        {
            steps.push(step);
        }
    }

    if let Some(last) = replay.nodes.last() {
        steps.push(
            crate::css_case_delivery_signals_narrative::composer::current_narrative_step(last),
        );
    }

    let summary =
        crate::css_case_delivery_signals_narrative::composer::narrative_steps_summary(&steps);
    let paragraphs =
        crate::css_case_delivery_signals_narrative::composer::build_paragraphs(&replay);
    let sentences = paragraphs
        .iter()
        .cloned()
        .map(|text| {
            crate::css_case_delivery_signals_narrative::types::DeliverySignalsNarrativeSentence {
                text,
            }
        })
        .collect();

    Ok(
        crate::css_case_delivery_signals_narrative::types::CssCaseDeliverySignalsNarrative {
            title: crate::css_case_delivery_signals_narrative::composer::narrative_title(),
            summary,
            sentences,
            subject_key: replay.subject_key,
            tone: req.tone,
            steps,
            paragraphs,
        },
    )
}
