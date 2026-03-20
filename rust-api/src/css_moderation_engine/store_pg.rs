use crate::css_moderation_engine::types::{
    CssModerationCase, ModerationAction, ModerationLevel, ModerationSubjectKind,
};
use sqlx::Row;

pub const CREATE_CSS_MODERATION_CASES_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_moderation_cases (
    moderation_id TEXT PRIMARY KEY,
    subject_kind TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    level TEXT NOT NULL,
    action TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
)
"#;

pub async fn insert_moderation_case(
    pool: &sqlx::PgPool,
    case: &CssModerationCase,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO css_moderation_cases (
            moderation_id, subject_kind, subject_id, level, action, reason, created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        "#,
    )
    .bind(&case.moderation_id)
    .bind(subject_kind_to_db(&case.subject_kind))
    .bind(&case.subject_id)
    .bind(level_to_db(&case.level))
    .bind(action_to_db(&case.action))
    .bind(&case.reason)
    .bind(&case.created_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn list_cases_for_subject(
    pool: &sqlx::PgPool,
    subject_kind: ModerationSubjectKind,
    subject_id: &str,
) -> anyhow::Result<Vec<CssModerationCase>> {
    let rows = sqlx::query(
        r#"
        SELECT moderation_id, subject_kind, subject_id, level, action, reason, created_at::text AS created_at
        FROM css_moderation_cases
        WHERE subject_kind = $1 AND subject_id = $2
        ORDER BY created_at DESC
        "#,
    )
    .bind(subject_kind_to_db(&subject_kind))
    .bind(subject_id)
    .fetch_all(pool)
    .await?;
    rows.into_iter().map(row_to_case).collect()
}

pub async fn get_latest_case_for_subject(
    pool: &sqlx::PgPool,
    subject_kind: ModerationSubjectKind,
    subject_id: &str,
) -> anyhow::Result<Option<CssModerationCase>> {
    let row = sqlx::query(
        r#"
        SELECT moderation_id, subject_kind, subject_id, level, action, reason, created_at::text AS created_at
        FROM css_moderation_cases
        WHERE subject_kind = $1 AND subject_id = $2
        ORDER BY created_at DESC
        LIMIT 1
        "#,
    )
    .bind(subject_kind_to_db(&subject_kind))
    .bind(subject_id)
    .fetch_optional(pool)
    .await?;
    row.map(row_to_case).transpose()
}

fn subject_kind_to_db(kind: &ModerationSubjectKind) -> &'static str {
    match kind {
        ModerationSubjectKind::User => "user",
        ModerationSubjectKind::CatalogItem => "catalog_item",
        ModerationSubjectKind::Auction => "auction",
        ModerationSubjectKind::Deal => "deal",
        ModerationSubjectKind::Ownership => "ownership",
    }
}

fn subject_kind_from_db(value: &str) -> anyhow::Result<ModerationSubjectKind> {
    match value {
        "user" => Ok(ModerationSubjectKind::User),
        "catalog_item" => Ok(ModerationSubjectKind::CatalogItem),
        "auction" => Ok(ModerationSubjectKind::Auction),
        "deal" => Ok(ModerationSubjectKind::Deal),
        "ownership" => Ok(ModerationSubjectKind::Ownership),
        other => anyhow::bail!("unknown moderation subject kind: {other}"),
    }
}

fn level_to_db(level: &ModerationLevel) -> &'static str {
    match level {
        ModerationLevel::Clean => "clean",
        ModerationLevel::Observe => "observe",
        ModerationLevel::Restricted => "restricted",
        ModerationLevel::Frozen => "frozen",
        ModerationLevel::ReviewRequired => "review_required",
    }
}

fn level_from_db(value: &str) -> anyhow::Result<ModerationLevel> {
    match value {
        "clean" => Ok(ModerationLevel::Clean),
        "observe" => Ok(ModerationLevel::Observe),
        "restricted" => Ok(ModerationLevel::Restricted),
        "frozen" => Ok(ModerationLevel::Frozen),
        "review_required" => Ok(ModerationLevel::ReviewRequired),
        other => anyhow::bail!("unknown moderation level: {other}"),
    }
}

fn action_to_db(action: &ModerationAction) -> &'static str {
    match action {
        ModerationAction::None => "none",
        ModerationAction::Warn => "warn",
        ModerationAction::ObserveOnly => "observe_only",
        ModerationAction::RestrictAuctionCreation => "restrict_auction_creation",
        ModerationAction::RestrictAuctionParticipation => "restrict_auction_participation",
        ModerationAction::RestrictOwnershipTransfer => "restrict_ownership_transfer",
        ModerationAction::FreezeAuction => "freeze_auction",
        ModerationAction::FreezeDeal => "freeze_deal",
        ModerationAction::RequireManualReview => "require_manual_review",
    }
}

fn action_from_db(value: &str) -> anyhow::Result<ModerationAction> {
    match value {
        "none" => Ok(ModerationAction::None),
        "warn" => Ok(ModerationAction::Warn),
        "observe_only" => Ok(ModerationAction::ObserveOnly),
        "restrict_auction_creation" => Ok(ModerationAction::RestrictAuctionCreation),
        "restrict_auction_participation" => Ok(ModerationAction::RestrictAuctionParticipation),
        "restrict_ownership_transfer" => Ok(ModerationAction::RestrictOwnershipTransfer),
        "freeze_auction" => Ok(ModerationAction::FreezeAuction),
        "freeze_deal" => Ok(ModerationAction::FreezeDeal),
        "require_manual_review" => Ok(ModerationAction::RequireManualReview),
        other => anyhow::bail!("unknown moderation action: {other}"),
    }
}

fn row_to_case(row: sqlx::postgres::PgRow) -> anyhow::Result<CssModerationCase> {
    Ok(CssModerationCase {
        moderation_id: row.try_get("moderation_id")?,
        subject_kind: subject_kind_from_db(&row.try_get::<String, _>("subject_kind")?)?,
        subject_id: row.try_get("subject_id")?,
        level: level_from_db(&row.try_get::<String, _>("level")?)?,
        action: action_from_db(&row.try_get::<String, _>("action")?)?,
        reason: row.try_get("reason")?,
        created_at: row.try_get("created_at")?,
    })
}
