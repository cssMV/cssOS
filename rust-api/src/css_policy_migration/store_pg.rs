use crate::css_policy_migration::types::{
    MigrationSubjectKind, PolicyMigrationRecord, PolicyMigrationStatus,
};
use sqlx::Row;

pub const CREATE_CSS_POLICY_MIGRATIONS_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_policy_migrations (
    migration_id TEXT PRIMARY KEY,
    subject_kind TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    from_version_id TEXT NOT NULL,
    to_version_id TEXT NOT NULL,
    status TEXT NOT NULL,
    reason TEXT NOT NULL,
    requested_by_user_id TEXT,
    created_at TIMESTAMP DEFAULT now()
)
"#;

pub async fn insert_policy_migration(
    pool: &sqlx::PgPool,
    record: &PolicyMigrationRecord,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO css_policy_migrations (
            migration_id, subject_kind, subject_id, from_version_id, to_version_id,
            status, reason, requested_by_user_id, created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        "#,
    )
    .bind(&record.migration_id)
    .bind(subject_kind_to_db(&record.subject_kind))
    .bind(&record.subject_id)
    .bind(&record.from_version_id)
    .bind(&record.to_version_id)
    .bind(status_to_db(&record.status))
    .bind(&record.reason)
    .bind(&record.requested_by_user_id)
    .bind(&record.created_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn update_policy_migration_status(
    pool: &sqlx::PgPool,
    migration_id: &str,
    status: PolicyMigrationStatus,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        UPDATE css_policy_migrations
        SET status = $2
        WHERE migration_id = $1
        "#,
    )
    .bind(migration_id)
    .bind(status_to_db(&status))
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_policy_migration(
    pool: &sqlx::PgPool,
    migration_id: &str,
) -> anyhow::Result<PolicyMigrationRecord> {
    let row = sqlx::query(
        r#"
        SELECT migration_id, subject_kind, subject_id, from_version_id, to_version_id,
               status, reason, requested_by_user_id, created_at::text AS created_at
        FROM css_policy_migrations
        WHERE migration_id = $1
        "#,
    )
    .bind(migration_id)
    .fetch_one(pool)
    .await?;
    row_to_policy_migration(row)
}

pub async fn list_policy_migrations_for_subject(
    pool: &sqlx::PgPool,
    subject_kind: &MigrationSubjectKind,
    subject_id: &str,
) -> anyhow::Result<Vec<PolicyMigrationRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT migration_id, subject_kind, subject_id, from_version_id, to_version_id,
               status, reason, requested_by_user_id, created_at::text AS created_at
        FROM css_policy_migrations
        WHERE subject_kind = $1 AND subject_id = $2
        ORDER BY created_at DESC
        "#,
    )
    .bind(subject_kind_to_db(subject_kind))
    .bind(subject_id)
    .fetch_all(pool)
    .await?;

    rows.into_iter().map(row_to_policy_migration).collect()
}

fn subject_kind_to_db(kind: &MigrationSubjectKind) -> &'static str {
    match kind {
        MigrationSubjectKind::Catalog => "catalog",
        MigrationSubjectKind::Auction => "auction",
        MigrationSubjectKind::Deal => "deal",
        MigrationSubjectKind::Ownership => "ownership",
        MigrationSubjectKind::UserFlow => "user_flow",
    }
}

fn subject_kind_from_db(value: &str) -> anyhow::Result<MigrationSubjectKind> {
    match value {
        "catalog" => Ok(MigrationSubjectKind::Catalog),
        "auction" => Ok(MigrationSubjectKind::Auction),
        "deal" => Ok(MigrationSubjectKind::Deal),
        "ownership" => Ok(MigrationSubjectKind::Ownership),
        "user_flow" => Ok(MigrationSubjectKind::UserFlow),
        other => anyhow::bail!("unknown policy migration subject kind: {other}"),
    }
}

fn status_to_db(status: &PolicyMigrationStatus) -> &'static str {
    match status {
        PolicyMigrationStatus::Planned => "planned",
        PolicyMigrationStatus::DryRunPassed => "dry_run_passed",
        PolicyMigrationStatus::DryRunBlocked => "dry_run_blocked",
        PolicyMigrationStatus::Applied => "applied",
        PolicyMigrationStatus::Rejected => "rejected",
    }
}

fn status_from_db(value: &str) -> anyhow::Result<PolicyMigrationStatus> {
    match value {
        "planned" => Ok(PolicyMigrationStatus::Planned),
        "dry_run_passed" => Ok(PolicyMigrationStatus::DryRunPassed),
        "dry_run_blocked" => Ok(PolicyMigrationStatus::DryRunBlocked),
        "applied" => Ok(PolicyMigrationStatus::Applied),
        "rejected" => Ok(PolicyMigrationStatus::Rejected),
        other => anyhow::bail!("unknown policy migration status: {other}"),
    }
}

fn row_to_policy_migration(row: sqlx::postgres::PgRow) -> anyhow::Result<PolicyMigrationRecord> {
    Ok(PolicyMigrationRecord {
        migration_id: row.try_get("migration_id")?,
        subject_kind: subject_kind_from_db(&row.try_get::<String, _>("subject_kind")?)?,
        subject_id: row.try_get("subject_id")?,
        from_version_id: row.try_get("from_version_id")?,
        to_version_id: row.try_get("to_version_id")?,
        status: status_from_db(&row.try_get::<String, _>("status")?)?,
        reason: row.try_get("reason")?,
        requested_by_user_id: row.try_get("requested_by_user_id")?,
        created_at: row.try_get("created_at")?,
    })
}
