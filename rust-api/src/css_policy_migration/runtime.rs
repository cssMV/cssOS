use crate::css_governance_timeline::types::{
    TimelineAppendRequest, TimelineEventKind, TimelineSubjectKind,
};
use crate::css_policy_migration::types::{
    MigrationDecision, MigrationSubjectKind, PolicyMigrationRecord, PolicyMigrationStatus,
};
use crate::css_policy_versioning::types::PolicyBindingSubjectKind;

pub async fn plan_migration(
    pool: &sqlx::PgPool,
    subject_kind: MigrationSubjectKind,
    subject_id: &str,
    from_version_id: &str,
    to_version_id: &str,
    reason: &str,
    requested_by_user_id: Option<String>,
    now_rfc3339: &str,
) -> anyhow::Result<PolicyMigrationRecord> {
    let record = PolicyMigrationRecord {
        migration_id: format!("pmig_{}", uuid::Uuid::new_v4()),
        subject_kind,
        subject_id: subject_id.to_string(),
        from_version_id: from_version_id.to_string(),
        to_version_id: to_version_id.to_string(),
        status: PolicyMigrationStatus::Planned,
        reason: reason.to_string(),
        requested_by_user_id,
        created_at: now_rfc3339.to_string(),
    };

    crate::css_policy_migration::store_pg::insert_policy_migration(pool, &record).await?;
    append_timeline_event(
        pool,
        &record,
        TimelineEventKind::PolicyMigrationPlanned,
        now_rfc3339,
    )
    .await?;
    Ok(record)
}

pub async fn dry_run_migration(
    pool: &sqlx::PgPool,
    migration_id: &str,
) -> anyhow::Result<MigrationDecision> {
    let migration =
        crate::css_policy_migration::store_pg::get_policy_migration(pool, migration_id).await?;

    let decision = match migration.subject_kind {
        MigrationSubjectKind::Catalog => {
            crate::css_policy_migration::policy::catalog_migration_allowed()
        }
        MigrationSubjectKind::Auction => {
            let snapshot =
                crate::css_bid_ledger::runtime::build_snapshot(pool, &migration.subject_id).await?;
            crate::css_policy_migration::policy::auction_migration_allowed(snapshot.finalized)
        }
        MigrationSubjectKind::Deal => {
            match crate::css_deal_engine::store_pg::get_deal(pool, &migration.subject_id).await {
                Ok(deal) => crate::css_policy_migration::policy::deal_migration_allowed(
                    &format!("{:?}", deal.status).to_lowercase(),
                ),
                Err(err) => MigrationDecision {
                    allowed: false,
                    code: "deal_lookup_failed".into(),
                    message: format!("无法判断 deal 是否可迁移：{err}"),
                },
            }
        }
        MigrationSubjectKind::Ownership => {
            crate::css_policy_migration::policy::ownership_migration_allowed()
        }
        MigrationSubjectKind::UserFlow => MigrationDecision {
            allowed: true,
            code: "user_flow_migration_allowed".into(),
            message: "user flow 允许切换默认 policy 版本。".into(),
        },
    };

    let status = if decision.allowed {
        PolicyMigrationStatus::DryRunPassed
    } else {
        PolicyMigrationStatus::DryRunBlocked
    };
    crate::css_policy_migration::store_pg::update_policy_migration_status(
        pool,
        migration_id,
        status,
    )
    .await?;

    if !decision.allowed {
        let migration =
            crate::css_policy_migration::store_pg::get_policy_migration(pool, migration_id).await?;
        append_timeline_event(
            pool,
            &migration,
            TimelineEventKind::PolicyMigrationRejected,
            &migration.created_at,
        )
        .await?;
    }

    Ok(decision)
}

pub async fn apply_migration(
    pool: &sqlx::PgPool,
    migration_id: &str,
    now_rfc3339: &str,
) -> anyhow::Result<()> {
    let migration =
        crate::css_policy_migration::store_pg::get_policy_migration(pool, migration_id).await?;
    let decision = dry_run_migration(pool, migration_id).await?;
    if !decision.allowed {
        anyhow::bail!("{}", decision.message);
    }

    crate::css_policy_versioning::runtime::bind_policy_version(
        pool,
        binding_kind_for_subject(&migration.subject_kind),
        &migration.subject_id,
        &migration.to_version_id,
        now_rfc3339,
    )
    .await?;

    crate::css_policy_migration::store_pg::update_policy_migration_status(
        pool,
        migration_id,
        PolicyMigrationStatus::Applied,
    )
    .await?;

    append_timeline_event(
        pool,
        &migration,
        TimelineEventKind::PolicyMigrationApplied,
        now_rfc3339,
    )
    .await?;
    Ok(())
}

fn binding_kind_for_subject(kind: &MigrationSubjectKind) -> PolicyBindingSubjectKind {
    match kind {
        MigrationSubjectKind::Catalog => PolicyBindingSubjectKind::Catalog,
        MigrationSubjectKind::Auction => PolicyBindingSubjectKind::Auction,
        MigrationSubjectKind::Deal => PolicyBindingSubjectKind::Deal,
        MigrationSubjectKind::Ownership => PolicyBindingSubjectKind::Ownership,
        MigrationSubjectKind::UserFlow => PolicyBindingSubjectKind::UserFlow,
    }
}

fn timeline_subject_kind(kind: &MigrationSubjectKind) -> TimelineSubjectKind {
    match kind {
        MigrationSubjectKind::Catalog => TimelineSubjectKind::Catalog,
        MigrationSubjectKind::Auction => TimelineSubjectKind::Auction,
        MigrationSubjectKind::Deal => TimelineSubjectKind::Deal,
        MigrationSubjectKind::Ownership => TimelineSubjectKind::Ownership,
        MigrationSubjectKind::UserFlow => TimelineSubjectKind::User,
    }
}

async fn append_timeline_event(
    pool: &sqlx::PgPool,
    migration: &PolicyMigrationRecord,
    event_kind: TimelineEventKind,
    now_rfc3339: &str,
) -> anyhow::Result<()> {
    let message = match event_kind {
        TimelineEventKind::PolicyMigrationPlanned => format!(
            "policy migration 已计划：{} -> {}",
            migration.from_version_id, migration.to_version_id
        ),
        TimelineEventKind::PolicyMigrationApplied => format!(
            "policy migration 已应用：{} -> {}",
            migration.from_version_id, migration.to_version_id
        ),
        TimelineEventKind::PolicyMigrationRejected => format!(
            "policy migration 被阻断：{} -> {}",
            migration.from_version_id, migration.to_version_id
        ),
        _ => "policy migration event".into(),
    };

    crate::css_governance_timeline::runtime::append_event(
        pool,
        TimelineAppendRequest {
            subject_kind: timeline_subject_kind(&migration.subject_kind),
            subject_id: migration.subject_id.clone(),
            event_kind,
            source_system: "css_policy_migration".into(),
            source_id: migration.migration_id.clone(),
            message,
            actor_user_id: migration.requested_by_user_id.clone(),
            credit_score_before: None,
            credit_score_after: None,
            credit_delta: None,
        },
        now_rfc3339,
    )
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v173_binding_kind_matches_versioning_subjects() {
        assert!(matches!(
            binding_kind_for_subject(&MigrationSubjectKind::Catalog),
            PolicyBindingSubjectKind::Catalog
        ));
        assert!(matches!(
            binding_kind_for_subject(&MigrationSubjectKind::UserFlow),
            PolicyBindingSubjectKind::UserFlow
        ));
    }
}
