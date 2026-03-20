fn reason_from_legacy_kind(
    kind: &crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationEventKind,
) -> crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationReason {
    use crate::css_case_delivery_signals_invalidation::types::{
        DeliverySignalsInvalidationEventKind as LegacyKind,
        DeliverySignalsInvalidationReason as Reason,
    };

    match kind {
        LegacyKind::DeliveryLogInserted => Reason::DeliveryLogChanged,
        LegacyKind::RetryResultChanged => Reason::RetryResultChanged,
        LegacyKind::PolicyActiveSwitched => Reason::PolicyActiveVersionChanged,
        LegacyKind::GovernanceDecisionChanged => Reason::GovernanceDecisionChanged,
        LegacyKind::RecoveryStatusChanged => Reason::RecoveryStateChanged,
    }
}

fn scope_from_legacy_event(
    event: &crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationEvent,
) -> crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationScope {
    crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationScope {
        target: event
            .target
            .as_ref()
            .map(crate::css_case_delivery_decision_trace::runtime::api_target_from_log_target),
        consecutive_failures: None,
        latest_failed: None,
    }
}

fn scope_kind(
    scope: &crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationScope,
) -> crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationScopeKind {
    if scope.target.is_none()
        && scope.consecutive_failures.is_none()
        && scope.latest_failed.is_none()
    {
        crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationScopeKind::Global
    } else {
        crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationScopeKind::SingleSubject
    }
}

pub fn build_delivery_signals_invalidation_record(
    req: crate::css_case_delivery_signals_invalidation::types::CreateDeliverySignalsInvalidationRequest,
    now_rfc3339: &str,
) -> crate::css_case_delivery_signals_invalidation::types::CssCaseDeliverySignalsInvalidationRecord
{
    crate::css_case_delivery_signals_invalidation::types::CssCaseDeliverySignalsInvalidationRecord {
        invalidation_id: format!("cdsiginv_{}", uuid::Uuid::new_v4()),
        reason: req.reason,
        scope: req.scope,
        created_at: now_rfc3339.to_string(),
    }
}

pub async fn write_delivery_signals_invalidation(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_signals_invalidation::types::CreateDeliverySignalsInvalidationRequest,
    now_rfc3339: &str,
) -> anyhow::Result<
    crate::css_case_delivery_signals_invalidation::types::CssCaseDeliverySignalsInvalidationRecord,
> {
    let record = build_delivery_signals_invalidation_record(req, now_rfc3339);
    crate::css_case_delivery_signals_invalidation::store_pg::insert_delivery_signals_invalidation(
        pool, &record,
    )
    .await?;
    Ok(record)
}

pub fn scope_matches_cache_key(
    scope: &crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationScope,
    key: &crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheKey,
) -> bool {
    if let Some(target) = &scope.target {
        if &key.target != target {
            return false;
        }
    }

    if let Some(consecutive_failures) = scope.consecutive_failures {
        if key.consecutive_failures != consecutive_failures {
            return false;
        }
    }

    if let Some(latest_failed) = scope.latest_failed {
        if key.latest_failed != latest_failed {
            return false;
        }
    }

    true
}

pub async fn is_delivery_signals_cache_invalidated(
    pool: &sqlx::PgPool,
    record: &crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheRecord,
) -> anyhow::Result<bool> {
    let invalidations =
        crate::css_case_delivery_signals_invalidation::store_pg::list_delivery_signals_invalidations_since(
            pool,
            &record.updated_at,
        )
        .await
        .unwrap_or_default();

    Ok(invalidations.into_iter().any(|inv| {
        inv.created_at > record.updated_at && scope_matches_cache_key(&inv.scope, &record.cache_key)
    }))
}

