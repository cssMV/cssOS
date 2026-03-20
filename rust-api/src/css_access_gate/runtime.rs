use crate::css_access_gate::types::{
    AccessAction, AccessTarget, CssAccessDecision, CssAccessRequest,
};

pub async fn check_access(
    pool: &sqlx::PgPool,
    req: CssAccessRequest,
    is_priceless: bool,
) -> anyhow::Result<CssAccessDecision> {
    let ent_req = crate::css_entitlement::types::EntitlementAccessRequest {
        user_id: req.user_id.clone(),
        kind: crate::css_access_gate::policy::map_action_to_rights_kind(&req.action),
        target: crate::css_access_gate::policy::map_access_target(&req.target),
    };
    let ent_result = crate::css_entitlement::runtime::check_access(pool, ent_req).await?;
    Ok(crate::css_access_gate::policy::evaluate_access(
        &ent_result,
        &req,
        is_priceless,
    ))
}

pub async fn check_listen_access(
    pool: &sqlx::PgPool,
    user_id: String,
    target: AccessTarget,
) -> anyhow::Result<CssAccessDecision> {
    check_access(
        pool,
        CssAccessRequest {
            user_id,
            action: AccessAction::Listen,
            target,
        },
        false,
    )
    .await
}

pub async fn check_preview_access(
    pool: &sqlx::PgPool,
    user_id: String,
    target: AccessTarget,
) -> anyhow::Result<CssAccessDecision> {
    check_access(
        pool,
        CssAccessRequest {
            user_id,
            action: AccessAction::Preview,
            target,
        },
        false,
    )
    .await
}
