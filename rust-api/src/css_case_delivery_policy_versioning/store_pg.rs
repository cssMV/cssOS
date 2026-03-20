use crate::css_case_delivery_policy_versioning::types::DeliveryPolicyVersionRecord;
use sqlx::Row;

pub const CREATE_CSS_CASE_DELIVERY_POLICY_VERSIONS_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_case_delivery_policy_versions (
    policy_version_id TEXT PRIMARY KEY,
    policy_name TEXT NOT NULL,
    version BIGINT NOT NULL,
    config_json JSONB NOT NULL,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP NOT NULL,
    activated_at TIMESTAMP NULL
)
"#;

pub const CREATE_UNIQ_CSS_CASE_DELIVERY_POLICY_VERSIONS_NAME_VERSION_SQL: &str = r#"
CREATE UNIQUE INDEX IF NOT EXISTS uniq_css_case_delivery_policy_versions_name_version
ON css_case_delivery_policy_versions(policy_name, version)
"#;

pub const CREATE_INDEX_CSS_CASE_DELIVERY_POLICY_VERSIONS_IS_ACTIVE_SQL: &str = r#"
CREATE INDEX IF NOT EXISTS idx_css_case_delivery_policy_versions_is_active
ON css_case_delivery_policy_versions(is_active)
"#;

pub const CREATE_INDEX_CSS_CASE_DELIVERY_POLICY_VERSIONS_CREATED_AT_SQL: &str = r#"
CREATE INDEX IF NOT EXISTS idx_css_case_delivery_policy_versions_created_at
ON css_case_delivery_policy_versions(created_at)
"#;

pub const CREATE_INDEX_CSS_CASE_DELIVERY_POLICY_VERSIONS_ACTIVATED_AT_SQL: &str = r#"
CREATE INDEX IF NOT EXISTS idx_css_case_delivery_policy_versions_activated_at
ON css_case_delivery_policy_versions(activated_at)
"#;

pub async fn insert_delivery_policy_version(
    pool: &sqlx::PgPool,
    record: &DeliveryPolicyVersionRecord,
) -> anyhow::Result<()> {
    let config_json = serde_json::to_value(&record.config)?;

    sqlx::query(
        r#"
        INSERT INTO css_case_delivery_policy_versions (
            policy_version_id, policy_name, version, config_json, is_active, created_at, activated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        "#,
    )
    .bind(&record.policy_version_id)
    .bind(&record.policy_name)
    .bind(record.version)
    .bind(config_json)
    .bind(record.is_active)
    .bind(&record.created_at)
    .bind(&record.activated_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_delivery_policy_version(
    pool: &sqlx::PgPool,
    policy_version_id: &str,
) -> anyhow::Result<Option<DeliveryPolicyVersionRecord>> {
    let row = sqlx::query(
        r#"
        SELECT policy_version_id, policy_name, version, config_json, is_active,
               created_at::text AS created_at, activated_at::text AS activated_at
        FROM css_case_delivery_policy_versions
        WHERE policy_version_id = $1
        "#,
    )
    .bind(policy_version_id)
    .fetch_optional(pool)
    .await?;

    row.map(row_to_version_record).transpose()
}

pub async fn list_delivery_policy_versions(
    pool: &sqlx::PgPool,
) -> anyhow::Result<Vec<DeliveryPolicyVersionRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT policy_version_id, policy_name, version, config_json, is_active,
               created_at::text AS created_at, activated_at::text AS activated_at
        FROM css_case_delivery_policy_versions
        ORDER BY created_at DESC, policy_version_id DESC
        "#,
    )
    .fetch_all(pool)
    .await?;

    rows.into_iter().map(row_to_version_record).collect()
}

pub async fn list_delivery_policy_versions_by_name(
    pool: &sqlx::PgPool,
    policy_name: &str,
) -> anyhow::Result<Vec<DeliveryPolicyVersionRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT policy_version_id, policy_name, version, config_json, is_active,
               created_at::text AS created_at, activated_at::text AS activated_at
        FROM css_case_delivery_policy_versions
        WHERE policy_name = $1
        ORDER BY version DESC, created_at DESC
        "#,
    )
    .bind(policy_name)
    .fetch_all(pool)
    .await?;

    rows.into_iter().map(row_to_version_record).collect()
}

pub async fn get_active_delivery_policy_version(
    pool: &sqlx::PgPool,
) -> anyhow::Result<Option<DeliveryPolicyVersionRecord>> {
    let row = sqlx::query(
        r#"
        SELECT policy_version_id, policy_name, version, config_json, is_active,
               created_at::text AS created_at, activated_at::text AS activated_at
        FROM css_case_delivery_policy_versions
        WHERE is_active = true
        ORDER BY activated_at DESC NULLS LAST, created_at DESC
        LIMIT 1
        "#,
    )
    .fetch_optional(pool)
    .await?;

    row.map(row_to_version_record).transpose()
}

pub async fn deactivate_all_delivery_policy_versions(pool: &sqlx::PgPool) -> anyhow::Result<()> {
    sqlx::query(
        "UPDATE css_case_delivery_policy_versions SET is_active = false WHERE is_active = true",
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn activate_delivery_policy_version(
    pool: &sqlx::PgPool,
    policy_version_id: &str,
    now_rfc3339: &str,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        UPDATE css_case_delivery_policy_versions
        SET is_active = true, activated_at = $2
        WHERE policy_version_id = $1
        "#,
    )
    .bind(policy_version_id)
    .bind(now_rfc3339)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_latest_delivery_policy_version_number(
    pool: &sqlx::PgPool,
    policy_name: &str,
) -> anyhow::Result<Option<i64>> {
    let row = sqlx::query(
        r#"
        SELECT MAX(version) AS version
        FROM css_case_delivery_policy_versions
        WHERE policy_name = $1
        "#,
    )
    .bind(policy_name)
    .fetch_one(pool)
    .await?;

    row.try_get("version").map_err(Into::into)
}

fn row_to_version_record(
    row: sqlx::postgres::PgRow,
) -> anyhow::Result<DeliveryPolicyVersionRecord> {
    let config_json: serde_json::Value = row.try_get("config_json")?;
    Ok(DeliveryPolicyVersionRecord {
        policy_version_id: row.try_get("policy_version_id")?,
        policy_name: row.try_get("policy_name")?,
        version: row.try_get("version")?,
        config: serde_json::from_value(config_json)?,
        is_active: row.try_get("is_active")?,
        created_at: row.try_get("created_at")?,
        activated_at: row.try_get("activated_at")?,
        created_by: None,
    })
}
