use crate::css_case_delivery_policy_audit::types::{
    CreateDeliveryPolicyAuditRequest, CssCaseDeliveryPolicyAuditRecord, DeliveryPolicyAuditAction,
    DeliveryPolicyAuditCreateRequest,
};

pub fn build_delivery_policy_audit_record(
    req: DeliveryPolicyAuditCreateRequest,
    now_rfc3339: &str,
) -> CssCaseDeliveryPolicyAuditRecord {
    CssCaseDeliveryPolicyAuditRecord {
        policy_audit_id: format!("cdpola_{}", uuid::Uuid::new_v4()),
        actor_user_id: req.actor_user_id,
        action: req.action,
        from_policy_version_id: req.from_policy_version_id,
        to_policy_version_id: req.to_policy_version_id,
        reason: req.reason,
        created_at: now_rfc3339.to_string(),
    }
}

pub async fn write_delivery_policy_audit(
    pool: &sqlx::PgPool,
    req: DeliveryPolicyAuditCreateRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryPolicyAuditRecord> {
    let record = build_delivery_policy_audit_record(req, now_rfc3339);
    crate::css_case_delivery_policy_audit::store_pg::insert_delivery_policy_audit(pool, &record)
        .await?;
    Ok(record)
}

pub async fn create_policy_version_and_audit(
    pool: &sqlx::PgPool,
    actor_user_id: String,
    req: crate::css_case_delivery_policy_versioning::types::CreateDeliveryPolicyVersionRequest,
    reason: Option<String>,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_policy_versioning::types::DeliveryPolicyVersionRecord>
{
    let record =
        crate::css_case_delivery_policy_versioning::runtime::create_delivery_policy_version(
            pool,
            req,
            now_rfc3339,
        )
        .await?;

    let _ = write_delivery_policy_audit(
        pool,
        CreateDeliveryPolicyAuditRequest {
            actor_user_id,
            action: DeliveryPolicyAuditAction::Created,
            from_policy_version_id: None,
            to_policy_version_id: Some(record.policy_version_id.clone()),
            reason,
        },
        now_rfc3339,
    )
    .await?;

    Ok(record)
}

pub async fn activate_policy_version_and_audit(
    pool: &sqlx::PgPool,
    actor_user_id: String,
    req: crate::css_case_delivery_policy_versioning::types::ActivateDeliveryPolicyVersionRequest,
    reason: Option<String>,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_policy_versioning::types::DeliveryPolicyVersionRecord>
{
    let previous_active =
        crate::css_case_delivery_policy_versioning::store_pg::get_active_delivery_policy_version(
            pool,
        )
        .await?;

    let active =
        crate::css_case_delivery_policy_versioning::runtime::activate_delivery_policy_version(
            pool,
            req,
            now_rfc3339,
        )
        .await?;

    let action = if previous_active.is_some() {
        DeliveryPolicyAuditAction::Switched
    } else {
        DeliveryPolicyAuditAction::Activated
    };

    let _ = write_delivery_policy_audit(
        pool,
        CreateDeliveryPolicyAuditRequest {
            actor_user_id,
            action,
            from_policy_version_id: previous_active.map(|x| x.policy_version_id),
            to_policy_version_id: Some(active.policy_version_id.clone()),
            reason,
        },
        now_rfc3339,
    )
    .await?;

    Ok(active)
}

pub async fn compare_policy_versions_and_audit(
    pool: &sqlx::PgPool,
    actor_user_id: String,
    from_policy_version_id: String,
    to_policy_version_id: String,
    reason: Option<String>,
    now_rfc3339: &str,
) -> anyhow::Result<
    crate::css_case_delivery_policy_versioning::types::CssCaseDeliveryPolicyVersionDiff,
> {
    let from = crate::css_case_delivery_policy_versioning::store_pg::get_delivery_policy_version(
        pool,
        &from_policy_version_id,
    )
    .await?
    .ok_or_else(|| anyhow::anyhow!("from version not found"))?;

    let to = crate::css_case_delivery_policy_versioning::store_pg::get_delivery_policy_version(
        pool,
        &to_policy_version_id,
    )
    .await?
    .ok_or_else(|| anyhow::anyhow!("to version not found"))?;

    let diff = crate::css_case_delivery_policy_versioning::runtime::diff_policy_configs(
        &from.config,
        &to.config,
        from.policy_version_id.clone(),
        to.policy_version_id.clone(),
    );

    let _ = write_delivery_policy_audit(
        pool,
        CreateDeliveryPolicyAuditRequest {
            actor_user_id,
            action: DeliveryPolicyAuditAction::Compared,
            from_policy_version_id: Some(from.policy_version_id),
            to_policy_version_id: Some(to.policy_version_id),
            reason,
        },
        now_rfc3339,
    )
    .await?;

    Ok(diff)
}

pub async fn rollback_policy_version_and_audit(
    pool: &sqlx::PgPool,
    actor_user_id: String,
    to_policy_version_id: String,
    reason: Option<String>,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_policy_versioning::types::DeliveryPolicyVersionRecord>
{
    let previous_active =
        crate::css_case_delivery_policy_versioning::store_pg::get_active_delivery_policy_version(
            pool,
        )
        .await?;

    let active =
        crate::css_case_delivery_policy_versioning::runtime::activate_delivery_policy_version(
            pool,
            crate::css_case_delivery_policy_versioning::types::ActivateDeliveryPolicyVersionRequest {
                policy_version_id: to_policy_version_id,
            },
            now_rfc3339,
        )
        .await?;

    let _ = write_delivery_policy_audit(
        pool,
        CreateDeliveryPolicyAuditRequest {
            actor_user_id,
            action: DeliveryPolicyAuditAction::RolledBack,
            from_policy_version_id: previous_active.map(|x| x.policy_version_id),
            to_policy_version_id: Some(active.policy_version_id.clone()),
            reason,
        },
        now_rfc3339,
    )
    .await?;

    Ok(active)
}

pub async fn audit_create_version(
    pool: &sqlx::PgPool,
    actor_user_id: String,
    policy_version_id: String,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryPolicyAuditRecord> {
    write_delivery_policy_audit(
        pool,
        CreateDeliveryPolicyAuditRequest {
            actor_user_id,
            action: DeliveryPolicyAuditAction::Created,
            from_policy_version_id: None,
            to_policy_version_id: Some(policy_version_id),
            reason: Some("delivery policy version created".into()),
        },
        now_rfc3339,
    )
    .await
}

pub async fn audit_switch_active_version(
    pool: &sqlx::PgPool,
    actor_user_id: String,
    from_policy_version_id: Option<String>,
    to_policy_version_id: String,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryPolicyAuditRecord> {
    let action = if from_policy_version_id.is_some() {
        DeliveryPolicyAuditAction::Switched
    } else {
        DeliveryPolicyAuditAction::Activated
    };

    write_delivery_policy_audit(
        pool,
        CreateDeliveryPolicyAuditRequest {
            actor_user_id,
            action,
            from_policy_version_id,
            to_policy_version_id: Some(to_policy_version_id),
            reason: Some("active delivery policy version switched".into()),
        },
        now_rfc3339,
    )
    .await
}

pub async fn audit_compare_versions(
    pool: &sqlx::PgPool,
    actor_user_id: String,
    left_policy_version_id: String,
    right_policy_version_id: String,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryPolicyAuditRecord> {
    write_delivery_policy_audit(
        pool,
        CreateDeliveryPolicyAuditRequest {
            actor_user_id,
            action: DeliveryPolicyAuditAction::Compared,
            from_policy_version_id: Some(left_policy_version_id),
            to_policy_version_id: Some(right_policy_version_id),
            reason: Some("delivery policy versions compared".into()),
        },
        now_rfc3339,
    )
    .await
}

pub async fn audit_rollback_version(
    pool: &sqlx::PgPool,
    actor_user_id: String,
    from_policy_version_id: String,
    to_policy_version_id: String,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryPolicyAuditRecord> {
    write_delivery_policy_audit(
        pool,
        CreateDeliveryPolicyAuditRequest {
            actor_user_id,
            action: DeliveryPolicyAuditAction::RolledBack,
            from_policy_version_id: Some(from_policy_version_id),
            to_policy_version_id: Some(to_policy_version_id),
            reason: Some("delivery policy version rolled back".into()),
        },
        now_rfc3339,
    )
    .await
}

pub fn build_policy_audit_record(
    req: DeliveryPolicyAuditCreateRequest,
    now_rfc3339: &str,
) -> CssCaseDeliveryPolicyAuditRecord {
    build_delivery_policy_audit_record(req, now_rfc3339)
}

pub async fn write_policy_audit(
    pool: &sqlx::PgPool,
    req: DeliveryPolicyAuditCreateRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryPolicyAuditRecord> {
    write_delivery_policy_audit(pool, req, now_rfc3339).await
}

pub async fn audit_policy_created(
    pool: &sqlx::PgPool,
    policy: &crate::css_case_delivery_policy_engine::types::CssCaseDeliveryPolicy,
    actor_user_id: Option<String>,
    now_rfc3339: &str,
) -> anyhow::Result<()> {
    let _ = audit_create_version(
        pool,
        actor_user_id.unwrap_or_else(|| "system".into()),
        policy.policy_id.clone(),
        now_rfc3339,
    )
    .await?;
    Ok(())
}

pub async fn audit_policy_activated(
    pool: &sqlx::PgPool,
    from_policy: Option<&crate::css_case_delivery_policy_engine::types::CssCaseDeliveryPolicy>,
    to_policy: &crate::css_case_delivery_policy_engine::types::CssCaseDeliveryPolicy,
    actor_user_id: String,
    now_rfc3339: &str,
) -> anyhow::Result<()> {
    let _ = audit_switch_active_version(
        pool,
        actor_user_id,
        from_policy.map(|p| p.policy_id.clone()),
        to_policy.policy_id.clone(),
        now_rfc3339,
    )
    .await?;
    Ok(())
}

pub async fn audit_policy_compared(
    pool: &sqlx::PgPool,
    compare: &crate::css_case_delivery_policy_versioning::types::DeliveryPolicyCompareResult,
    actor_user_id: String,
    now_rfc3339: &str,
) -> anyhow::Result<()> {
    let _ = audit_compare_versions(
        pool,
        actor_user_id,
        compare.from_policy_id.clone(),
        compare.to_policy_id.clone(),
        now_rfc3339,
    )
    .await?;
    Ok(())
}

pub async fn audit_policy_rolled_back(
    pool: &sqlx::PgPool,
    from_policy: &crate::css_case_delivery_policy_engine::types::CssCaseDeliveryPolicy,
    to_policy: &crate::css_case_delivery_policy_engine::types::CssCaseDeliveryPolicy,
    actor_user_id: String,
    now_rfc3339: &str,
) -> anyhow::Result<()> {
    let _ = audit_rollback_version(
        pool,
        actor_user_id,
        from_policy.policy_id.clone(),
        to_policy.policy_id.clone(),
        now_rfc3339,
    )
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    #[test]
    fn v315_build_policy_audit_record_sets_created_action() {
        let record = super::build_policy_audit_record(
            crate::css_case_delivery_policy_audit::types::DeliveryPolicyAuditCreateRequest {
                actor_user_id: "ops_1".into(),
                action:
                    crate::css_case_delivery_policy_audit::types::DeliveryPolicyAuditAction::Created,
                from_policy_version_id: None,
                to_policy_version_id: Some("policy_v1".into()),
                reason: Some("created".into()),
            },
            "2026-03-13T00:00:00Z",
        );

        assert_eq!(
            record.action,
            crate::css_case_delivery_policy_audit::types::DeliveryPolicyAuditAction::Created
        );
        assert_eq!(record.to_policy_version_id.as_deref(), Some("policy_v1"));
    }
}
