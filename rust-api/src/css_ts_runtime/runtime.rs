use crate::css_ts_runtime::types::{
    TsActionKind, TsRuntimeContext, TsRuntimeDecision, TsRuntimeRequest, TsSubjectKind,
};

pub async fn build_context(pool: &sqlx::PgPool, user_id: &str) -> anyhow::Result<TsRuntimeContext> {
    let profile =
        crate::css_reputation_engine::store_pg::get_or_create_profile(pool, user_id).await?;
    let disputes = crate::css_dispute_engine::store_pg::list_open_disputes_for_user(pool, user_id)
        .await
        .unwrap_or_default();
    let penalties = crate::css_reputation_engine::store_pg::list_active_penalties(pool, user_id)
        .await
        .unwrap_or_default();
    let moderation =
        crate::css_moderation_engine::runtime::check_user_can_participate_auction(pool, user_id)
            .await
            .ok();

    Ok(TsRuntimeContext {
        reputation_score: profile.score,
        violation_count: profile.violation_count,
        open_dispute_count: disputes.len() as i32,
        has_active_penalty: !penalties.is_empty(),
        moderation_level: moderation
            .as_ref()
            .map(|x| format!("{:?}", x.level).to_lowercase())
            .unwrap_or_default(),
        moderation_action: moderation
            .as_ref()
            .map(|x| format!("{:?}", x.action).to_lowercase())
            .unwrap_or_default(),
    })
}

pub async fn evaluate(
    pool: &sqlx::PgPool,
    req: TsRuntimeRequest,
) -> anyhow::Result<TsRuntimeDecision> {
    let ctx = build_context(pool, &req.actor_user_id).await?;
    Ok(crate::css_ts_runtime::policy::derive_decision(
        &req.action,
        &ctx,
        req.amount_cents,
    ))
}

pub async fn evaluate_submit_bid(
    pool: &sqlx::PgPool,
    actor_user_id: &str,
    catalog_id: &str,
    amount_cents: i64,
) -> anyhow::Result<TsRuntimeDecision> {
    let now = chrono::Utc::now().to_rfc3339();
    let _ = crate::css_signals_snapshot::runtime::create_snapshot(
        pool,
        crate::css_signals_snapshot::types::SnapshotCreateRequest {
            subject_kind: crate::css_signals_snapshot::types::SnapshotSubjectKind::Catalog,
            subject_id: catalog_id.to_string(),
            purpose: crate::css_signals_snapshot::types::SnapshotPurpose::TsDecisionInput,
            related_audit_id: None,
            related_review_id: None,
            related_deal_id: None,
            related_dispute_id: None,
            source_system: "css_ts_runtime".into(),
        },
        &now,
    )
    .await;
    let entry = crate::css_catalog_engine::store_pg::get_catalog_entry(pool, catalog_id).await?;
    let policy_version_id = crate::css_rule_audit::runtime::resolve_policy_version_id_for_subject(
        pool,
        crate::css_policy_versioning::types::PolicyBindingSubjectKind::Catalog,
        catalog_id,
    )
    .await;
    let is_owner_self_bid = entry.owner_user_id == actor_user_id;
    let self_bidding_forbidden = crate::css_policy_engine::runtime::self_bidding_forbidden();

    let decision = if is_owner_self_bid {
        crate::css_ts_runtime::policy::direct_block_self_bidding()
    } else {
        evaluate(
            pool,
            TsRuntimeRequest {
                action: TsActionKind::SubmitBid,
                actor_user_id: actor_user_id.to_string(),
                subject_kind: Some(TsSubjectKind::Catalog),
                subject_id: Some(catalog_id.to_string()),
                catalog_id: Some(catalog_id.to_string()),
                ownership_id: None,
                deal_id: None,
                amount_cents: Some(amount_cents),
            },
        )
        .await?
    };

    let final_decision = match decision.decision {
        crate::css_ts_runtime::types::TsDecisionKind::Allow => {
            crate::css_rule_audit::types::RuleAuditDecision::Allow
        }
        crate::css_ts_runtime::types::TsDecisionKind::Restrict => {
            crate::css_rule_audit::types::RuleAuditDecision::Restrict
        }
        crate::css_ts_runtime::types::TsDecisionKind::Freeze => {
            crate::css_rule_audit::types::RuleAuditDecision::Freeze
        }
        crate::css_ts_runtime::types::TsDecisionKind::ReviewRequired => {
            crate::css_rule_audit::types::RuleAuditDecision::ReviewRequired
        }
    };

    let _ = crate::css_rule_audit::runtime::audit_submit_bid(
        pool,
        actor_user_id,
        catalog_id,
        &policy_version_id,
        self_bidding_forbidden,
        is_owner_self_bid,
        final_decision,
        &decision.code,
        &decision.message,
        &now,
    )
    .await;

    Ok(decision)
}

