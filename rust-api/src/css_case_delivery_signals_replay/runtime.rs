fn replay_key(
    req: &crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayViewRequest,
) -> crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotKey {
    crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotKey {
        target: req.target.clone(),
        consecutive_failures: req.consecutive_failures,
        latest_failed: req.latest_failed,
    }
}

fn changes_between(
    prev: &crate::css_case_delivery_signals_snapshot::types::CssCaseDeliverySignalsSnapshotRecord,
    curr: &crate::css_case_delivery_signals_snapshot::types::CssCaseDeliverySignalsSnapshotRecord,
) -> anyhow::Result<Vec<crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayChange>>
{
    let diff = crate::css_case_delivery_signals_snapshot::runtime::diff_delivery_signals_snapshots(
        prev, curr,
    )?;

    Ok(diff
        .changes
        .into_iter()
        .map(
            |change| crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayChange {
                field: change.field,
                before: change.before,
                after: change.after,
            },
        )
        .collect())
}

fn node_from_snapshot(
    snapshot: &crate::css_case_delivery_signals_snapshot::types::CssCaseDeliverySignalsSnapshotRecord,
    changes: Vec<crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayChange>,
) -> anyhow::Result<crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayNode> {
    let env = crate::css_case_delivery_signals_replay::composer::parse_envelope(snapshot)?;

    Ok(
        crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayNode {
            snapshot_id: snapshot.signals_snapshot_id.clone(),
            reason: snapshot.reason.clone(),
            created_at: snapshot.created_at.clone(),
            trust_level: crate::css_case_delivery_signals_replay::composer::trust_level(&env),
            risk_level: crate::css_case_delivery_signals_replay::composer::risk_level(&env),
            assurance_level: crate::css_case_delivery_signals_replay::composer::assurance_level(
                &env,
            ),
            changes,
            governance_severity:
                crate::css_case_delivery_signals_replay::composer::governance_severity(&env),
            summary: crate::css_case_delivery_signals_replay::composer::node_summary(&env),
        },
    )
}

async fn load_snapshots_for_replay(
    pool: &sqlx::PgPool,
    key: &crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotKey,
) -> anyhow::Result<
    Vec<crate::css_case_delivery_signals_snapshot::types::CssCaseDeliverySignalsSnapshotRecord>,
> {
    let key_hash = crate::css_case_delivery_signals_snapshot::runtime::snapshot_key_hash(key)?;

    crate::css_case_delivery_signals_snapshot::store_pg::list_delivery_signals_snapshots_by_key_hash(
        pool,
        &key_hash,
    )
    .await
}

pub async fn build_delivery_signals_replay(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayViewRequest,
) -> anyhow::Result<crate::css_case_delivery_signals_replay::types::CssCaseDeliverySignalsReplay> {
    let key = replay_key(&req);
    let mut snapshots = load_snapshots_for_replay(pool, &key).await?;
    snapshots.sort_by(|a, b| {
        a.created_at
            .cmp(&b.created_at)
            .then_with(|| a.signals_snapshot_id.cmp(&b.signals_snapshot_id))
    });

    let mut nodes = Vec::new();

    for (idx, snapshot) in snapshots.iter().enumerate() {
        let changes = if idx == 0 {
            Vec::new()
        } else {
            changes_between(&snapshots[idx - 1], snapshot)?
        };

        nodes.push(node_from_snapshot(snapshot, changes)?);
    }

    Ok(
        crate::css_case_delivery_signals_replay::types::CssCaseDeliverySignalsReplay {
            snapshot_key: key,
            nodes,
        },
    )
}

pub async fn build_delivery_signals_replay_from_legacy(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayRequest,
) -> anyhow::Result<crate::css_case_delivery_signals_replay::types::CssCaseDeliverySignalsReplayView>
{
    let subject_key =
        crate::css_case_delivery_signals_snapshot::runtime::subject_key(&req.target, &req.mode);

    let mut snapshots =
        crate::css_case_delivery_signals_snapshot::store_pg::list_signals_snapshots_for_subject(
            pool,
            &subject_key,
        )
        .await
        .unwrap_or_default();

    snapshots.sort_by(|a, b| {
        a.created_at
            .cmp(&b.created_at)
            .then_with(|| a.snapshot_id.cmp(&b.snapshot_id))
    });
    snapshots.truncate(req.limit.unwrap_or(50));

    let mut nodes = Vec::new();
    let mut steps = Vec::new();
    let mut prev_env: Option<
        crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotEnvelope,
    > = None;

    for record in snapshots.iter() {
        let env = crate::css_case_delivery_signals_replay::composer::parse_envelope(record)?;
        let node_summary = crate::css_case_delivery_signals_replay::composer::node_summary(&env);
        let transition = crate::css_case_delivery_signals_replay::composer::transition_kind(
            prev_env.as_ref(),
            &env,
        );
        let summary =
            crate::css_case_delivery_signals_replay::composer::step_summary(&transition, &env);

        let changes = if let Some(prev) = snapshots
            .iter()
            .position(|item| item.signals_snapshot_id == record.signals_snapshot_id)
            .and_then(|idx| idx.checked_sub(1).map(|prev_idx| &snapshots[prev_idx]))
        {
            changes_between(prev, record)?
        } else {
            Vec::new()
        };

        nodes.push(
            crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayNode {
                snapshot_id: record.snapshot_id.clone(),
                reason: record.reason.clone(),
                created_at: record.created_at.clone(),
                trust_level: crate::css_case_delivery_signals_replay::composer::trust_level(&env),
                risk_level: crate::css_case_delivery_signals_replay::composer::risk_level(&env),
                assurance_level: crate::css_case_delivery_signals_replay::composer::assurance_level(
                    &env,
                ),
                changes,
                governance_severity:
                    crate::css_case_delivery_signals_replay::composer::governance_severity(&env),
                summary: node_summary,
            },
        );

        steps.push(
            crate::css_case_delivery_signals_replay::types::DeliverySignalsReplayStep {
                snapshot_id: record.snapshot_id.clone(),
                created_at: record.created_at.clone(),
                transition,
                summary,
                trust_level: crate::css_case_delivery_signals_replay::composer::trust_level(&env),
                risk_level: crate::css_case_delivery_signals_replay::composer::risk_level(&env),
                monitoring_level:
                    crate::css_case_delivery_signals_replay::composer::monitoring_level(&env),
            },
        );

        prev_env = Some(env);
    }

    Ok(
        crate::css_case_delivery_signals_replay::types::CssCaseDeliverySignalsReplayView {
            target: req.target,
            mode: req.mode,
            subject_key,
            snapshot_key: snapshots.first().map(|item| item.snapshot_key.clone()),
            nodes,
            steps,
        },
    )
}
