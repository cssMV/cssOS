use crate::css_case_delivery_policy_engine::types::{
    CssCaseDeliveryPolicy, CssCaseDeliveryPolicyRecord,
};
use sqlx::Row;

pub const CREATE_CSS_CASE_DELIVERY_POLICIES_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_case_delivery_policies (
    policy_id TEXT PRIMARY KEY,
    policy_name TEXT NOT NULL,
    config_json JSONB NOT NULL,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP NOT NULL
)
"#;

pub const CREATE_INDEX_CSS_CASE_DELIVERY_POLICIES_IS_ACTIVE_SQL: &str = r#"
CREATE INDEX IF NOT EXISTS idx_css_case_delivery_policies_is_active
ON css_case_delivery_policies(is_active)
"#;

pub const CREATE_INDEX_CSS_CASE_DELIVERY_POLICIES_CREATED_AT_SQL: &str = r#"
CREATE INDEX IF NOT EXISTS idx_css_case_delivery_policies_created_at
ON css_case_delivery_policies(created_at)
"#;

pub async fn insert_delivery_policy(
    pool: &sqlx::PgPool,
    record: &CssCaseDeliveryPolicyRecord,
) -> anyhow::Result<()> {
    let config_json = serde_json::to_value(&record.config)?;

    sqlx::query(
        r#"
        INSERT INTO css_case_delivery_policies (
            policy_id, policy_name, config_json, is_active, created_at
        )
        VALUES ($1,$2,$3,$4,$5)
        "#,
    )
    .bind(&record.policy_id)
    .bind(&record.policy_name)
    .bind(config_json)
    .bind(record.is_active)
    .bind(&record.created_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_delivery_policy(
    pool: &sqlx::PgPool,
    policy_id: &str,
) -> anyhow::Result<Option<CssCaseDeliveryPolicyRecord>> {
    let row = sqlx::query(
        r#"
        SELECT policy_id, policy_name, config_json, is_active, created_at::text AS created_at
        FROM css_case_delivery_policies
        WHERE policy_id = $1
        "#,
    )
    .bind(policy_id)
    .fetch_optional(pool)
    .await?;

    row.map(row_to_delivery_policy).transpose()
}

pub async fn list_delivery_policies(
    pool: &sqlx::PgPool,
) -> anyhow::Result<Vec<CssCaseDeliveryPolicyRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT policy_id, policy_name, config_json, is_active, created_at::text AS created_at
        FROM css_case_delivery_policies
        ORDER BY created_at DESC, policy_id DESC
        "#,
    )
    .fetch_all(pool)
    .await?;

    rows.into_iter().map(row_to_delivery_policy).collect()
}

pub async fn get_active_delivery_policy(
    pool: &sqlx::PgPool,
) -> anyhow::Result<Option<CssCaseDeliveryPolicyRecord>> {
    let row = sqlx::query(
        r#"
        SELECT policy_id, policy_name, config_json, is_active, created_at::text AS created_at
        FROM css_case_delivery_policies
        WHERE is_active = true
        ORDER BY created_at DESC, policy_id DESC
        LIMIT 1
        "#,
    )
    .fetch_optional(pool)
    .await?;

    row.map(row_to_delivery_policy).transpose()
}

pub async fn set_active_delivery_policy(
    pool: &sqlx::PgPool,
    policy_id: &str,
) -> anyhow::Result<()> {
    let mut tx = pool.begin().await?;

    sqlx::query("UPDATE css_case_delivery_policies SET is_active = false WHERE is_active = true")
        .execute(&mut *tx)
        .await?;

    sqlx::query("UPDATE css_case_delivery_policies SET is_active = true WHERE policy_id = $1")
        .bind(policy_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(())
}

fn row_to_delivery_policy(
    row: sqlx::postgres::PgRow,
) -> anyhow::Result<CssCaseDeliveryPolicyRecord> {
    let config_json: serde_json::Value = row.try_get("config_json")?;
    Ok(CssCaseDeliveryPolicyRecord {
        policy_id: row.try_get("policy_id")?,
        policy_name: row.try_get("policy_name")?,
        config: serde_json::from_value(config_json)?,
        is_active: row.try_get("is_active")?,
        created_at: row.try_get("created_at")?,
    })
}

// Legacy-kept wrappers for older versioning/audit code paths.

pub async fn insert_policy(
    pool: &sqlx::PgPool,
    policy: &CssCaseDeliveryPolicy,
) -> anyhow::Result<()> {
    insert_delivery_policy(
        pool,
        &crate::css_case_delivery_policy_engine::runtime::policy_record_from_legacy(policy),
    )
    .await
}

pub async fn get_policy(
    pool: &sqlx::PgPool,
    policy_id: &str,
) -> anyhow::Result<Option<CssCaseDeliveryPolicy>> {
    Ok(get_delivery_policy(pool, policy_id).await?.map(|record| {
        crate::css_case_delivery_policy_engine::runtime::legacy_policy_from_record(record)
    }))
}

pub async fn get_active_policy(
    pool: &sqlx::PgPool,
) -> anyhow::Result<Option<CssCaseDeliveryPolicy>> {
    Ok(get_active_delivery_policy(pool).await?.map(|record| {
        crate::css_case_delivery_policy_engine::runtime::legacy_policy_from_record(record)
    }))
}

pub async fn list_policies(pool: &sqlx::PgPool) -> anyhow::Result<Vec<CssCaseDeliveryPolicy>> {
    Ok(list_delivery_policies(pool)
        .await?
        .into_iter()
        .map(crate::css_case_delivery_policy_engine::runtime::legacy_policy_from_record)
        .collect())
}

pub async fn set_active_policy(pool: &sqlx::PgPool, policy_id: &str) -> anyhow::Result<()> {
    set_active_delivery_policy(pool, policy_id).await
}
