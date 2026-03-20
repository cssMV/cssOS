use crate::css_signals_cache::types::CacheSubjectKind;
use crate::css_signals_invalidation::types::{
    InvalidationResult, InvalidationSubjectKind, SignalsInvalidationEvent,
};

fn to_cache_subject_kind(kind: &InvalidationSubjectKind) -> CacheSubjectKind {
    match kind {
        InvalidationSubjectKind::User => CacheSubjectKind::User,
        InvalidationSubjectKind::Catalog => CacheSubjectKind::Catalog,
        InvalidationSubjectKind::Deal => CacheSubjectKind::Deal,
        InvalidationSubjectKind::Ownership => CacheSubjectKind::Ownership,
    }
}

pub async fn invalidate_from_event(
    pool: &sqlx::PgPool,
    event: SignalsInvalidationEvent,
) -> anyhow::Result<InvalidationResult> {
    let targets = crate::css_signals_invalidation::resolver::resolve_targets(pool, &event).await?;

    for target in &targets {
        crate::css_signals_cache::runtime::invalidate(
            pool,
            to_cache_subject_kind(&target.subject_kind),
            &target.subject_id,
        )
        .await?;
    }

    Ok(InvalidationResult {
        invalidated_count: targets.len(),
        targets,
    })
}

pub async fn refresh_from_event(
    pool: &sqlx::PgPool,
    event: SignalsInvalidationEvent,
    now_rfc3339: &str,
) -> anyhow::Result<InvalidationResult> {
    let targets = crate::css_signals_invalidation::resolver::resolve_targets(pool, &event).await?;

    for target in &targets {
        crate::css_signals_cache::runtime::force_refresh(
            pool,
            to_cache_subject_kind(&target.subject_kind),
            &target.subject_id,
            now_rfc3339,
        )
        .await?;
    }

    Ok(InvalidationResult {
        invalidated_count: targets.len(),
        targets,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v183_maps_subject_kinds_to_cache_subject_kinds() {
        assert!(matches!(
            to_cache_subject_kind(&InvalidationSubjectKind::Ownership),
            CacheSubjectKind::Ownership
        ));
    }
}
