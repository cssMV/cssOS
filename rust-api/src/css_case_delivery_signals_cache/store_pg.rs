use crate::css_case_delivery_signals_cache::types::{
    CssCaseDeliverySignalsCacheRecord, DeliverySignalsCacheKey, DeliverySignalsCacheRecord,
};
use sqlx::Row;

pub const CREATE_CSS_CASE_DELIVERY_SIGNALS_CACHE_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_case_delivery_signals_cache (
    signals_cache_id TEXT PRIMARY KEY,
    cache_key_hash TEXT NOT NULL UNIQUE,
    cache_key_json JSONB NOT NULL,
    signals_json JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
)
"#;

pub async fn get_delivery_signals_cache_by_hash(
    pool: &sqlx::PgPool,
    cache_key_hash: &str,
) -> anyhow::Result<Option<DeliverySignalsCacheRecord>> {
    let row = sqlx::query(
        r#"
        SELECT
            signals_cache_id,
            cache_key_hash,
            cache_key_json,
            signals_json,
            created_at::text AS created_at,
            updated_at::text AS updated_at
        FROM css_case_delivery_signals_cache
        WHERE cache_key_hash = $1
        "#,
    )
    .bind(cache_key_hash)
    .fetch_optional(pool)
    .await?;

    row.map(row_to_delivery_signals_cache_record).transpose()
}

pub async fn get_signals_cache_by_subject_key(
    pool: &sqlx::PgPool,
    subject_key: &str,
) -> anyhow::Result<Option<CssCaseDeliverySignalsCacheRecord>> {
    if let Some((target, consecutive_failures, latest_failed)) =
        parse_legacy_subject_key(subject_key)
    {
        let key = DeliverySignalsCacheKey {
            target,
            consecutive_failures,
            latest_failed,
        };
        let hash = crate::css_case_delivery_signals_cache::runtime::cache_key_hash(&key)?;
        let record = get_delivery_signals_cache_by_hash(pool, &hash).await?;
        return record
            .map(raw_record_from_delivery_signals_cache_record)
            .transpose();
    }

    Ok(None)
}

pub async fn get_delivery_signals_cache_by_subject_key(
    pool: &sqlx::PgPool,
    subject_key: &str,
) -> anyhow::Result<
    Option<crate::css_case_delivery_signals_cache::types::DeliverySignalsLegacyRecord>,
> {
    let raw = get_signals_cache_by_subject_key(pool, subject_key).await?;
    raw.map(delivery_signals_legacy_record_from_raw).transpose()
}

pub async fn upsert_delivery_signals_cache(
    pool: &sqlx::PgPool,
    record: &DeliverySignalsCacheRecord,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO css_case_delivery_signals_cache (
            signals_cache_id,
            cache_key_hash,
            cache_key_json,
            signals_json,
            created_at,
            updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (cache_key_hash)
        DO UPDATE SET
            signals_cache_id = EXCLUDED.signals_cache_id,
            cache_key_json = EXCLUDED.cache_key_json,
            signals_json = EXCLUDED.signals_json,
            created_at = css_case_delivery_signals_cache.created_at,
            updated_at = EXCLUDED.updated_at
        "#,
    )
    .bind(&record.signals_cache_id)
    .bind(&record.key_hash)
    .bind(serde_json::to_value(&record.cache_key)?)
    .bind(serde_json::to_value(&record.signals)?)
    .bind(&record.created_at)
    .bind(&record.updated_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete_signals_cache(pool: &sqlx::PgPool, subject_key: &str) -> anyhow::Result<()> {
    if let Some((target, consecutive_failures, latest_failed)) =
        parse_legacy_subject_key(subject_key)
    {
        let key = DeliverySignalsCacheKey {
            target,
            consecutive_failures,
            latest_failed,
        };
        let hash = crate::css_case_delivery_signals_cache::runtime::cache_key_hash(&key)?;
        return delete_delivery_signals_cache_by_hash(pool, &hash).await;
    }

    Ok(())
}

pub async fn delete_delivery_signals_cache_by_hash(
    pool: &sqlx::PgPool,
    cache_key_hash: &str,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        DELETE FROM css_case_delivery_signals_cache
        WHERE cache_key_hash = $1
        "#,
    )
    .bind(cache_key_hash)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete_all_signals_cache(pool: &sqlx::PgPool) -> anyhow::Result<()> {
    sqlx::query("DELETE FROM css_case_delivery_signals_cache")
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn list_all_signals_cache(
    pool: &sqlx::PgPool,
) -> anyhow::Result<Vec<CssCaseDeliverySignalsCacheRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT
            signals_cache_id,
            cache_key_hash,
            cache_key_json,
            signals_json,
            created_at::text AS created_at,
            updated_at::text AS updated_at
        FROM css_case_delivery_signals_cache
        ORDER BY updated_at DESC, signals_cache_id DESC
        "#,
    )
    .fetch_all(pool)
    .await?;

    rows.into_iter()
        .map(row_to_delivery_signals_cache_record)
        .map(|item| item.and_then(raw_record_from_delivery_signals_cache_record))
        .collect()
}

fn row_to_delivery_signals_cache_record(
    row: sqlx::postgres::PgRow,
) -> anyhow::Result<DeliverySignalsCacheRecord> {
    Ok(DeliverySignalsCacheRecord {
        signals_cache_id: row.try_get("signals_cache_id")?,
        key_hash: row.try_get("cache_key_hash")?,
        cache_key: serde_json::from_value(row.try_get("cache_key_json")?)?,
        signals: serde_json::from_value(row.try_get("signals_json")?)?,
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
    })
}

pub fn raw_record_from_delivery_signals_cache_record(
    record: DeliverySignalsCacheRecord,
) -> anyhow::Result<CssCaseDeliverySignalsCacheRecord> {
    Ok(CssCaseDeliverySignalsCacheRecord {
        signals_cache_id: record.signals_cache_id,
        cache_key_hash: record.key_hash,
        cache_key_json: serde_json::to_value(record.cache_key)?,
        signals_json: serde_json::to_value(record.signals)?,
        created_at: record.created_at,
        updated_at: record.updated_at,
    })
}

pub fn delivery_signals_cache_record_from_raw(
    raw: CssCaseDeliverySignalsCacheRecord,
) -> anyhow::Result<DeliverySignalsCacheRecord> {
    Ok(DeliverySignalsCacheRecord {
        signals_cache_id: raw.signals_cache_id,
        key_hash: raw.cache_key_hash,
        cache_key: serde_json::from_value(raw.cache_key_json)?,
        signals: serde_json::from_value(raw.signals_json)?,
        created_at: raw.created_at,
        updated_at: raw.updated_at,
    })
}

fn parse_legacy_subject_key(
    subject_key: &str,
) -> Option<(
    crate::css_case_delivery_api::types::DeliveryApiTarget,
    usize,
    bool,
)> {
    let _ = subject_key;
    None
}

fn delivery_signals_legacy_record_from_raw(
    raw: CssCaseDeliverySignalsCacheRecord,
) -> anyhow::Result<crate::css_case_delivery_signals_cache::types::DeliverySignalsLegacyRecord> {
    let _ = raw;
    anyhow::bail!("legacy subject-key mapping is no longer supported for hash-keyed cache records")
}
