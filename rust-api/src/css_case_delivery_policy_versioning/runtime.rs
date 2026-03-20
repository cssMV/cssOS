use crate::css_case_delivery_policy_engine::types::{
    CssCaseDeliveryPolicy, CssCaseDeliveryPolicyConfig, CssCaseDeliveryPolicyEvaluation,
};
use crate::css_case_delivery_policy_versioning::types::{
    ActivateDeliveryPolicyVersionRequest, CompareDeliveryPolicyVersionsRequest,
    CreateDeliveryPolicyVersionRequest, CssCaseDeliveryPolicyVersionDiff,
    CssCaseDeliveryPolicyVersioningView, DeliveryPolicyCompareResult, DeliveryPolicyConfigDiffItem,
    DeliveryPolicyFieldDiff, DeliveryPolicyVersionRecord, DeliveryPolicyVersionTimelineItem,
    DeliveryPolicyVersioningRequest, LegacyCompareDeliveryPolicyVersionsRequest,
};

async fn next_policy_version_number(pool: &sqlx::PgPool, policy_name: &str) -> anyhow::Result<i64> {
    let current = crate::css_case_delivery_policy_versioning::store_pg::get_latest_delivery_policy_version_number(
        pool,
        policy_name,
    )
    .await?;

    Ok(current.unwrap_or(0) + 1)
}

pub async fn build_delivery_policy_version_record(
    pool: &sqlx::PgPool,
    req: CreateDeliveryPolicyVersionRequest,
    now_rfc3339: &str,
) -> anyhow::Result<DeliveryPolicyVersionRecord> {
    let version = next_policy_version_number(pool, &req.policy_name).await?;

    Ok(DeliveryPolicyVersionRecord {
        policy_version_id: format!("cdpolv_{}", uuid::Uuid::new_v4()),
        policy_name: req.policy_name,
        version,
        config: req.config,
        is_active: false,
        created_at: now_rfc3339.to_string(),
        activated_at: None,
        created_by: None,
    })
}

pub async fn create_delivery_policy_version(
    pool: &sqlx::PgPool,
    req: CreateDeliveryPolicyVersionRequest,
    now_rfc3339: &str,
) -> anyhow::Result<DeliveryPolicyVersionRecord> {
    let record = build_delivery_policy_version_record(pool, req, now_rfc3339).await?;
    crate::css_case_delivery_policy_versioning::store_pg::insert_delivery_policy_version(
        pool, &record,
    )
    .await?;
    Ok(record)
}

pub async fn activate_delivery_policy_version(
    pool: &sqlx::PgPool,
    req: ActivateDeliveryPolicyVersionRequest,
    now_rfc3339: &str,
) -> anyhow::Result<DeliveryPolicyVersionRecord> {
    crate::css_case_delivery_policy_versioning::store_pg::deactivate_all_delivery_policy_versions(
        pool,
    )
    .await?;
    crate::css_case_delivery_policy_versioning::store_pg::activate_delivery_policy_version(
        pool,
        &req.policy_version_id,
        now_rfc3339,
    )
    .await?;

    crate::css_case_delivery_policy_versioning::store_pg::get_delivery_policy_version(
        pool,
        &req.policy_version_id,
    )
    .await?
    .ok_or_else(|| anyhow::anyhow!("policy version not found after activation"))
}

pub async fn get_or_create_active_delivery_policy_version(
    pool: &sqlx::PgPool,
    now_rfc3339: &str,
) -> anyhow::Result<DeliveryPolicyVersionRecord> {
    if let Some(active) =
        crate::css_case_delivery_policy_versioning::store_pg::get_active_delivery_policy_version(
            pool,
        )
        .await?
    {
        return Ok(active);
    }

    let first = create_delivery_policy_version(
        pool,
        CreateDeliveryPolicyVersionRequest {
            policy_name: "default_delivery_policy".into(),
            config: crate::css_case_delivery_policy_engine::runtime::default_delivery_policy_config(
            ),
        },
        now_rfc3339,
    )
    .await?;

    activate_delivery_policy_version(
        pool,
        ActivateDeliveryPolicyVersionRequest {
            policy_version_id: first.policy_version_id.clone(),
        },
        now_rfc3339,
    )
    .await
}

