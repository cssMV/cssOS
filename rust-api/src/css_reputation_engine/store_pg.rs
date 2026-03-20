use crate::css_reputation_engine::policy::{level_from_score, DEFAULT_REPUTATION_SCORE};
use crate::css_reputation_engine::types::{
    CssReputationProfile, ReputationEvent, ReputationLevel, ReputationPenalty,
    ReputationPenaltyKind, ReputationViolationKind,
};
use sqlx::Row;

pub const CREATE_CSS_REPUTATION_PROFILES_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_reputation_profiles (
    user_id TEXT PRIMARY KEY,
    score INTEGER NOT NULL,
    level TEXT NOT NULL,
    violation_count INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT now()
)
"#;

pub const CREATE_CSS_REPUTATION_EVENTS_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_reputation_events (
    event_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    violation_kind TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
)
"#;

pub const CREATE_CSS_REPUTATION_PENALTIES_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_reputation_penalties (
    penalty_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    starts_at TIMESTAMP,
    ends_at TIMESTAMP,
    reason TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
)
"#;

pub async fn get_or_create_profile(
    pool: &sqlx::PgPool,
    user_id: &str,
) -> anyhow::Result<CssReputationProfile> {
    let row = sqlx::query(
        r#"
        SELECT user_id, score, level, violation_count, updated_at::text AS updated_at
        FROM css_reputation_profiles
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    if let Some(row) = row {
        let mut profile = row_to_profile(row)?;
        profile.penalties = list_active_penalties(pool, user_id).await?;
        return Ok(profile);
    }

    let profile = CssReputationProfile {
        user_id: user_id.to_string(),
        score: DEFAULT_REPUTATION_SCORE,
        level: level_from_score(DEFAULT_REPUTATION_SCORE),
        penalties: vec![],
        violation_count: 0,
        updated_at: chrono::Utc::now().to_rfc3339(),
    };
    sqlx::query(
        r#"
        INSERT INTO css_reputation_profiles (user_id, score, level, violation_count, updated_at)
        VALUES ($1,$2,$3,$4,$5)
        "#,
    )
    .bind(&profile.user_id)
    .bind(profile.score)
    .bind(level_to_db(&profile.level))
    .bind(profile.violation_count)
    .bind(&profile.updated_at)
    .execute(pool)
    .await?;
    Ok(profile)
}

pub async fn update_profile(
    pool: &sqlx::PgPool,
    profile: &CssReputationProfile,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        UPDATE css_reputation_profiles
        SET score = $2, level = $3, violation_count = $4, updated_at = $5
        WHERE user_id = $1
        "#,
    )
    .bind(&profile.user_id)
    .bind(profile.score)
    .bind(level_to_db(&profile.level))
    .bind(profile.violation_count)
    .bind(&profile.updated_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn insert_reputation_event(
    pool: &sqlx::PgPool,
    event: &ReputationEvent,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO css_reputation_events (
            event_id, user_id, violation_kind, message, created_at
        )
        VALUES ($1,$2,$3,$4,$5)
        "#,
    )
    .bind(&event.event_id)
    .bind(&event.user_id)
    .bind(violation_kind_to_db(&event.violation_kind))
    .bind(&event.message)
    .bind(&event.created_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn insert_penalty(
    pool: &sqlx::PgPool,
    user_id: &str,
    penalty: &ReputationPenalty,
) -> anyhow::Result<()> {
    let penalty_id = format!("pen_{}", uuid::Uuid::new_v4());
    sqlx::query(
        r#"
        INSERT INTO css_reputation_penalties (
            penalty_id, user_id, kind, starts_at, ends_at, reason
        )
        VALUES ($1,$2,$3,$4,$5,$6)
        "#,
    )
    .bind(penalty_id)
    .bind(user_id)
    .bind(penalty_kind_to_db(&penalty.kind))
    .bind(&penalty.starts_at)
    .bind(&penalty.ends_at)
    .bind(&penalty.reason)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn list_active_penalties(
    pool: &sqlx::PgPool,
    user_id: &str,
) -> anyhow::Result<Vec<ReputationPenalty>> {
    let rows = sqlx::query(
        r#"
        SELECT kind, starts_at::text AS starts_at, ends_at::text AS ends_at, reason
        FROM css_reputation_penalties
        WHERE user_id = $1
          AND (
            ends_at IS NULL
            OR ends_at >= now()
          )
        ORDER BY created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    rows.into_iter().map(row_to_penalty).collect()
}

fn level_to_db(level: &ReputationLevel) -> &'static str {
    match level {
        ReputationLevel::Trusted => "trusted",
        ReputationLevel::Normal => "normal",
        ReputationLevel::Watchlisted => "watchlisted",
        ReputationLevel::Restricted => "restricted",
        ReputationLevel::Suspended => "suspended",
    }
}

fn level_from_db(value: &str) -> anyhow::Result<ReputationLevel> {
    match value {
        "trusted" => Ok(ReputationLevel::Trusted),
        "normal" => Ok(ReputationLevel::Normal),
        "watchlisted" => Ok(ReputationLevel::Watchlisted),
        "restricted" => Ok(ReputationLevel::Restricted),
        "suspended" => Ok(ReputationLevel::Suspended),
        other => anyhow::bail!("unknown reputation level: {other}"),
    }
}

fn violation_kind_to_db(kind: &ReputationViolationKind) -> &'static str {
    match kind {
        ReputationViolationKind::SelfBidding => "self_bidding",
        ReputationViolationKind::SelfAutoBidding => "self_auto_bidding",
        ReputationViolationKind::SuspiciousPriceManipulation => "suspicious_price_manipulation",
        ReputationViolationKind::AuctionDisruption => "auction_disruption",
        ReputationViolationKind::OwnershipAbuse => "ownership_abuse",
    }
}

fn penalty_kind_to_db(kind: &ReputationPenaltyKind) -> &'static str {
    match kind {
        ReputationPenaltyKind::WarningOnly => "warning_only",
        ReputationPenaltyKind::DisableOwnAuctionCreation => "disable_own_auction_creation",
        ReputationPenaltyKind::DisableAuctionParticipation => "disable_auction_participation",
        ReputationPenaltyKind::DisableAutoBid => "disable_auto_bid",
        ReputationPenaltyKind::FreezeHighValueTrading => "freeze_high_value_trading",
    }
}

fn penalty_kind_from_db(value: &str) -> anyhow::Result<ReputationPenaltyKind> {
    match value {
        "warning_only" => Ok(ReputationPenaltyKind::WarningOnly),
        "disable_own_auction_creation" => Ok(ReputationPenaltyKind::DisableOwnAuctionCreation),
        "disable_auction_participation" => Ok(ReputationPenaltyKind::DisableAuctionParticipation),
        "disable_auto_bid" => Ok(ReputationPenaltyKind::DisableAutoBid),
        "freeze_high_value_trading" => Ok(ReputationPenaltyKind::FreezeHighValueTrading),
        other => anyhow::bail!("unknown reputation penalty kind: {other}"),
    }
}

fn row_to_profile(row: sqlx::postgres::PgRow) -> anyhow::Result<CssReputationProfile> {
    Ok(CssReputationProfile {
        user_id: row.try_get("user_id")?,
        score: row.try_get("score")?,
        level: level_from_db(&row.try_get::<String, _>("level")?)?,
        penalties: vec![],
        violation_count: row.try_get("violation_count")?,
        updated_at: row.try_get("updated_at")?,
    })
}

fn row_to_penalty(row: sqlx::postgres::PgRow) -> anyhow::Result<ReputationPenalty> {
    Ok(ReputationPenalty {
        kind: penalty_kind_from_db(&row.try_get::<String, _>("kind")?)?,
        starts_at: row.try_get("starts_at")?,
        ends_at: row.try_get("ends_at")?,
        reason: row.try_get("reason")?,
    })
}
