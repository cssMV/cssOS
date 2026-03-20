use crate::css_signals_cache::types::{CacheSubjectKind, CssSignalsCacheEntry, SignalsCacheResult};

pub const DEFAULT_SIGNALS_CACHE_TTL_SECONDS: i64 = 60;

fn to_hub_subject_kind(
    kind: &CacheSubjectKind,
) -> crate::css_signals_hub::types::SignalSubjectKind {
    match kind {
        CacheSubjectKind::User => crate::css_signals_hub::types::SignalSubjectKind::User,
        CacheSubjectKind::Catalog => crate::css_signals_hub::types::SignalSubjectKind::Catalog,
        CacheSubjectKind::Deal => crate::css_signals_hub::types::SignalSubjectKind::Deal,
        CacheSubjectKind::Ownership => crate::css_signals_hub::types::SignalSubjectKind::Ownership,
    }
}

fn is_expired(expires_at: &str, now_rfc3339: &str) -> bool {
    let expires = chrono::DateTime::parse_from_rfc3339(expires_at)
        .map(|dt| dt.with_timezone(&chrono::Utc))
        .ok();
    let now = chrono::DateTime::parse_from_rfc3339(now_rfc3339)
        .map(|dt| dt.with_timezone(&chrono::Utc))
        .ok();

    match (expires, now) {
        (Some(expires), Some(now)) => expires <= now,
        _ => expires_at <= now_rfc3339,
    }
}

pub async fn build_fresh_entry(
    pool: &sqlx::PgPool,
    subject_kind: CacheSubjectKind,
    subject_id: &str,
    now_rfc3339: &str,
) -> anyhow::Result<CssSignalsCacheEntry> {
    let signals_bundle = crate::css_signals_hub::handlers::get_signals(
        pool,
        crate::css_signals_hub::types::GetSignalsRequest {
            subject_kind: to_hub_subject_kind(&subject_kind),
            subject_id: subject_id.to_string(),
        },
    )
    .await?;

    let expires_at = chrono::DateTime::parse_from_rfc3339(now_rfc3339)?.with_timezone(&chrono::Utc)
        + chrono::Duration::seconds(DEFAULT_SIGNALS_CACHE_TTL_SECONDS);

    Ok(CssSignalsCacheEntry {
        cache_id: format!("sc_{}", uuid::Uuid::new_v4()),
        subject_kind,
        subject_id: subject_id.to_string(),
        signals_bundle,
        generated_at: now_rfc3339.to_string(),
        expires_at: expires_at.to_rfc3339(),
    })
}

pub async fn get_or_refresh(
    pool: &sqlx::PgPool,
    subject_kind: CacheSubjectKind,
    subject_id: &str,
    now_rfc3339: &str,
) -> anyhow::Result<SignalsCacheResult> {
    if let Some(entry) =
        crate::css_signals_cache::store_pg::get_cache_entry(pool, &subject_kind, subject_id).await?
    {
        if !is_expired(&entry.expires_at, now_rfc3339) {
            return Ok(SignalsCacheResult { hit: true, entry });
        }
    }

    let fresh = build_fresh_entry(pool, subject_kind, subject_id, now_rfc3339).await?;
    crate::css_signals_cache::store_pg::upsert_cache_entry(pool, &fresh).await?;

    Ok(SignalsCacheResult {
        hit: false,
        entry: fresh,
    })
}

pub async fn invalidate(
    pool: &sqlx::PgPool,
    subject_kind: CacheSubjectKind,
    subject_id: &str,
) -> anyhow::Result<()> {
    crate::css_signals_cache::store_pg::delete_cache_entry(pool, &subject_kind, subject_id).await
}

pub async fn force_refresh(
    pool: &sqlx::PgPool,
    subject_kind: CacheSubjectKind,
    subject_id: &str,
    now_rfc3339: &str,
) -> anyhow::Result<CssSignalsCacheEntry> {
    let fresh = build_fresh_entry(pool, subject_kind, subject_id, now_rfc3339).await?;
    crate::css_signals_cache::store_pg::upsert_cache_entry(pool, &fresh).await?;
    Ok(fresh)
}

pub async fn cleanup_expired(pool: &sqlx::PgPool, now_rfc3339: &str) -> anyhow::Result<u64> {
    crate::css_signals_cache::store_pg::delete_expired_cache_entries(pool, now_rfc3339).await
}

#[cfg(test)]
mod tests {
    use super::is_expired;

    #[test]
    fn v182_expiry_detects_past_timestamp() {
        assert!(is_expired("2026-03-12T00:00:00Z", "2026-03-12T00:00:01Z"));
    }

    #[test]
    fn v182_expiry_keeps_future_timestamp_fresh() {
        assert!(!is_expired("2026-03-12T00:01:00Z", "2026-03-12T00:00:01Z"));
    }
}