pub async fn get_valid_or_rebuild_delivery_signals_cache(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_signals_cache::types::GetDeliverySignalsCacheRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheRecord> {
    if let Some(record) =
        crate::css_case_delivery_signals_cache::runtime::get_delivery_signals_cache(
            pool,
            req.clone(),
        )
        .await?
    {
        if !is_delivery_signals_cache_invalidated(pool, &record).await? {
            return Ok(record);
        }
    }

    crate::css_case_delivery_signals_cache::runtime::refresh_delivery_signals_cache(
        pool,
        crate::css_case_delivery_signals_cache::types::RefreshDeliverySignalsCacheRequest {
            target: req.target,
            consecutive_failures: req.consecutive_failures,
            latest_failed: req.latest_failed,
        },
        now_rfc3339,
    )
    .await
}

pub async fn invalidate_for_delivery_log_change(
    pool: &sqlx::PgPool,
    target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    consecutive_failures: usize,
    latest_failed: bool,
    now_rfc3339: &str,
) -> anyhow::Result<()> {
    write_delivery_signals_invalidation(
        pool,
        crate::css_case_delivery_signals_invalidation::types::CreateDeliverySignalsInvalidationRequest {
            reason: crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationReason::DeliveryLogChanged,
            scope: crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationScope {
                target: Some(target),
                consecutive_failures: Some(consecutive_failures),
                latest_failed: Some(latest_failed),
            },
        },
        now_rfc3339,
    )
    .await?;
    Ok(())
}

pub async fn invalidate_for_policy_active_version_change(
    pool: &sqlx::PgPool,
    now_rfc3339: &str,
) -> anyhow::Result<()> {
    write_delivery_signals_invalidation(
        pool,
        crate::css_case_delivery_signals_invalidation::types::CreateDeliverySignalsInvalidationRequest {
            reason: crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationReason::PolicyActiveVersionChanged,
            scope: crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationScope::default(),
        },
        now_rfc3339,
    )
    .await?;
    Ok(())
}

pub async fn invalidate_from_event(
    pool: &sqlx::PgPool,
    event: crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationEvent,
) -> anyhow::Result<
    crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationResult,
> {
    let scope = scope_from_legacy_event(&event);
    let scope_kind = scope_kind(&scope);

    let record = write_delivery_signals_invalidation(
        pool,
        crate::css_case_delivery_signals_invalidation::types::CreateDeliverySignalsInvalidationRequest {
            reason: reason_from_legacy_kind(&event.kind),
            scope: scope.clone(),
        },
        &event.occurred_at,
    )
    .await?;

    Ok(
        crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationResult {
            invalidated: true,
            scope: scope_kind,
            invalidated_subject_keys: event
                .target
                .zip(event.mode)
                .map(|(target, mode)| {
                    vec![
                        crate::css_case_delivery_signals_cache::runtime::subject_key(
                            &target, &mode,
                        ),
                    ]
                })
                .unwrap_or_default(),
            message: format!(
                "recorded delivery signals invalidation {}",
                record.invalidation_id
            ),
        },
    )
}

pub async fn invalidate_delivery_signals_cache(
    pool: &sqlx::PgPool,
    event: crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationEvent,
) -> anyhow::Result<
    crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationResult,
> {
    invalidate_from_event(pool, event).await
}

pub async fn invalidate_on_delivery_log_appended(
    pool: &sqlx::PgPool,
    target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    occurred_at: &str,
) -> anyhow::Result<
    crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationResult,
> {
    invalidate_from_event(
        pool,
        crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationEvent {
            kind: crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationEventKind::DeliveryLogInserted,
            target: Some(target),
            mode: Some(mode),
            occurred_at: occurred_at.to_string(),
        },
    )
    .await
}

pub async fn invalidate_on_retry_outcome_changed(
    pool: &sqlx::PgPool,
    target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    occurred_at: &str,
) -> anyhow::Result<
    crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationResult,
> {
    invalidate_from_event(
        pool,
        crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationEvent {
            kind: crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationEventKind::RetryResultChanged,
            target: Some(target),
            mode: Some(mode),
            occurred_at: occurred_at.to_string(),
        },
    )
    .await
}

pub async fn invalidate_on_active_policy_version_switched(
    pool: &sqlx::PgPool,
    target: Option<crate::css_case_delivery_log::types::CaseDeliveryLogTarget>,
    mode: Option<crate::css_case_delivery_log::types::CaseDeliveryLogMode>,
    occurred_at: &str,
) -> anyhow::Result<
    crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationResult,
> {
    invalidate_from_event(
        pool,
        crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationEvent {
            kind: crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationEventKind::PolicyActiveSwitched,
            target,
            mode,
            occurred_at: occurred_at.to_string(),
        },
    )
    .await
}

pub async fn invalidate_on_governance_decision_changed(
    pool: &sqlx::PgPool,
    target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    occurred_at: &str,
) -> anyhow::Result<
    crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationResult,
> {
    invalidate_from_event(
        pool,
        crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationEvent {
            kind: crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationEventKind::GovernanceDecisionChanged,
            target: Some(target),
            mode: Some(mode),
            occurred_at: occurred_at.to_string(),
        },
    )
    .await
}

pub async fn invalidate_on_recovery_state_changed(
    pool: &sqlx::PgPool,
    target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    occurred_at: &str,
) -> anyhow::Result<
    crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationResult,
> {
    invalidate_from_event(
        pool,
        crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationEvent {
            kind: crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationEventKind::RecoveryStatusChanged,
            target: Some(target),
            mode: Some(mode),
            occurred_at: occurred_at.to_string(),
        },
    )
    .await
}
