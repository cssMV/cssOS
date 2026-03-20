use crate::css_resolution_log::types::{
    CssResolutionLogRecord, ResolutionLogDecisionKind, ResolutionLogStatus,
    ResolutionLogSubjectKind,
};
use sqlx::Row;

pub const CREATE_CSS_RESOLUTION_LOGS_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_resolution_logs (
    log_id TEXT PRIMARY KEY,
    resolution_id TEXT NOT NULL,
    case_id TEXT NOT NULL,
    subject_kind TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    decision TEXT NOT NULL,
    status TEXT NOT NULL,
    actor_user_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    is_closed_like BOOLEAN NOT NULL,
    review_id TEXT,
    created_at TIMESTAMP NOT NULL
)
"#;

pub async fn insert_resolution_log(
    pool: &sqlx::PgPool,
    record: &CssResolutionLogRecord,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO css_resolution_logs (
            log_id, resolution_id, case_id, subject_kind, subject_id, decision, status,
            actor_user_id, reason, is_closed_like, review_id, created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        "#,
    )
    .bind(&record.log_id)
    .bind(&record.resolution_id)
    .bind(&record.case_id)
    .bind(subject_kind_to_db(&record.subject_kind))
    .bind(&record.subject_id)
    .bind(decision_to_db(&record.decision))
    .bind(status_to_db(&record.status))
    .bind(&record.actor_user_id)
    .bind(&record.reason)
    .bind(record.is_closed_like)
    .bind(&record.review_id)
    .bind(&record.created_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_resolution_log(
    pool: &sqlx::PgPool,
    log_id: &str,
) -> anyhow::Result<CssResolutionLogRecord> {
    let row = sqlx::query(
        r#"
        SELECT log_id, resolution_id, case_id, subject_kind, subject_id, decision, status,
               actor_user_id, reason, is_closed_like, review_id, created_at::text AS created_at
        FROM css_resolution_logs
        WHERE log_id = $1
        "#,
    )
    .bind(log_id)
    .fetch_one(pool)
    .await?;
    row_to_resolution_log(row)
}

pub async fn list_resolution_logs_for_case(
    pool: &sqlx::PgPool,
    case_id: &str,
) -> anyhow::Result<Vec<CssResolutionLogRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT log_id, resolution_id, case_id, subject_kind, subject_id, decision, status,
               actor_user_id, reason, is_closed_like, review_id, created_at::text AS created_at
        FROM css_resolution_logs
        WHERE case_id = $1
        ORDER BY created_at ASC
        "#,
    )
    .bind(case_id)
    .fetch_all(pool)
    .await?;
    rows.into_iter().map(row_to_resolution_log).collect()
}

pub async fn list_resolution_logs_for_subject(
    pool: &sqlx::PgPool,
    subject_kind: &ResolutionLogSubjectKind,
    subject_id: &str,
) -> anyhow::Result<Vec<CssResolutionLogRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT log_id, resolution_id, case_id, subject_kind, subject_id, decision, status,
               actor_user_id, reason, is_closed_like, review_id, created_at::text AS created_at
        FROM css_resolution_logs
        WHERE subject_kind = $1 AND subject_id = $2
        ORDER BY created_at ASC
        "#,
    )
    .bind(subject_kind_to_db(subject_kind))
    .bind(subject_id)
    .fetch_all(pool)
    .await?;
    rows.into_iter().map(row_to_resolution_log).collect()
}

pub async fn list_resolution_logs_for_review(
    pool: &sqlx::PgPool,
    review_id: &str,
) -> anyhow::Result<Vec<CssResolutionLogRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT log_id, resolution_id, case_id, subject_kind, subject_id, decision, status,
               actor_user_id, reason, is_closed_like, review_id, created_at::text AS created_at
        FROM css_resolution_logs
        WHERE review_id = $1
        ORDER BY created_at ASC
        "#,
    )
    .bind(review_id)
    .fetch_all(pool)
    .await?;
    rows.into_iter().map(row_to_resolution_log).collect()
}

pub async fn get_latest_resolution_for_case(
    pool: &sqlx::PgPool,
    case_id: &str,
) -> anyhow::Result<Option<CssResolutionLogRecord>> {
    let row = sqlx::query(
        r#"
        SELECT log_id, resolution_id, case_id, subject_kind, subject_id, decision, status,
               actor_user_id, reason, is_closed_like, review_id, created_at::text AS created_at
        FROM css_resolution_logs
        WHERE case_id = $1
        ORDER BY created_at DESC, log_id DESC
        LIMIT 1
        "#,
    )
    .bind(case_id)
    .fetch_optional(pool)
    .await?;

    row.map(row_to_resolution_log).transpose()
}

