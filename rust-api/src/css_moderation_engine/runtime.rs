use crate::css_moderation_engine::types::{
    CssModerationCase, ModerationAction, ModerationContext, ModerationDecision,
    ModerationSubjectKind,
};

pub async fn build_user_context(
    pool: &sqlx::PgPool,
    user_id: &str,
) -> anyhow::Result<ModerationContext> {
    let profile =
        crate::css_reputation_engine::store_pg::get_or_create_profile(pool, user_id).await?;
    let disputes = crate::css_dispute_engine::store_pg::list_open_disputes_for_user(pool, user_id)
        .await
        .unwrap_or_default();
    let penalties = crate::css_reputation_engine::store_pg::list_active_penalties(pool, user_id)
        .await
        .unwrap_or_default();

    Ok(ModerationContext {
        open_dispute_count: disputes.len() as i32,
        reputation_score: profile.score,
        reputation_violation_count: profile.violation_count,
        has_active_penalty: !penalties.is_empty(),
    })
}

pub async fn check_user_can_participate_auction(
    pool: &sqlx::PgPool,
    user_id: &str,
) -> anyhow::Result<ModerationDecision> {
    let ctx = build_user_context(pool, user_id).await?;
    let level = crate::css_moderation_engine::policy::derive_level(&ctx);
    let action = crate::css_moderation_engine::policy::action_for_user_level(&level);
    let allowed = !matches!(
        action,
        ModerationAction::RestrictAuctionParticipation | ModerationAction::RequireManualReview
    );

    Ok(ModerationDecision {
        allowed,
        level,
        action,
        code: if allowed {
            "auction_participation_allowed".into()
        } else {
            "auction_participation_blocked".into()
        },
        message: if allowed {
            "当前治理状态允许参与竞拍。".into()
        } else {
            "当前治理状态限制参与竞拍。".into()
        },
    })
}

pub async fn check_owner_can_create_auction(
    pool: &sqlx::PgPool,
    owner_user_id: &str,
) -> anyhow::Result<ModerationDecision> {
    let ctx = build_user_context(pool, owner_user_id).await?;
    let level = crate::css_moderation_engine::policy::derive_level(&ctx);
    let base_action = crate::css_moderation_engine::policy::action_for_user_level(&level);
    let action = match base_action {
        ModerationAction::RestrictAuctionParticipation => ModerationAction::RestrictAuctionCreation,
        other => other,
    };
    let allowed = !matches!(
        action,
        ModerationAction::RestrictAuctionCreation | ModerationAction::RequireManualReview
    );

    Ok(ModerationDecision {
        allowed,
        level,
        action,
        code: if allowed {
            "auction_creation_allowed".into()
        } else {
            "auction_creation_blocked".into()
        },
        message: if allowed {
            "当前治理状态允许创建拍卖。".into()
        } else {
            "当前治理状态限制创建拍卖。".into()
        },
    })
}

pub async fn open_self_bidding_moderation_case(
    pool: &sqlx::PgPool,
    catalog_id: &str,
    owner_user_id: &str,
    now_rfc3339: &str,
) -> anyhow::Result<CssModerationCase> {
    let decision = crate::css_moderation_engine::policy::moderation_for_self_bidding_owner();
    let case = CssModerationCase {
        moderation_id: format!("mod_{}", uuid::Uuid::new_v4()),
        subject_kind: ModerationSubjectKind::User,
        subject_id: owner_user_id.to_string(),
        level: decision.level,
        action: decision.action,
        reason: format!("catalog {}: {}", catalog_id, decision.message),
        created_at: now_rfc3339.to_string(),
    };
    crate::css_moderation_engine::store_pg::insert_moderation_case(pool, &case).await?;
    Ok(case)
}
