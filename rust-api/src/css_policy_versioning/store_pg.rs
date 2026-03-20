use crate::css_policy_versioning::types::{
    CssPolicyVersion, PolicyBinding, PolicyBindingSubjectKind,
};
use sqlx::Row;

pub const CREATE_CSS_POLICY_VERSIONS_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_policy_versions (
    version_id TEXT PRIMARY KEY,
    version_name TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    policy_bundle_json JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT now()
)
"#;

pub const CREATE_CSS_POLICY_BINDINGS_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_policy_bindings (
    binding_id TEXT PRIMARY KEY,
    subject_kind TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    version_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
)
"#;

pub async fn insert_policy_version(
    pool: &sqlx::PgPool,
    version: &CssPolicyVersion,
) -> anyhow::Result<()> {
    let bundle = serde_json::to_value(&version.policy_bundle)?;
    sqlx::query(
        r#"
        INSERT INTO css_policy_versions (
            version_id, version_name, is_default, policy_bundle_json, created_at
        )
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (version_id) DO UPDATE
        SET version_name = EXCLUDED.version_name,
            is_default = EXCLUDED.is_default,
            policy_bundle_json = EXCLUDED.policy_bundle_json
        "#,
    )
    .bind(&version.version_id)
    .bind(&version.version_name)
    .bind(version.is_default)
    .bind(bundle)
    .bind(&version.created_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_policy_version(
    pool: &sqlx::PgPool,
    version_id: &str,
) -> anyhow::Result<CssPolicyVersion> {
    let row = sqlx::query(
        r#"
        SELECT version_id, version_name, is_default, policy_bundle_json, created_at::text AS created_at
        FROM css_policy_versions
        WHERE version_id = $1
        "#,
    )
    .bind(version_id)
    .fetch_one(pool)
    .await?;
    row_to_policy_version(row)
}

pub async fn get_default_policy_version(pool: &sqlx::PgPool) -> anyhow::Result<CssPolicyVersion> {
    let row = sqlx::query(
        r#"
        SELECT version_id, version_name, is_default, policy_bundle_json, created_at::text AS created_at
        FROM css_policy_versions
        WHERE is_default = TRUE
        ORDER BY created_at DESC
        LIMIT 1
        "#,
    )
    .fetch_optional(pool)
    .await?;

    match row {
        Some(row) => row_to_policy_version(row),
        None => anyhow::bail!("default css policy version not found"),
    }
}

pub async fn set_default_policy_version(
    pool: &sqlx::PgPool,
    version_id: &str,
) -> anyhow::Result<()> {
    sqlx::query("UPDATE css_policy_versions SET is_default = FALSE WHERE is_default = TRUE")
        .execute(pool)
        .await?;
    sqlx::query("UPDATE css_policy_versions SET is_default = TRUE WHERE version_id = $1")
        .bind(version_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn insert_policy_binding(
    pool: &sqlx::PgPool,
    binding: &PolicyBinding,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO css_policy_bindings (
            binding_id, subject_kind, subject_id, version_id, created_at
        )
        VALUES ($1,$2,$3,$4,$5)
        "#,
    )
    .bind(&binding.binding_id)
    .bind(subject_kind_to_db(&binding.subject_kind))
    .bind(&binding.subject_id)
    .bind(&binding.version_id)
    .bind(&binding.created_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_policy_binding(
    pool: &sqlx::PgPool,
    subject_kind: &PolicyBindingSubjectKind,
    subject_id: &str,
) -> anyhow::Result<Option<PolicyBinding>> {
    let row = sqlx::query(
        r#"
        SELECT binding_id, subject_kind, subject_id, version_id, created_at::text AS created_at
        FROM css_policy_bindings
        WHERE subject_kind = $1 AND subject_id = $2
        ORDER BY created_at DESC
        LIMIT 1
        "#,
    )
    .bind(subject_kind_to_db(subject_kind))
    .bind(subject_id)
    .fetch_optional(pool)
    .await?;

    row.map(row_to_policy_binding).transpose()
}

fn subject_kind_to_db(kind: &PolicyBindingSubjectKind) -> &'static str {
    match kind {
        PolicyBindingSubjectKind::Catalog => "catalog",
        PolicyBindingSubjectKind::Auction => "auction",
        PolicyBindingSubjectKind::Deal => "deal",
        PolicyBindingSubjectKind::Ownership => "ownership",
        PolicyBindingSubjectKind::UserFlow => "user_flow",
    }
}

fn subject_kind_from_db(value: &str) -> anyhow::Result<PolicyBindingSubjectKind> {
    match value {
        "catalog" => Ok(PolicyBindingSubjectKind::Catalog),
        "auction" => Ok(PolicyBindingSubjectKind::Auction),
        "deal" => Ok(PolicyBindingSubjectKind::Deal),
        "ownership" => Ok(PolicyBindingSubjectKind::Ownership),
        "user_flow" => Ok(PolicyBindingSubjectKind::UserFlow),
        other => anyhow::bail!("unknown policy binding subject kind: {other}"),
    }
}

fn row_to_policy_version(row: sqlx::postgres::PgRow) -> anyhow::Result<CssPolicyVersion> {
    let bundle_value: serde_json::Value = row.try_get("policy_bundle_json")?;
    Ok(CssPolicyVersion {
        version_id: row.try_get("version_id")?,
        version_name: row.try_get("version_name")?,
        is_default: row.try_get("is_default")?,
        policy_bundle: serde_json::from_value(bundle_value)?,
        created_at: row.try_get("created_at")?,
    })
}

fn row_to_policy_binding(row: sqlx::postgres::PgRow) -> anyhow::Result<PolicyBinding> {
    Ok(PolicyBinding {
        binding_id: row.try_get("binding_id")?,
        subject_kind: subject_kind_from_db(&row.try_get::<String, _>("subject_kind")?)?,
        subject_id: row.try_get("subject_id")?,
        version_id: row.try_get("version_id")?,
        created_at: row.try_get("created_at")?,
    })
}
