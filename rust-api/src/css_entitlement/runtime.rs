use crate::css_entitlement::types::{
    EntitlementAccessRequest, EntitlementAccessResult, EntitlementGrant,
};

pub async fn check_access(
    _pool: &sqlx::PgPool,
    _req: EntitlementAccessRequest,
) -> anyhow::Result<EntitlementAccessResult> {
    Ok(EntitlementAccessResult {
        allowed: false,
        code: "entitlement_not_found".into(),
        message: "当前用户尚未持有对应 entitlement。".into(),
    })
}

pub async fn issue_entitlement(
    _pool: &sqlx::PgPool,
    _user_id: String,
    _grant: EntitlementGrant,
) -> anyhow::Result<()> {
    Ok(())
}