pub async fn evaluate_delivery_policy_versioned(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_policy_engine::types::DeliveryPolicyEvaluationRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryPolicyEvaluation> {
    let active = get_or_create_active_delivery_policy_version(pool, now_rfc3339).await?;

    let rules =
        crate::css_case_delivery_policy_engine::runtime::governance_rules_from_policy_config(
            &active.config,
        );

    let decision = crate::css_case_delivery_governance::runtime::evaluate_delivery_governance(
        &rules,
        crate::css_case_delivery_governance::types::DeliveryGovernanceInput {
            target: req.target,
            consecutive_failures: req.consecutive_failures,
            latest_failed: req.latest_failed,
        },
    );

    Ok(CssCaseDeliveryPolicyEvaluation {
        policy_id: active.policy_version_id,
        policy_name: format!("{}@v{}", active.policy_name, active.version),
        decision,
    })
}

pub fn diff_policy_configs(
    from: &CssCaseDeliveryPolicyConfig,
    to: &CssCaseDeliveryPolicyConfig,
    from_id: String,
    to_id: String,
) -> CssCaseDeliveryPolicyVersionDiff {
    let mut changes = Vec::new();

    if from.escalate_after_consecutive_failures != to.escalate_after_consecutive_failures {
        changes.push(DeliveryPolicyConfigDiffItem {
            field: "escalate_after_consecutive_failures".into(),
            before: from.escalate_after_consecutive_failures.to_string(),
            after: to.escalate_after_consecutive_failures.to_string(),
        });
    }

    if from.manual_intervention_after_consecutive_failures
        != to.manual_intervention_after_consecutive_failures
    {
        changes.push(DeliveryPolicyConfigDiffItem {
            field: "manual_intervention_after_consecutive_failures".into(),
            before: from
                .manual_intervention_after_consecutive_failures
                .to_string(),
            after: to
                .manual_intervention_after_consecutive_failures
                .to_string(),
        });
    }

    if from.must_deliver_targets != to.must_deliver_targets {
        changes.push(DeliveryPolicyConfigDiffItem {
            field: "must_deliver_targets".into(),
            before: format!("{:?}", from.must_deliver_targets),
            after: format!("{:?}", to.must_deliver_targets),
        });
    }

    if from.no_silent_failure_targets != to.no_silent_failure_targets {
        changes.push(DeliveryPolicyConfigDiffItem {
            field: "no_silent_failure_targets".into(),
            before: format!("{:?}", from.no_silent_failure_targets),
            after: format!("{:?}", to.no_silent_failure_targets),
        });
    }

    CssCaseDeliveryPolicyVersionDiff {
        from_policy_version_id: from_id,
        to_policy_version_id: to_id,
        changes,
    }
}

pub async fn load_delivery_policy_versioning_view(
    pool: &sqlx::PgPool,
) -> anyhow::Result<CssCaseDeliveryPolicyVersioningView> {
    let mut versions =
        crate::css_case_delivery_policy_versioning::store_pg::list_delivery_policy_versions(pool)
            .await
            .unwrap_or_default();
    versions.sort_by(|a, b| a.created_at.cmp(&b.created_at));

    let active = versions.iter().find(|v| v.is_active).cloned();
    let mut timeline = Vec::new();

    for version in &versions {
        timeline.push(DeliveryPolicyVersionTimelineItem {
            policy_version_id: version.policy_version_id.clone(),
            version: format!("v{}", version.version),
            event: "created".into(),
            occurred_at: version.created_at.clone(),
            actor_user_id: version.created_by.clone(),
        });

        if version.is_active {
            timeline.push(DeliveryPolicyVersionTimelineItem {
                policy_version_id: version.policy_version_id.clone(),
                version: format!("v{}", version.version),
                event: "activated".into(),
                occurred_at: version
                    .activated_at
                    .clone()
                    .unwrap_or_else(|| version.created_at.clone()),
                actor_user_id: version.created_by.clone(),
            });
        }
    }

    Ok(CssCaseDeliveryPolicyVersioningView {
        active,
        versions,
        timeline,
    })
}

pub async fn compare_delivery_policy_versions(
    pool: &sqlx::PgPool,
    req: CompareDeliveryPolicyVersionsRequest,
) -> anyhow::Result<CssCaseDeliveryPolicyVersionDiff> {
    let left = crate::css_case_delivery_policy_versioning::store_pg::get_delivery_policy_version(
        pool,
        &req.left_policy_version_id,
    )
    .await?
    .ok_or_else(|| anyhow::anyhow!("left policy version not found"))?;
    let right = crate::css_case_delivery_policy_versioning::store_pg::get_delivery_policy_version(
        pool,
        &req.right_policy_version_id,
    )
    .await?
    .ok_or_else(|| anyhow::anyhow!("right policy version not found"))?;

    Ok(diff_policy_configs(
        &left.config,
        &right.config,
        left.policy_version_id,
        right.policy_version_id,
    ))
}

// Legacy-kept wrappers for current callers.

pub async fn load_policy_versioning_view(
    pool: &sqlx::PgPool,
    _req: DeliveryPolicyVersioningRequest,
) -> anyhow::Result<CssCaseDeliveryPolicyVersioningView> {
    load_delivery_policy_versioning_view(pool).await
}

pub async fn activate_policy_version(
    pool: &sqlx::PgPool,
    req: ActivateDeliveryPolicyVersionRequest,
) -> anyhow::Result<()> {
    let _ = activate_delivery_policy_version(pool, req, &crate::timeutil::now_rfc3339()).await?;
    Ok(())
}

pub fn version_record_policy(
    record: &DeliveryPolicyVersionRecord,
) -> crate::css_case_delivery_policy_engine::types::DeliveryPolicyRecord {
    crate::css_case_delivery_policy_engine::runtime::legacy_record_from_record(
        crate::css_case_delivery_policy_engine::types::CssCaseDeliveryPolicyRecord {
            policy_id: record.policy_version_id.clone(),
            policy_name: record.policy_name.clone(),
            config: record.config.clone(),
            is_active: record.is_active,
            created_at: record.created_at.clone(),
        },
    )
}

pub async fn compare_policy_versions(
    pool: &sqlx::PgPool,
    req: LegacyCompareDeliveryPolicyVersionsRequest,
) -> anyhow::Result<DeliveryPolicyCompareResult> {
    let from = crate::css_case_delivery_policy_versioning::store_pg::get_delivery_policy_version(
        pool,
        &req.from_policy_id,
    )
    .await?
    .ok_or_else(|| anyhow::anyhow!("from policy not found"))?;
    let to = crate::css_case_delivery_policy_versioning::store_pg::get_delivery_policy_version(
        pool,
        &req.to_policy_id,
    )
    .await?
    .ok_or_else(|| anyhow::anyhow!("to policy not found"))?;

    let diff = diff_policy_configs(
        &from.config,
        &to.config,
        from.policy_version_id.clone(),
        to.policy_version_id.clone(),
    );

    Ok(DeliveryPolicyCompareResult {
        from_policy_id: from.policy_version_id.clone(),
        from_version: from.version as i32,
        to_policy_id: to.policy_version_id.clone(),
        to_version: to.version as i32,
        diffs: diff
            .changes
            .into_iter()
            .map(|item| DeliveryPolicyFieldDiff {
                field_path: item.field,
                before: Some(item.before),
                after: Some(item.after),
            })
            .collect(),
    })
}

pub fn to_legacy_policy(record: &DeliveryPolicyVersionRecord) -> CssCaseDeliveryPolicy {
    crate::css_case_delivery_policy_engine::runtime::legacy_policy_from_record(
        crate::css_case_delivery_policy_engine::types::CssCaseDeliveryPolicyRecord {
            policy_id: record.policy_version_id.clone(),
            policy_name: record.policy_name.clone(),
            config: record.config.clone(),
            is_active: record.is_active,
            created_at: record.created_at.clone(),
        },
    )
}
