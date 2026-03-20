use crate::css_governance_timeline::types::{
    CssCreditProfile, GovernanceTimelineEntry, TimelineEventKind, TimelineSubjectKind,
};
use sqlx::Row;

pub const CREATE_CSS_GOVERNANCE_TIMELINE_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_governance_timeline (
    timeline_id TEXT PRIMARY KEY,
    subject_kind TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    event_kind TEXT NOT NULL,
    source_system TEXT NOT NULL,
    source_id TEXT NOT NULL,
    message TEXT NOT NULL,
    actor_user_id TEXT,
    credit_score_before INTEGER,
    credit_score_after INTEGER,
    credit_delta INTEGER,
    created_at TIMESTAMP DEFAULT now()
)
"#;

pub const CREATE_CSS_CREDIT_PROFILES_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_credit_profiles (
    user_id TEXT PRIMARY KEY,
    score INTEGER NOT NULL,
    updated_at TIMESTAMP DEFAULT now()
)
"#;

pub async fn insert_timeline_entry(
    pool: &sqlx::PgPool,
    entry: &GovernanceTimelineEntry,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO css_governance_timeline (
            timeline_id,
            subject_kind,
            subject_id,
            event_kind,
            source_system,
            source_id,
            message,
            actor_user_id,
            credit_score_before,
            credit_score_after,
            credit_delta,
            created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        "#,
    )
    .bind(&entry.timeline_id)
    .bind(subject_kind_to_db(&entry.subject_kind))
    .bind(&entry.subject_id)
    .bind(event_kind_to_db(&entry.event_kind))
    .bind(&entry.source_system)
    .bind(&entry.source_id)
    .bind(&entry.message)
    .bind(&entry.actor_user_id)
    .bind(entry.credit_score_before)
    .bind(entry.credit_score_after)
    .bind(entry.credit_delta)
    .bind(&entry.created_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn list_timeline_for_subject(
    pool: &sqlx::PgPool,
    subject_kind: TimelineSubjectKind,
    subject_id: &str,
) -> anyhow::Result<Vec<GovernanceTimelineEntry>> {
    let rows = sqlx::query(
        r#"
        SELECT
            timeline_id,
            subject_kind,
            subject_id,
            event_kind,
            source_system,
            source_id,
            message,
            actor_user_id,
            credit_score_before,
            credit_score_after,
            credit_delta,
            created_at::text AS created_at
        FROM css_governance_timeline
        WHERE subject_kind = $1 AND subject_id = $2
        ORDER BY created_at DESC
        "#,
    )
    .bind(subject_kind_to_db(&subject_kind))
    .bind(subject_id)
    .fetch_all(pool)
    .await?;
    rows.into_iter().map(row_to_timeline_entry).collect()
}

pub async fn get_timeline_entry(
    pool: &sqlx::PgPool,
    timeline_id: &str,
) -> anyhow::Result<GovernanceTimelineEntry> {
    let row = sqlx::query(
        r#"
        SELECT
            timeline_id,
            subject_kind,
            subject_id,
            event_kind,
            source_system,
            source_id,
            message,
            actor_user_id,
            credit_score_before,
            credit_score_after,
            credit_delta,
            created_at::text AS created_at
        FROM css_governance_timeline
        WHERE timeline_id = $1
        "#,
    )
    .bind(timeline_id)
    .fetch_one(pool)
    .await?;

    row_to_timeline_entry(row)
}

pub async fn get_or_create_credit_profile(
    pool: &sqlx::PgPool,
    user_id: &str,
    initial_score: i32,
) -> anyhow::Result<(CssCreditProfile, bool)> {
    let row = sqlx::query(
        r#"
        SELECT user_id, score, updated_at::text AS updated_at
        FROM css_credit_profiles
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    if let Some(row) = row {
        return Ok((row_to_credit_profile(row)?, false));
    }

    let profile = CssCreditProfile {
        user_id: user_id.to_string(),
        score: initial_score,
        updated_at: chrono::Utc::now().to_rfc3339(),
    };
    sqlx::query(
        r#"
        INSERT INTO css_credit_profiles (user_id, score, updated_at)
        VALUES ($1,$2,$3)
        "#,
    )
    .bind(&profile.user_id)
    .bind(profile.score)
    .bind(&profile.updated_at)
    .execute(pool)
    .await?;
    Ok((profile, true))
}

pub async fn update_credit_profile(
    pool: &sqlx::PgPool,
    user_id: &str,
    score: i32,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        UPDATE css_credit_profiles
        SET score = $2, updated_at = now()
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .bind(score)
    .execute(pool)
    .await?;
    Ok(())
}

fn subject_kind_to_db(kind: &TimelineSubjectKind) -> &'static str {
    match kind {
        TimelineSubjectKind::User => "user",
        TimelineSubjectKind::Catalog => "catalog",
        TimelineSubjectKind::Auction => "auction",
        TimelineSubjectKind::Deal => "deal",
        TimelineSubjectKind::Ownership => "ownership",
    }
}

fn subject_kind_from_db(value: &str) -> anyhow::Result<TimelineSubjectKind> {
    match value {
        "user" => Ok(TimelineSubjectKind::User),
        "catalog" => Ok(TimelineSubjectKind::Catalog),
        "auction" => Ok(TimelineSubjectKind::Auction),
        "deal" => Ok(TimelineSubjectKind::Deal),
        "ownership" => Ok(TimelineSubjectKind::Ownership),
        other => anyhow::bail!("unknown governance subject kind: {other}"),
    }
}

fn event_kind_to_db(kind: &TimelineEventKind) -> &'static str {
    match kind {
        TimelineEventKind::DisputeOpened => "dispute_opened",
        TimelineEventKind::DisputeResolved => "dispute_resolved",
        TimelineEventKind::ReputationViolationApplied => "reputation_violation_applied",
        TimelineEventKind::ReputationPenaltyApplied => "reputation_penalty_applied",
        TimelineEventKind::ModerationCaseOpened => "moderation_case_opened",
        TimelineEventKind::ModerationRestrictionApplied => "moderation_restriction_applied",
        TimelineEventKind::TsDecisionRecorded => "ts_decision_recorded",
        TimelineEventKind::ReviewOpened => "review_opened",
        TimelineEventKind::ReviewAssigned => "review_assigned",
        TimelineEventKind::ReviewApproved => "review_approved",
        TimelineEventKind::ReviewRejected => "review_rejected",
        TimelineEventKind::ReviewEscalated => "review_escalated",
        TimelineEventKind::AuctionFrozen => "auction_frozen",
        TimelineEventKind::AuctionUnfrozen => "auction_unfrozen",
        TimelineEventKind::DealFrozen => "deal_frozen",
        TimelineEventKind::DealReleased => "deal_released",
        TimelineEventKind::PolicyMigrationPlanned => "policy_migration_planned",
        TimelineEventKind::PolicyMigrationApplied => "policy_migration_applied",
        TimelineEventKind::PolicyMigrationRejected => "policy_migration_rejected",
        TimelineEventKind::CreditScoreInitialized => "credit_score_initialized",
        TimelineEventKind::CreditScoreIncreased => "credit_score_increased",
        TimelineEventKind::CreditScoreDecreased => "credit_score_decreased",
        TimelineEventKind::CreditWarningTriggered => "credit_warning_triggered",
    }
}

fn event_kind_from_db(value: &str) -> anyhow::Result<TimelineEventKind> {
    match value {
        "dispute_opened" => Ok(TimelineEventKind::DisputeOpened),
        "dispute_resolved" => Ok(TimelineEventKind::DisputeResolved),
        "reputation_violation_applied" => Ok(TimelineEventKind::ReputationViolationApplied),
        "reputation_penalty_applied" => Ok(TimelineEventKind::ReputationPenaltyApplied),
        "moderation_case_opened" => Ok(TimelineEventKind::ModerationCaseOpened),
        "moderation_restriction_applied" => Ok(TimelineEventKind::ModerationRestrictionApplied),
        "ts_decision_recorded" => Ok(TimelineEventKind::TsDecisionRecorded),
        "review_opened" => Ok(TimelineEventKind::ReviewOpened),
        "review_assigned" => Ok(TimelineEventKind::ReviewAssigned),
        "review_approved" => Ok(TimelineEventKind::ReviewApproved),
        "review_rejected" => Ok(TimelineEventKind::ReviewRejected),
        "review_escalated" => Ok(TimelineEventKind::ReviewEscalated),
        "auction_frozen" => Ok(TimelineEventKind::AuctionFrozen),
        "auction_unfrozen" => Ok(TimelineEventKind::AuctionUnfrozen),
        "deal_frozen" => Ok(TimelineEventKind::DealFrozen),
        "deal_released" => Ok(TimelineEventKind::DealReleased),
        "policy_migration_planned" => Ok(TimelineEventKind::PolicyMigrationPlanned),
        "policy_migration_applied" => Ok(TimelineEventKind::PolicyMigrationApplied),
        "policy_migration_rejected" => Ok(TimelineEventKind::PolicyMigrationRejected),
        "credit_score_initialized" => Ok(TimelineEventKind::CreditScoreInitialized),
        "credit_score_increased" => Ok(TimelineEventKind::CreditScoreIncreased),
        "credit_score_decreased" => Ok(TimelineEventKind::CreditScoreDecreased),
        "credit_warning_triggered" => Ok(TimelineEventKind::CreditWarningTriggered),
        other => anyhow::bail!("unknown governance event kind: {other}"),
    }
}

fn row_to_timeline_entry(row: sqlx::postgres::PgRow) -> anyhow::Result<GovernanceTimelineEntry> {
    Ok(GovernanceTimelineEntry {
        timeline_id: row.try_get("timeline_id")?,
        subject_kind: subject_kind_from_db(&row.try_get::<String, _>("subject_kind")?)?,
        subject_id: row.try_get("subject_id")?,
        event_kind: event_kind_from_db(&row.try_get::<String, _>("event_kind")?)?,
        source_system: row.try_get("source_system")?,
        source_id: row.try_get("source_id")?,
        message: row.try_get("message")?,
        actor_user_id: row.try_get("actor_user_id")?,
        credit_score_before: row.try_get("credit_score_before")?,
        credit_score_after: row.try_get("credit_score_after")?,
        credit_delta: row.try_get("credit_delta")?,
        created_at: row.try_get("created_at")?,
    })
}

fn row_to_credit_profile(row: sqlx::postgres::PgRow) -> anyhow::Result<CssCreditProfile> {
    Ok(CssCreditProfile {
        user_id: row.try_get("user_id")?,
        score: row.try_get("score")?,
        updated_at: row.try_get("updated_at")?,
    })
}
