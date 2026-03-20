use crate::css_governance_timeline::types::{
    CssCreditProfile, GovernanceTimelineEntry, TimelineAppendRequest, TimelineEventKind,
    TimelineSubjectKind,
};

pub async fn append_event(
    pool: &sqlx::PgPool,
    req: TimelineAppendRequest,
    now_rfc3339: &str,
) -> anyhow::Result<GovernanceTimelineEntry> {
    let entry = GovernanceTimelineEntry {
        timeline_id: format!("gtl_{}", uuid::Uuid::new_v4()),
        subject_kind: req.subject_kind,
        subject_id: req.subject_id,
        event_kind: req.event_kind,
        source_system: req.source_system,
        source_id: req.source_id,
        message: req.message,
        actor_user_id: req.actor_user_id,
        credit_score_before: req.credit_score_before,
        credit_score_after: req.credit_score_after,
        credit_delta: req.credit_delta,
        created_at: now_rfc3339.to_string(),
    };
    crate::css_governance_timeline::store_pg::insert_timeline_entry(pool, &entry).await?;
    Ok(entry)
}

pub async fn initialize_credit_profile_if_missing(
    pool: &sqlx::PgPool,
    user_id: &str,
    now_rfc3339: &str,
) -> anyhow::Result<CssCreditProfile> {
    let initial_score = crate::css_policy_engine::runtime::credit_initial_score();
    let (profile, created) =
        crate::css_governance_timeline::store_pg::get_or_create_credit_profile(
            pool,
            user_id,
            initial_score,
        )
        .await?;

    if created {
        let _ = append_event(
            pool,
            TimelineAppendRequest {
                subject_kind: TimelineSubjectKind::User,
                subject_id: user_id.to_string(),
                event_kind: TimelineEventKind::CreditScoreInitialized,
                source_system: "css_credit".into(),
                source_id: user_id.to_string(),
                message: format!("信用积分初始化为 {}。", initial_score),
                actor_user_id: Some(user_id.to_string()),
                credit_score_before: None,
                credit_score_after: Some(initial_score),
                credit_delta: Some(0),
            },
            now_rfc3339,
        )
        .await?;
    }

    Ok(profile)
}

pub async fn apply_credit_delta(
    pool: &sqlx::PgPool,
    user_id: &str,
    delta: i32,
    source_system: &str,
    source_id: &str,
    message: &str,
    now_rfc3339: &str,
) -> anyhow::Result<i32> {
    let initial_score = crate::css_policy_engine::runtime::credit_initial_score();
    let low_warning_threshold = crate::css_policy_engine::runtime::credit_low_warning_threshold();
    let (profile, _) = crate::css_governance_timeline::store_pg::get_or_create_credit_profile(
        pool,
        user_id,
        initial_score,
    )
    .await?;

    let before = profile.score;
    let after = (before + delta).max(0);
    crate::css_governance_timeline::store_pg::update_credit_profile(pool, user_id, after).await?;

    let event_kind = if delta >= 0 {
        TimelineEventKind::CreditScoreIncreased
    } else {
        TimelineEventKind::CreditScoreDecreased
    };

    let _ = append_event(
        pool,
        TimelineAppendRequest {
            subject_kind: TimelineSubjectKind::User,
            subject_id: user_id.to_string(),
            event_kind,
            source_system: source_system.to_string(),
            source_id: source_id.to_string(),
            message: message.to_string(),
            actor_user_id: Some(user_id.to_string()),
            credit_score_before: Some(before),
            credit_score_after: Some(after),
            credit_delta: Some(delta),
        },
        now_rfc3339,
    )
    .await?;
    let _ = crate::css_decision_graph::runtime::append_credit_change(
        pool,
        user_id,
        source_system,
        source_id,
        delta,
        now_rfc3339,
    )
    .await;
    let _ = crate::css_signals_invalidation::runtime::invalidate_from_event(
        pool,
        crate::css_signals_invalidation::types::SignalsInvalidationEvent {
            event_id: format!("inv_{}", uuid::Uuid::new_v4()),
            event_kind:
                crate::css_signals_invalidation::types::InvalidationEventKind::CreditChanged,
            user_id: Some(user_id.to_string()),
            catalog_id: None,
            deal_id: None,
            ownership_id: None,
            source_system: Some(source_system.to_string()),
            created_at: now_rfc3339.to_string(),
        },
    )
    .await;

    if after < low_warning_threshold {
        let _ = append_event(
            pool,
            TimelineAppendRequest {
                subject_kind: TimelineSubjectKind::User,
                subject_id: user_id.to_string(),
                event_kind: TimelineEventKind::CreditWarningTriggered,
                source_system: "css_credit".into(),
                source_id: user_id.to_string(),
                message: format!("用户信用积分已降至 {}，买家侧应显示信用偏低提醒。", after),
                actor_user_id: Some(user_id.to_string()),
                credit_score_before: Some(after),
                credit_score_after: Some(after),
                credit_delta: Some(0),
            },
            now_rfc3339,
        )
        .await?;
    }

    Ok(after)
}