pub async fn list_latest_resolution_logs(
    pool: &sqlx::PgPool,
) -> anyhow::Result<Vec<CssResolutionLogRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT DISTINCT ON (case_id)
               log_id, resolution_id, case_id, subject_kind, subject_id, decision, status,
               actor_user_id, reason, is_closed_like, review_id, created_at::text AS created_at
        FROM css_resolution_logs
        ORDER BY case_id, created_at DESC, log_id DESC
        "#,
    )
    .fetch_all(pool)
    .await?;

    rows.into_iter().map(row_to_resolution_log).collect()
}

pub async fn list_all_resolution_logs(
    pool: &sqlx::PgPool,
) -> anyhow::Result<Vec<CssResolutionLogRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT log_id, resolution_id, case_id, subject_kind, subject_id, decision, status,
               actor_user_id, reason, is_closed_like, review_id, created_at::text AS created_at
        FROM css_resolution_logs
        ORDER BY created_at ASC
        "#,
    )
    .fetch_all(pool)
    .await?;

    rows.into_iter().map(row_to_resolution_log).collect()
}

fn subject_kind_to_db(kind: &ResolutionLogSubjectKind) -> &'static str {
    match kind {
        ResolutionLogSubjectKind::User => "user",
        ResolutionLogSubjectKind::Catalog => "catalog",
        ResolutionLogSubjectKind::Deal => "deal",
        ResolutionLogSubjectKind::Ownership => "ownership",
    }
}

fn subject_kind_from_db(value: &str) -> anyhow::Result<ResolutionLogSubjectKind> {
    match value {
        "user" => Ok(ResolutionLogSubjectKind::User),
        "catalog" => Ok(ResolutionLogSubjectKind::Catalog),
        "deal" => Ok(ResolutionLogSubjectKind::Deal),
        "ownership" => Ok(ResolutionLogSubjectKind::Ownership),
        other => anyhow::bail!("unknown resolution log subject kind: {other}"),
    }
}

fn decision_to_db(kind: &ResolutionLogDecisionKind) -> &'static str {
    match kind {
        ResolutionLogDecisionKind::Resolve => "resolve",
        ResolutionLogDecisionKind::Dismiss => "dismiss",
        ResolutionLogDecisionKind::Release => "release",
        ResolutionLogDecisionKind::EscalateToManual => "escalate_to_manual",
        ResolutionLogDecisionKind::FreezeUntilReview => "freeze_until_review",
    }
}

fn decision_from_db(value: &str) -> anyhow::Result<ResolutionLogDecisionKind> {
    match value {
        "resolve" => Ok(ResolutionLogDecisionKind::Resolve),
        "dismiss" => Ok(ResolutionLogDecisionKind::Dismiss),
        "release" => Ok(ResolutionLogDecisionKind::Release),
        "escalate_to_manual" => Ok(ResolutionLogDecisionKind::EscalateToManual),
        "freeze_until_review" => Ok(ResolutionLogDecisionKind::FreezeUntilReview),
        other => anyhow::bail!("unknown resolution log decision kind: {other}"),
    }
}

fn status_to_db(status: &ResolutionLogStatus) -> &'static str {
    match status {
        ResolutionLogStatus::Open => "open",
        ResolutionLogStatus::Resolved => "resolved",
        ResolutionLogStatus::Dismissed => "dismissed",
        ResolutionLogStatus::Released => "released",
        ResolutionLogStatus::EscalatedToManual => "escalated_to_manual",
        ResolutionLogStatus::FrozenUntilReview => "frozen_until_review",
    }
}

fn status_from_db(value: &str) -> anyhow::Result<ResolutionLogStatus> {
    match value {
        "open" => Ok(ResolutionLogStatus::Open),
        "resolved" => Ok(ResolutionLogStatus::Resolved),
        "dismissed" => Ok(ResolutionLogStatus::Dismissed),
        "released" => Ok(ResolutionLogStatus::Released),
        "escalated_to_manual" => Ok(ResolutionLogStatus::EscalatedToManual),
        "frozen_until_review" => Ok(ResolutionLogStatus::FrozenUntilReview),
        other => anyhow::bail!("unknown resolution log status: {other}"),
    }
}

fn row_to_resolution_log(row: sqlx::postgres::PgRow) -> anyhow::Result<CssResolutionLogRecord> {
    Ok(CssResolutionLogRecord {
        log_id: row.try_get("log_id")?,
        resolution_id: row.try_get("resolution_id")?,
        case_id: row.try_get("case_id")?,
        subject_kind: subject_kind_from_db(&row.try_get::<String, _>("subject_kind")?)?,
        subject_id: row.try_get("subject_id")?,
        decision: decision_from_db(&row.try_get::<String, _>("decision")?)?,
        status: status_from_db(&row.try_get::<String, _>("status")?)?,
        actor_user_id: row.try_get("actor_user_id")?,
        reason: row.try_get("reason")?,
        is_closed_like: row.try_get("is_closed_like")?,
        review_id: row.try_get("review_id")?,
        created_at: row.try_get("created_at")?,
    })
}
