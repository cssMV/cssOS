fn to_snapshot_subject_kind(
    kind: &crate::css_signals_replay::types::ReplaySubjectKind,
) -> crate::css_signals_snapshot::types::SnapshotSubjectKind {
    match kind {
        crate::css_signals_replay::types::ReplaySubjectKind::User => {
            crate::css_signals_snapshot::types::SnapshotSubjectKind::User
        }
        crate::css_signals_replay::types::ReplaySubjectKind::Catalog => {
            crate::css_signals_snapshot::types::SnapshotSubjectKind::Catalog
        }
        crate::css_signals_replay::types::ReplaySubjectKind::Deal => {
            crate::css_signals_snapshot::types::SnapshotSubjectKind::Deal
        }
        crate::css_signals_replay::types::ReplaySubjectKind::Ownership => {
            crate::css_signals_snapshot::types::SnapshotSubjectKind::Ownership
        }
    }
}

pub async fn build_replay(
    pool: &sqlx::PgPool,
    req: crate::css_signals_replay::types::ReplayRequest,
) -> anyhow::Result<crate::css_signals_replay::types::SignalsReplayView> {
    let mut snapshots = crate::css_signals_snapshot::store_pg::list_snapshots_for_subject(
        pool,
        &to_snapshot_subject_kind(&req.subject_kind),
        &req.subject_id,
    )
    .await?;

    snapshots.reverse();

    let mut frames = Vec::new();
    let mut prev_signals: Option<Vec<crate::css_signals_hub::types::CssSignal>> = None;

    for s in snapshots {
        let curr_signals = s.signals_bundle.signals.clone();

        let deltas = if let Some(prev) = &prev_signals {
            crate::css_signals_replay::diff::diff_signals(prev, &curr_signals)
        } else {
            curr_signals
                .iter()
                .map(|sig| crate::css_signals_replay::types::SignalReplayDelta {
                    signal_kind: sig.signal_kind.clone(),
                    change_kind: crate::css_signals_replay::types::ReplayChangeKind::Added,
                    from_severity: None,
                    to_severity: Some(sig.severity.clone()),
                    description: format!("初始信号：{}", sig.title),
                })
                .collect()
        };

        frames.push(crate::css_signals_replay::types::SignalsReplayFrame {
            snapshot_id: s.snapshot_id.clone(),
            created_at: s.created_at.clone(),
            purpose: s.purpose.clone(),
            signals: curr_signals.clone(),
            deltas_from_previous: deltas,
        });

        prev_signals = Some(curr_signals);
    }

    Ok(crate::css_signals_replay::types::SignalsReplayView {
        subject_kind: req.subject_kind,
        subject_id: req.subject_id,
        frames,
    })
}

#[cfg(test)]
mod tests {
    #[test]
    fn v185_maps_catalog_replay_subject_to_snapshot_subject() {
        let got = super::to_snapshot_subject_kind(
            &crate::css_signals_replay::types::ReplaySubjectKind::Catalog,
        );
        assert_eq!(
            got,
            crate::css_signals_snapshot::types::SnapshotSubjectKind::Catalog
        );
    }
}