pub async fn evaluate_enable_auto_bid(
    pool: &sqlx::PgPool,
    actor_user_id: &str,
    catalog_id: &str,
    max_bid_cents: i64,
) -> anyhow::Result<TsRuntimeDecision> {
    let _ = crate::css_signals_snapshot::runtime::create_snapshot(
        pool,
        crate::css_signals_snapshot::types::SnapshotCreateRequest {
            subject_kind: crate::css_signals_snapshot::types::SnapshotSubjectKind::Catalog,
            subject_id: catalog_id.to_string(),
            purpose: crate::css_signals_snapshot::types::SnapshotPurpose::TsDecisionInput,
            related_audit_id: None,
            related_review_id: None,
            related_deal_id: None,
            related_dispute_id: None,
            source_system: "css_ts_runtime".into(),
        },
        &chrono::Utc::now().to_rfc3339(),
    )
    .await;
    let entry = crate::css_catalog_engine::store_pg::get_catalog_entry(pool, catalog_id).await?;
    if entry.owner_user_id == actor_user_id {
        return Ok(crate::css_ts_runtime::policy::direct_block_self_bidding());
    }

    evaluate(
        pool,
        TsRuntimeRequest {
            action: TsActionKind::EnableAutoBid,
            actor_user_id: actor_user_id.to_string(),
            subject_kind: Some(TsSubjectKind::Catalog),
            subject_id: Some(catalog_id.to_string()),
            catalog_id: Some(catalog_id.to_string()),
            ownership_id: None,
            deal_id: None,
            amount_cents: Some(max_bid_cents),
        },
    )
    .await
}

pub async fn evaluate_finalize_deal(
    pool: &sqlx::PgPool,
    actor_user_id: &str,
    deal_id: &str,
    amount_cents: i64,
) -> anyhow::Result<TsRuntimeDecision> {
    let _ = crate::css_signals_snapshot::runtime::create_snapshot(
        pool,
        crate::css_signals_snapshot::types::SnapshotCreateRequest {
            subject_kind: crate::css_signals_snapshot::types::SnapshotSubjectKind::Deal,
            subject_id: deal_id.to_string(),
            purpose: crate::css_signals_snapshot::types::SnapshotPurpose::DealFinalize,
            related_audit_id: None,
            related_review_id: None,
            related_deal_id: Some(deal_id.to_string()),
            related_dispute_id: None,
            source_system: "css_ts_runtime".into(),
        },
        &chrono::Utc::now().to_rfc3339(),
    )
    .await;
    evaluate(
        pool,
        TsRuntimeRequest {
            action: TsActionKind::FinalizeDeal,
            actor_user_id: actor_user_id.to_string(),
            subject_kind: Some(TsSubjectKind::Deal),
            subject_id: Some(deal_id.to_string()),
            catalog_id: None,
            ownership_id: None,
            deal_id: Some(deal_id.to_string()),
            amount_cents: Some(amount_cents),
        },
    )
    .await
}
