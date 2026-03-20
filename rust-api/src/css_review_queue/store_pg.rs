use crate::css_review_queue::types::{
    CssReviewItem, ReviewDecision, ReviewDecisionKind, ReviewPriority, ReviewStatus,
    ReviewSubjectKind,
};
use sqlx::Row;

pub const CREATE_CSS_REVIEW_ITEMS_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_review_items (
    review_id TEXT PRIMARY KEY,
    subject_kind TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    priority TEXT NOT NULL,
    status TEXT NOT NULL,
    source_action TEXT NOT NULL,
    source_code TEXT NOT NULL,
    reason TEXT NOT NULL,
    actor_user_id TEXT,
    assigned_reviewer_id TEXT,
    created_at TIMESTAMP DEFAULT now()
)
"#;

pub const CREATE_CSS_REVIEW_DECISIONS_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_review_decisions (
    decision_id TEXT PRIMARY KEY,
    review_id TEXT NOT NULL,
    decision TEXT NOT NULL,
    comment TEXT NOT NULL,
    reviewer_user_id TEXT NOT NULL,
    decided_at TIMESTAMP NOT NULL
)
"#;

pub async fn insert_review_item(pool: &sqlx::PgPool, item: &CssReviewItem) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO css_review_items (
            review_id, subject_kind, subject_id, priority, status, source_action, source_code,
            reason, actor_user_id, assigned_reviewer_id, created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        "#,
    )
    .bind(&item.review_id)
    .bind(subject_kind_to_db(&item.subject_kind))
    .bind(&item.subject_id)
    .bind(priority_to_db(&item.priority))
    .bind(status_to_db(&item.status))
    .bind(&item.source_action)
    .bind(&item.source_code)
    .bind(&item.reason)
    .bind(&item.actor_user_id)
    .bind(&item.assigned_reviewer_id)
    .bind(&item.created_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_review_item(
    pool: &sqlx::PgPool,
    review_id: &str,
) -> anyhow::Result<CssReviewItem> {
    let row = sqlx::query(
        r#"
        SELECT review_id, subject_kind, subject_id, priority, status, source_action, source_code,
               reason, actor_user_id, assigned_reviewer_id, created_at::text AS created_at
        FROM css_review_items
        WHERE review_id = $1
        "#,
    )
    .bind(review_id)
    .fetch_one(pool)
    .await?;
    row_to_review_item(row)
}

pub async fn list_open_reviews(pool: &sqlx::PgPool) -> anyhow::Result<Vec<CssReviewItem>> {
    let rows = sqlx::query(
        r#"
        SELECT review_id, subject_kind, subject_id, priority, status, source_action, source_code,
               reason, actor_user_id, assigned_reviewer_id, created_at::text AS created_at
        FROM css_review_items
        WHERE status IN ('open', 'assigned', 'in_review', 'escalated')
        ORDER BY created_at ASC
        "#,
    )
    .fetch_all(pool)
    .await?;
    rows.into_iter().map(row_to_review_item).collect()
}

pub async fn assign_review_item(
    pool: &sqlx::PgPool,
    review_id: &str,
    reviewer_user_id: &str,
) -> anyhow::Result<()> {
    sqlx::query("UPDATE css_review_items SET assigned_reviewer_id = $2 WHERE review_id = $1")
        .bind(review_id)
        .bind(reviewer_user_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_review_status(
    pool: &sqlx::PgPool,
    review_id: &str,
    status: ReviewStatus,
) -> anyhow::Result<()> {
    sqlx::query("UPDATE css_review_items SET status = $2 WHERE review_id = $1")
        .bind(review_id)
        .bind(status_to_db(&status))
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn insert_review_decision(
    pool: &sqlx::PgPool,
    decision: &ReviewDecision,
) -> anyhow::Result<()> {
    let decision_id = format!("rdec_{}", uuid::Uuid::new_v4());
    sqlx::query(
        r#"
        INSERT INTO css_review_decisions (
            decision_id, review_id, decision, comment, reviewer_user_id, decided_at
        )
        VALUES ($1,$2,$3,$4,$5,$6)
        "#,
    )
    .bind(decision_id)
    .bind(&decision.review_id)
    .bind(decision_kind_to_db(&decision.decision))
    .bind(&decision.comment)
    .bind(&decision.reviewer_user_id)
    .bind(&decision.decided_at)
    .execute(pool)
    .await?;
    Ok(())
}

fn subject_kind_to_db(kind: &ReviewSubjectKind) -> &'static str {
    match kind {
        ReviewSubjectKind::User => "user",
        ReviewSubjectKind::Catalog => "catalog",
        ReviewSubjectKind::Auction => "auction",
        ReviewSubjectKind::Deal => "deal",
        ReviewSubjectKind::Ownership => "ownership",
    }
}

fn subject_kind_from_db(value: &str) -> anyhow::Result<ReviewSubjectKind> {
    match value {
        "user" => Ok(ReviewSubjectKind::User),
        "catalog" => Ok(ReviewSubjectKind::Catalog),
        "auction" => Ok(ReviewSubjectKind::Auction),
        "deal" => Ok(ReviewSubjectKind::Deal),
        "ownership" => Ok(ReviewSubjectKind::Ownership),
        other => anyhow::bail!("unknown review subject kind: {other}"),
    }
}

fn priority_to_db(priority: &ReviewPriority) -> &'static str {
    match priority {
        ReviewPriority::Low => "low",
        ReviewPriority::Normal => "normal",
        ReviewPriority::High => "high",
        ReviewPriority::Critical => "critical",
    }
}

fn priority_from_db(value: &str) -> anyhow::Result<ReviewPriority> {
    match value {
        "low" => Ok(ReviewPriority::Low),
        "normal" => Ok(ReviewPriority::Normal),
        "high" => Ok(ReviewPriority::High),
        "critical" => Ok(ReviewPriority::Critical),
        other => anyhow::bail!("unknown review priority: {other}"),
    }
}

fn status_to_db(status: &ReviewStatus) -> &'static str {
    match status {
        ReviewStatus::Open => "open",
        ReviewStatus::Assigned => "assigned",
        ReviewStatus::InReview => "in_review",
        ReviewStatus::Approved => "approved",
        ReviewStatus::Rejected => "rejected",
        ReviewStatus::Escalated => "escalated",
        ReviewStatus::Closed => "closed",
    }
}

fn status_from_db(value: &str) -> anyhow::Result<ReviewStatus> {
    match value {
        "open" => Ok(ReviewStatus::Open),
        "assigned" => Ok(ReviewStatus::Assigned),
        "in_review" => Ok(ReviewStatus::InReview),
        "approved" => Ok(ReviewStatus::Approved),
        "rejected" => Ok(ReviewStatus::Rejected),
        "escalated" => Ok(ReviewStatus::Escalated),
        "closed" => Ok(ReviewStatus::Closed),
        other => anyhow::bail!("unknown review status: {other}"),
    }
}

fn decision_kind_to_db(kind: &ReviewDecisionKind) -> &'static str {
    match kind {
        ReviewDecisionKind::Approve => "approve",
        ReviewDecisionKind::Reject => "reject",
        ReviewDecisionKind::Freeze => "freeze",
        ReviewDecisionKind::Escalate => "escalate",
    }
}

fn row_to_review_item(row: sqlx::postgres::PgRow) -> anyhow::Result<CssReviewItem> {
    Ok(CssReviewItem {
        review_id: row.try_get("review_id")?,
        subject_kind: subject_kind_from_db(&row.try_get::<String, _>("subject_kind")?)?,
        subject_id: row.try_get("subject_id")?,
        priority: priority_from_db(&row.try_get::<String, _>("priority")?)?,
        status: status_from_db(&row.try_get::<String, _>("status")?)?,
        source_action: row.try_get("source_action")?,
        source_code: row.try_get("source_code")?,
        reason: row.try_get("reason")?,
        actor_user_id: row.try_get("actor_user_id")?,
        assigned_reviewer_id: row.try_get("assigned_reviewer_id")?,
        created_at: row.try_get("created_at")?,
    })
}
