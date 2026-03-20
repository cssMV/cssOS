use crate::css_signals_cache::types::{CacheSubjectKind, CssSignalsCacheEntry};
use sqlx::Row;

pub const CREATE_CSS_SIGNALS_CACHE_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_signals_cache (
    cache_id TEXT PRIMARY KEY,
    subject_kind TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    signals_bundle_json JSONB NOT NULL,
    generated_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL
)
"#;

pub async fn get_cache_entry(
    pool: &sqlx::PgPool,
    subject_kind: &CacheSubjectKind,
    subject_id: &str,
) -> anyhow::Result<Option<CssSignalsCacheEntry>> {
    let row = sqlx::query(
        r#"
        SELECT
            cache_id,
            subject_kind,
            subject_id,
            signals_bundle_json,
            generated_at::text AS generated_at,
            expires_at::text AS expires_at
        FROM css_signals_cache
        WHERE subject_kind = $1 AND subject_id = $2
        "#,
    )
    .bind(subject_kind_to_db(subject_kind))
    .bind(subject_id)
    .fetch_optional(pool)
    .await?;

    row.map(row_to_cache_entry).transpose()
}

pub async fn upsert_cache_entry(
    pool: &sqlx::PgPool,
    entry: &CssSignalsCacheEntry,
) -> anyhow::Result<()> {
    let payload = serde_json::to_value(&entry.signals_bundle)?;
    sqlx::query(
        r#"
        INSERT INTO css_signals_cache (
            cache_id,
            subject_kind,
            subject_id,
            signals_bundle_json,
            generated_at,
            expires_at
        )
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (subject_kind, subject_id)
        DO UPDATE SET
            cache_id = EXCLUDED.cache_id,
            signals_bundle_json = EXCLUDED.signals_bundle_json,
            generated_at = EXCLUDED.generated_at,
            expires_at = EXCLUDED.expires_at
        "#,
    )
    .bind(&entry.cache_id)
    .bind(subject_kind_to_db(&entry.subject_kind))
    .bind(&entry.subject_id)
    .bind(payload)
    .bind(&entry.generated_at)
    .bind(&entry.expires_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete_cache_entry(
    pool: &sqlx::PgPool,
    subject_kind: &CacheSubjectKind,
    subject_id: &str,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        DELETE FROM css_signals_cache
        WHERE subject_kind = $1 AND subject_id = $2
        "#,
    )
    .bind(subject_kind_to_db(subject_kind))
    .bind(subject_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete_expired_cache_entries(
    pool: &sqlx::PgPool,
    now_rfc3339: &str,
) -> anyhow::Result<u64> {
    let res = sqlx::query(
        r#"
        DELETE FROM css_signals_cache
        WHERE expires_at <= $1::timestamptz
        "#,
    )
    .bind(now_rfc3339)
    .execute(pool)
    .await?;
    Ok(res.rows_affected())
}

fn subject_kind_to_db(kind: &CacheSubjectKind) -> &'static str {
    match kind {
        CacheSubjectKind::User => "user",
        CacheSubjectKind::Catalog => "catalog",
        CacheSubjectKind::Deal => "deal",
        CacheSubjectKind::Ownership => "ownership",
    }
}

fn subject_kind_from_db(value: &str) -> anyhow::Result<CacheSubjectKind> {
    match value {
        "user" => Ok(CacheSubjectKind::User),
        "catalog" => Ok(CacheSubjectKind::Catalog),
        "deal" => Ok(CacheSubjectKind::Deal),
        "ownership" => Ok(CacheSubjectKind::Ownership),
        other => anyhow::bail!("unknown signals cache subject kind: {other}"),
    }
}

fn row_to_cache_entry(row: sqlx::postgres::PgRow) -> anyhow::Result<CssSignalsCacheEntry> {
    Ok(CssSignalsCacheEntry {
        cache_id: row.try_get("cache_id")?,
        subject_kind: subject_kind_from_db(row.try_get::<&str, _>("subject_kind")?)?,
        subject_id: row.try_get("subject_id")?,
        signals_bundle: serde_json::from_value(row.try_get("signals_bundle_json")?)?,
        generated_at: row.try_get("generated_at")?,
        expires_at: row.try_get("expires_at")?,
    })
}
