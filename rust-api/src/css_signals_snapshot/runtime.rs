use crate::css_signals_cache::types::CacheSubjectKind;
use crate::css_signals_snapshot::types::{
    CssSignalsSnapshot, SnapshotCreateRequest, SnapshotSubjectKind,
};

fn to_signal_subject_kind(
    kind: &SnapshotSubjectKind,
) -> crate::css_signals_hub::types::SignalSubjectKind {
    match kind {
        SnapshotSubjectKind::User => crate::css_signals_hub::types::SignalSubjectKind::User,
        SnapshotSubjectKind::Catalog => crate::css_signals_hub::types::SignalSubjectKind::Catalog,
        SnapshotSubjectKind::Deal => crate::css_signals_hub::types::SignalSubjectKind::Deal,
        SnapshotSubjectKind::Ownership => {
            crate::css_signals_hub::types::SignalSubjectKind::Ownership
        }
    }
}

fn to_cache_subject_kind(kind: &SnapshotSubjectKind) -> CacheSubjectKind {
    match kind {
        SnapshotSubjectKind::User => CacheSubjectKind::User,
        SnapshotSubjectKind::Catalog => CacheSubjectKind::Catalog,
        SnapshotSubjectKind::Deal => CacheSubjectKind::Deal,
        SnapshotSubjectKind::Ownership => CacheSubjectKind::Ownership,
    }
}

pub async fn create_snapshot(
    pool: &sqlx::PgPool,
    req: SnapshotCreateRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssSignalsSnapshot> {
    let cache_result = crate::css_signals_cache::runtime::get_or_refresh(
        pool,
        to_cache_subject_kind(&req.subject_kind),
        &req.subject_id,
        now_rfc3339,
    )
    .await?;

    let snapshot = CssSignalsSnapshot {
        snapshot_id: format!("ss_{}", uuid::Uuid::new_v4()),
        subject_kind: req.subject_kind,
        subject_id: req.subject_id,
        purpose: req.purpose,
        signals_bundle: cache_result.entry.signals_bundle,
        related_audit_id: req.related_audit_id,
        related_review_id: req.related_review_id,
        related_deal_id: req.related_deal_id,
        related_dispute_id: req.related_dispute_id,
        source_system: req.source_system,
        created_at: now_rfc3339.to_string(),
    };

    crate::css_signals_snapshot::store_pg::insert_snapshot(pool, &snapshot).await?;
    Ok(snapshot)
}

pub async fn create_fresh_snapshot(
    pool: &sqlx::PgPool,
    req: SnapshotCreateRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssSignalsSnapshot> {
    let signals_bundle = crate::css_signals_hub::handlers::get_signals(
        pool,
        crate::css_signals_hub::types::GetSignalsRequest {
            subject_kind: to_signal_subject_kind(&req.subject_kind),
            subject_id: req.subject_id.clone(),
        },
    )
    .await?;

    let snapshot = CssSignalsSnapshot {
        snapshot_id: format!("ss_{}", uuid::Uuid::new_v4()),
        subject_kind: req.subject_kind,
        subject_id: req.subject_id,
        purpose: req.purpose,
        signals_bundle,
        related_audit_id: req.related_audit_id,
        related_review_id: req.related_review_id,
        related_deal_id: req.related_deal_id,
        related_dispute_id: req.related_dispute_id,
        source_system: req.source_system,
        created_at: now_rfc3339.to_string(),
    };

    crate::css_signals_snapshot::store_pg::insert_snapshot(pool, &snapshot).await?;
    Ok(snapshot)
}

pub async fn list_subject_snapshots(
    pool: &sqlx::PgPool,
    subject_kind: SnapshotSubjectKind,
    subject_id: &str,
) -> anyhow::Result<Vec<CssSignalsSnapshot>> {
    crate::css_signals_snapshot::store_pg::list_snapshots_for_subject(
        pool,
        &subject_kind,
        subject_id,
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v184_snapshot_kind_maps_to_cache_kind() {
        assert!(matches!(
            to_cache_subject_kind(&SnapshotSubjectKind::Deal),
            CacheSubjectKind::Deal
        ));
    }
}
