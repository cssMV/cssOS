use crate::css_reputation_engine::types::{
    CssReputationProfile, ReputationDecision, ReputationEvent, ReputationViolationKind,
};

pub async fn apply_violation(
    pool: &sqlx::PgPool,
    user_id: &str,
    violation_kind: ReputationViolationKind,
    message: &str,
    now_rfc3339: &str,
) -> anyhow::Result<CssReputationProfile> {
    let mut profile =
        crate::css_reputation_engine::store_pg::get_or_create_profile(pool, user_id).await?;
    profile.score += crate::css_reputation_engine::policy::violation_score_delta(&violation_kind);
    if profile.score < 0 {
        profile.score = 0;
    }
    profile.violation_count += 1;
    profile.level = crate::css_reputation_engine::policy::level_from_score(profile.score);
    profile.updated_at = now_rfc3339.to_string();

    crate::css_reputation_engine::store_pg::insert_reputation_event(
        pool,
        &ReputationEvent {
            event_id: format!("revt_{}", uuid::Uuid::new_v4()),
            user_id: user_id.to_string(),
            violation_kind: violation_kind.clone(),
            message: message.to_string(),
            created_at: now_rfc3339.to_string(),
        },
    )
    .await?;

    if matches!(
        violation_kind,
        ReputationViolationKind::SelfBidding | ReputationViolationKind::SelfAutoBidding
    ) {
        let penalties = crate::css_reputation_engine::policy::penalties_for_self_bidding(
            profile.violation_count,
            now_rfc3339,
        );
        for penalty in penalties {
            crate::css_reputation_engine::store_pg::insert_penalty(pool, user_id, &penalty).await?;
        }
    }

    crate::css_reputation_engine::store_pg::update_profile(pool, &profile).await?;
    profile.penalties =
        crate::css_reputation_engine::store_pg::list_active_penalties(pool, user_id).await?;
    Ok(profile)
}

pub async fn apply_self_bidding_violation(
    pool: &sqlx::PgPool,
    user_id: &str,
    now_rfc3339: &str,
) -> anyhow::Result<CssReputationProfile> {
    apply_violation(
        pool,
        user_id,
        ReputationViolationKind::SelfBidding,
        "当前 owner 参与自己作品竞拍，属于违规行为，已记录并处罚。",
        now_rfc3339,
    )
    .await
}

pub async fn apply_self_auto_bidding_violation(
    pool: &sqlx::PgPool,
    user_id: &str,
    now_rfc3339: &str,
) -> anyhow::Result<CssReputationProfile> {
    apply_violation(
        pool,
        user_id,
        ReputationViolationKind::SelfAutoBidding,
        "当前 owner 对自己作品启用自动代拍，属于违规行为，已记录并处罚。",
        now_rfc3339,
    )
    .await
}

pub async fn check_auction_creation_allowed(
    pool: &sqlx::PgPool,
    user_id: &str,
) -> anyhow::Result<ReputationDecision> {
    let profile =
        crate::css_reputation_engine::store_pg::get_or_create_profile(pool, user_id).await?;
    Ok(crate::css_reputation_engine::policy::can_create_auction(
        &profile,
    ))
}

pub async fn check_auction_participation_allowed(
    pool: &sqlx::PgPool,
    user_id: &str,
) -> anyhow::Result<ReputationDecision> {
    let profile =
        crate::css_reputation_engine::store_pg::get_or_create_profile(pool, user_id).await?;
    Ok(crate::css_reputation_engine::policy::can_participate_in_auction(&profile))
}

pub async fn check_auto_bid_allowed(
    pool: &sqlx::PgPool,
    user_id: &str,
) -> anyhow::Result<ReputationDecision> {
    let profile =
        crate::css_reputation_engine::store_pg::get_or_create_profile(pool, user_id).await?;
    Ok(crate::css_reputation_engine::policy::can_use_auto_bid(
        &profile,
    ))
}
