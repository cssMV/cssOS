use crate::css_deal_engine::types::{
    CssDeal, DealIntent, DealIntentStatus, DealStatus, SellerSelectionRequest,
};

pub async fn create_intent(
    pool: &sqlx::PgPool,
    ownership_id: String,
    buyer_user_id: String,
    offered_price_cents: Option<i64>,
    currency: Option<String>,
) -> anyhow::Result<DealIntent> {
    let ownership =
        crate::css_ownership_engine::store_pg::get_ownership(pool, &ownership_id).await?;
    let decision = crate::css_deal_engine::policy::can_create_intent(&ownership);
    if !decision.allowed {
        anyhow::bail!("{}", decision.message);
    }

    let intent = DealIntent {
        intent_id: format!("intent_{}", uuid::Uuid::new_v4()),
        ownership_id: ownership_id.clone(),
        seller_user_id: ownership.owner_user_id.clone(),
        buyer_user_id,
        offered_price_cents,
        currency,
        status: DealIntentStatus::Pending,
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    crate::css_deal_engine::store_pg::insert_deal_intent(pool, &intent).await?;
    Ok(intent)
}

pub async fn select_buyer(
    pool: &sqlx::PgPool,
    req: SellerSelectionRequest,
) -> anyhow::Result<CssDeal> {
    let ownership =
        crate::css_ownership_engine::store_pg::get_ownership(pool, &req.ownership_id).await?;
    let allowed = crate::css_deal_engine::policy::can_select_buyer(&ownership, &req.seller_user_id);
    if !allowed.allowed {
        anyhow::bail!("{}", allowed.message);
    }

    let intents =
        crate::css_deal_engine::store_pg::list_intents_for_ownership(pool, &req.ownership_id)
            .await?;
    let selected = intents
        .iter()
        .find(|intent| intent.intent_id == req.selected_intent_id)
        .ok_or_else(|| anyhow::anyhow!("selected intent not found"))?;
    let lock_ok = crate::css_deal_engine::policy::can_lock_for_buyer(selected);
    if !lock_ok.allowed {
        anyhow::bail!("{}", lock_ok.message);
    }

    crate::css_deal_engine::store_pg::mark_intent_selected(pool, &selected.intent_id).await?;
    crate::css_deal_engine::store_pg::mark_other_intents_rejected(
        pool,
        &req.ownership_id,
        &selected.intent_id,
    )
    .await?;

    let price = selected
        .offered_price_cents
        .or(ownership.buyout_price_cents)
        .ok_or_else(|| anyhow::anyhow!("deal price missing"))?;
    let currency = selected
        .currency
        .clone()
        .or(ownership.currency.clone())
        .ok_or_else(|| anyhow::anyhow!("deal currency missing"))?;

    let deal = CssDeal {
        deal_id: format!("deal_{}", uuid::Uuid::new_v4()),
        ownership_id: req.ownership_id,
        seller_user_id: req.seller_user_id,
        buyer_user_id: selected.buyer_user_id.clone(),
        intent_id: selected.intent_id.clone(),
        price_cents: price,
        currency,
        status: DealStatus::LockedForBuyer,
        payment_id: None,
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    crate::css_deal_engine::store_pg::insert_deal(pool, &deal).await?;
    Ok(deal)
}

pub async fn move_deal_to_payment(pool: &sqlx::PgPool, deal_id: &str) -> anyhow::Result<()> {
    crate::css_deal_engine::store_pg::mark_deal_awaiting_payment(pool, deal_id).await
}

pub async fn finalize_paid_deal(
    pool: &sqlx::PgPool,
    deal_id: &str,
    payment_id: &str,
) -> anyhow::Result<()> {
    let now = chrono::Utc::now().to_rfc3339();
    let deal = crate::css_deal_engine::store_pg::get_deal(pool, deal_id).await?;
    let ts = crate::css_ts_runtime::runtime::evaluate_finalize_deal(
        pool,
        &deal.buyer_user_id,
        deal_id,
        deal.price_cents,
    )
    .await?;
    match ts.decision {
        crate::css_ts_runtime::types::TsDecisionKind::Allow => {}
        crate::css_ts_runtime::types::TsDecisionKind::ReviewRequired => {
            let _ = crate::css_review_queue::runtime::open_review_from_ts(
                pool,
                &crate::css_ts_runtime::types::TsRuntimeRequest {
                    action: crate::css_ts_runtime::types::TsActionKind::FinalizeDeal,
                    actor_user_id: deal.buyer_user_id.clone(),
                    subject_kind: Some(crate::css_ts_runtime::types::TsSubjectKind::Deal),
                    subject_id: Some(deal_id.to_string()),
                    catalog_id: None,
                    ownership_id: Some(deal.ownership_id.clone()),
                    deal_id: Some(deal_id.to_string()),
                    amount_cents: Some(deal.price_cents),
                },
                &ts,
                &now,
            )
            .await;
            anyhow::bail!("{}", ts.message);
        }
        crate::css_ts_runtime::types::TsDecisionKind::Restrict
        | crate::css_ts_runtime::types::TsDecisionKind::Freeze => {
            anyhow::bail!("{}", ts.message);
        }
    }
    crate::css_deal_engine::store_pg::mark_deal_paid(pool, deal_id, payment_id).await?;
    crate::css_ownership_engine::store_pg::transfer_ownership(
        pool,
        &deal.ownership_id,
        &deal.buyer_user_id,
    )
    .await?;
    crate::css_entitlement::runtime::issue_entitlement(
        pool,
        deal.buyer_user_id.clone(),
        crate::css_entitlement::types::EntitlementGrant {
            grant_id: format!("grant_{}", deal.deal_id),
            kind: crate::css_rights_engine::types::RightsGrantKind::Buyout,
            target: crate::css_rights_engine::types::RightsTarget {
                work_structure: crate::css_rights_engine::types::RightsWorkStructure::Single,
                unit: crate::css_rights_engine::types::RightsUnit::WholeWork,
                unit_id: None,
                lang: None,
            },
        },
    )
    .await?;
    crate::css_deal_engine::store_pg::mark_deal_completed(pool, deal_id).await?;
    let _ = crate::css_governance_timeline::runtime::apply_buyout_sale_credit_reward(
        pool,
        &deal.seller_user_id,
        &deal.deal_id,
        &now,
    )
    .await;
    Ok(())
}
