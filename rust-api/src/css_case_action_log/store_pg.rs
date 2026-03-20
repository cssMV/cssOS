use crate::css_case_action_log::types::{
    CaseActionLogKind, CaseActionLogSubjectKind, CssCaseActionLogRecord,
};
use sqlx::Row;

pub const CREATE_CSS_CASE_ACTION_LOGS_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_case_action_logs (
    log_id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    subject_kind TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_user_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    accepted BOOLEAN NOT NULL,
    result_message TEXT NOT NULL,
    review_id TEXT,
    created_at TIMESTAMP NOT NULL
)
"#;

pub async fn insert_action_log(
    pool: &sqlx::PgPool,
    record: &CssCaseActionLogRecord,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO css_case_action_logs (
            log_id, case_id, subject_kind, subject_id, action, actor_user_id, reason,
            accepted, result_message, review_id, created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        "#,
    )
    .bind(&record.log_id)
    .bind(subject_kind_to_db(&record.subject_kind))
    .bind(&record.case_id)
    .bind(&record.subject_id)
    .bind(action_to_db(&record.action))
    .bind(&record.actor_user_id)
    .bind(&record.reason)
    .bind(record.accepted)
    .bind(&record.result_message)
    .bind(&record.review_id)
    .bind(&record.created_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_action_log(
    pool: &sqlx::PgPool,
    log_id: &str,
) -> anyhow::Result<CssCaseActionLogRecord> {
    let row = sqlx::query(
        r#"
        SELECT log_id, case_id, subject_kind, subject_id, action, actor_user_id, reason,
               accepted, result_message, review_id, created_at::text AS created_at
        FROM css_case_action_logs
        WHERE log_id = $1
        "#,
    )
    .bind(log_id)
    .fetch_one(pool)
    .await?;
    row_to_action_log(row)
}

pub async fn list_action_logs_for_case(
    pool: &sqlx::PgPool,
    case_id: &str,
) -> anyhow::Result<Vec<CssCaseActionLogRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT log_id, case_id, subject_kind, subject_id, action, actor_user_id, reason,
               accepted, result_message, review_id, created_at::text AS created_at
        FROM css_case_action_logs
        WHERE case_id = $1
        ORDER BY created_at ASC
        "#,
    )
    .bind(case_id)
    .fetch_all(pool)
    .await?;
    rows.into_iter().map(row_to_action_log).collect()
}

pub async fn list_action_logs_for_subject(
    pool: &sqlx::PgPool,
    subject_kind: &CaseActionLogSubjectKind,
    subject_id: &str,
) -> anyhow::Result<Vec<CssCaseActionLogRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT log_id, case_id, subject_kind, subject_id, action, actor_user_id, reason,
               accepted, result_message, review_id, created_at::text AS created_at
        FROM css_case_action_logs
        WHERE subject_kind = $1 AND subject_id = $2
        ORDER BY created_at ASC
        "#,
    )
    .bind(subject_kind_to_db(subject_kind))
    .bind(subject_id)
    .fetch_all(pool)
    .await?;
    rows.into_iter().map(row_to_action_log).collect()
}

pub async fn list_action_logs_for_actor(
    pool: &sqlx::PgPool,
    actor_user_id: &str,
) -> anyhow::Result<Vec<CssCaseActionLogRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT log_id, case_id, subject_kind, subject_id, action, actor_user_id, reason,
               accepted, result_message, review_id, created_at::text AS created_at
        FROM css_case_action_logs
        WHERE actor_user_id = $1
        ORDER BY created_at ASC
        "#,
    )
    .bind(actor_user_id)
    .fetch_all(pool)
    .await?;
    rows.into_iter().map(row_to_action_log).collect()
}

pub async fn list_all_action_logs(
    pool: &sqlx::PgPool,
) -> anyhow::Result<Vec<CssCaseActionLogRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT log_id, case_id, subject_kind, subject_id, action, actor_user_id, reason,
               accepted, result_message, review_id, created_at::text AS created_at
        FROM css_case_action_logs
        ORDER BY created_at ASC
        "#,
    )
    .fetch_all(pool)
    .await?;
    rows.into_iter().map(row_to_action_log).collect()
}

fn subject_kind_to_db(kind: &CaseActionLogSubjectKind) -> &'static str {
    match kind {
        CaseActionLogSubjectKind::User => "user",
        CaseActionLogSubjectKind::Catalog => "catalog",
        CaseActionLogSubjectKind::Deal => "deal",
        CaseActionLogSubjectKind::Ownership => "ownership",
    }
}

fn subject_kind_from_db(value: &str) -> anyhow::Result<CaseActionLogSubjectKind> {
    match value {
        "user" => Ok(CaseActionLogSubjectKind::User),
        "catalog" => Ok(CaseActionLogSubjectKind::Catalog),
        "deal" => Ok(CaseActionLogSubjectKind::Deal),
        "ownership" => Ok(CaseActionLogSubjectKind::Ownership),
        other => anyhow::bail!("unknown case action log subject kind: {other}"),
    }
}

fn action_to_db(action: &CaseActionLogKind) -> &'static str {
    match action {
        CaseActionLogKind::Approve => "approve",
        CaseActionLogKind::Reject => "reject",
        CaseActionLogKind::Freeze => "freeze",
        CaseActionLogKind::Escalate => "escalate",
        CaseActionLogKind::Release => "release",
        CaseActionLogKind::RequireReview => "require_review",
    }
}

fn action_from_db(value: &str) -> anyhow::Result<CaseActionLogKind> {
    match value {
        "approve" => Ok(CaseActionLogKind::Approve),
        "reject" => Ok(CaseActionLogKind::Reject),
        "freeze" => Ok(CaseActionLogKind::Freeze),
        "escalate" => Ok(CaseActionLogKind::Escalate),
        "release" => Ok(CaseActionLogKind::Release),
        "require_review" => Ok(CaseActionLogKind::RequireReview),
        other => anyhow::bail!("unknown case action log action kind: {other}"),
    }
}

fn row_to_action_log(row: sqlx::postgres::PgRow) -> anyhow::Result<CssCaseActionLogRecord> {
    Ok(CssCaseActionLogRecord {
        log_id: row.try_get("log_id")?,
        case_id: row.try_get("case_id")?,
        subject_kind: subject_kind_from_db(&row.try_get::<String, _>("subject_kind")?)?,
        subject_id: row.try_get("subject_id")?,
        action: action_from_db(&row.try_get::<String, _>("action")?)?,
        actor_user_id: row.try_get("actor_user_id")?,
        reason: row.try_get("reason")?,
        accepted: row.try_get("accepted")?,
        result_message: row.try_get("result_message")?,
        review_id: row.try_get("review_id")?,
        created_at: row.try_get("created_at")?,
    })
}
