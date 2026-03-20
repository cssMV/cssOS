use crate::css_ownership_engine::types::{
    OwnershipTransferDecision, OwnershipTransferDecisionResult, OwnershipTransferIntent,
};

pub async fn request_transfer(
    pool: &sqlx::PgPool,
    intent: OwnershipTransferIntent,
) -> anyhow::Result<OwnershipTransferDecisionResult> {
    let ownership =
        crate::css_ownership_engine::store_pg::get_ownership(pool, &intent.ownership_id).await?;
    let decision = crate::css_ownership_engine::policy::can_request_transfer(&ownership);
    if matches!(decision.decision, OwnershipTransferDecision::Deny) {
        return Ok(decision);
    }
    crate::css_ownership_engine::store_pg::insert_transfer_intent(pool, &intent).await?;
    Ok(decision)
}

pub async fn accept_transfer(
    pool: &sqlx::PgPool,
    intent_id: &str,
    owner_user_id: &str,
) -> anyhow::Result<()> {
    let intent =
        crate::css_ownership_engine::store_pg::get_transfer_intent(pool, intent_id).await?;
    let ownership =
        crate::css_ownership_engine::store_pg::get_ownership(pool, &intent.ownership_id).await?;
    if ownership.owner_user_id != owner_user_id {
        anyhow::bail!("only current owner can accept transfer");
    }
    crate::css_ownership_engine::store_pg::transfer_ownership(
        pool,
        &ownership.ownership_id,
        &intent.buyer_user_id,
    )
    .await?;
    crate::css_ownership_engine::store_pg::mark_transfer_intent_accepted(pool, intent_id).await?;
    Ok(())
}

pub async fn reject_transfer(
    pool: &sqlx::PgPool,
    intent_id: &str,
    owner_user_id: &str,
) -> anyhow::Result<()> {
    let intent =
        crate::css_ownership_engine::store_pg::get_transfer_intent(pool, intent_id).await?;
    let ownership =
        crate::css_ownership_engine::store_pg::get_ownership(pool, &intent.ownership_id).await?;
    if ownership.owner_user_id != owner_user_id {
        anyhow::bail!("only current owner can reject transfer");
    }
    crate::css_ownership_engine::store_pg::mark_transfer_intent_rejected(pool, intent_id).await?;
    Ok(())
}