pub async fn apply_self_bidding_credit_penalty(
    pool: &sqlx::PgPool,
    user_id: &str,
    dispute_id: &str,
    now_rfc3339: &str,
) -> anyhow::Result<i32> {
    apply_credit_delta(
        pool,
        user_id,
        crate::css_policy_engine::runtime::self_bidding_penalty(),
        "css_dispute",
        dispute_id,
        "参与自己作品竞拍，涉嫌哄抬价格，信用积分扣减。",
        now_rfc3339,
    )
    .await
}

pub async fn apply_self_auto_bidding_credit_penalty(
    pool: &sqlx::PgPool,
    user_id: &str,
    dispute_id: &str,
    now_rfc3339: &str,
) -> anyhow::Result<i32> {
    apply_credit_delta(
        pool,
        user_id,
        crate::css_policy_engine::runtime::self_auto_bid_penalty(),
        "css_dispute",
        dispute_id,
        "对自己作品启用自动代拍，涉嫌价格操纵，信用积分扣减。",
        now_rfc3339,
    )
    .await
}

pub async fn apply_listen_sale_credit_reward(
    pool: &sqlx::PgPool,
    user_id: &str,
    deal_id: &str,
    now_rfc3339: &str,
) -> anyhow::Result<i32> {
    apply_credit_delta(
        pool,
        user_id,
        crate::css_policy_engine::runtime::listen_sale_reward(),
        "css_deal",
        deal_id,
        "成功完成一次合规聆听权交易，信用积分增加。",
        now_rfc3339,
    )
    .await
}

pub async fn apply_buyout_sale_credit_reward(
    pool: &sqlx::PgPool,
    user_id: &str,
    deal_id: &str,
    now_rfc3339: &str,
) -> anyhow::Result<i32> {
    apply_credit_delta(
        pool,
        user_id,
        crate::css_policy_engine::runtime::buyout_sale_reward(),
        "css_deal",
        deal_id,
        "成功完成一次合规买断权交易，信用积分增加。",
        now_rfc3339,
    )
    .await
}

pub async fn apply_successful_auction_credit_reward(
    pool: &sqlx::PgPool,
    user_id: &str,
    catalog_id: &str,
    now_rfc3339: &str,
) -> anyhow::Result<i32> {
    apply_credit_delta(
        pool,
        user_id,
        crate::css_policy_engine::runtime::successful_auction_reward(),
        "css_auction",
        catalog_id,
        "成功举办一次无争议拍卖并完成结算，信用积分增加。",
        now_rfc3339,
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v170_append_request_keeps_credit_delta_fields() {
        let req = TimelineAppendRequest {
            subject_kind: TimelineSubjectKind::User,
            subject_id: "user_1".into(),
            event_kind: TimelineEventKind::CreditScoreDecreased,
            source_system: "css_dispute".into(),
            source_id: "disp_1".into(),
            message: "credit down".into(),
            actor_user_id: Some("user_1".into()),
            credit_score_before: Some(700),
            credit_score_after: Some(660),
            credit_delta: Some(-40),
        };
        assert_eq!(req.credit_delta, Some(-40));
        assert_eq!(req.credit_score_after, Some(660));
    }
}
