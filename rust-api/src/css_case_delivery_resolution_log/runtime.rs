use crate::css_case_delivery_log::types::{CaseDeliveryLogMode, CaseDeliveryLogTarget};
use crate::css_case_delivery_resolution_engine::types::{
    CssCaseDeliveryResolution, DeliveryResolutionRequest, DeliveryResolutionState,
};
use crate::css_case_delivery_resolution_log::types::{
    CreateDeliveryResolutionLogRequest, CssCaseDeliveryResolutionLogRecord,
    DeliveryResolutionTriggerKind,
};

pub fn build_delivery_resolution_log_record(
    req: CreateDeliveryResolutionLogRequest,
    now_rfc3339: &str,
) -> CssCaseDeliveryResolutionLogRecord {
    CssCaseDeliveryResolutionLogRecord {
        resolution_log_id: format!("cdrl_{}", uuid::Uuid::new_v4()),
        target: req.target,
        mode: req.mode,
        state: req.state,
        trigger_kind: req.trigger_kind,
        trigger_ref: req.trigger_ref,
        reasons: req.reasons,
        created_at: now_rfc3339.to_string(),
    }
}

pub async fn write_delivery_resolution_log(
    pool: &sqlx::PgPool,
    req: CreateDeliveryResolutionLogRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryResolutionLogRecord> {
    let record = build_delivery_resolution_log_record(req, now_rfc3339);
    crate::css_case_delivery_resolution_log::store_pg::insert_delivery_resolution_log(
        pool, &record,
    )
    .await?;
    Ok(record)
}

pub async fn should_append_resolution_log(
    pool: &sqlx::PgPool,
    target: &CaseDeliveryLogTarget,
    mode: &CaseDeliveryLogMode,
    next_state: &DeliveryResolutionState,
) -> anyhow::Result<bool> {
    let latest = crate::css_case_delivery_resolution_log::store_pg::get_latest_delivery_resolution_log_for_subject(
        pool,
        target,
        mode,
    )
    .await?;

    match latest {
        Some(record) => Ok(&record.state != next_state),
        None => Ok(true),
    }
}

pub async fn resolve_and_log_if_changed(
    pool: &sqlx::PgPool,
    req: DeliveryResolutionRequest,
    trigger_kind: DeliveryResolutionTriggerKind,
    trigger_ref: Option<String>,
    now_rfc3339: &str,
) -> anyhow::Result<Option<CssCaseDeliveryResolutionLogRecord>> {
    let resolution = crate::css_case_delivery_resolution_engine::runtime::resolve_delivery_state(
        pool,
        req.clone(),
        now_rfc3339,
    )
    .await?;

    resolve_from_resolution_and_log_if_changed(
        pool,
        &req,
        &resolution,
        Some(trigger_kind),
        trigger_ref,
        now_rfc3339,
    )
    .await
}

pub async fn resolve_from_resolution_and_log_if_changed(
    pool: &sqlx::PgPool,
    req: &DeliveryResolutionRequest,
    resolution: &CssCaseDeliveryResolution,
    trigger_kind: Option<DeliveryResolutionTriggerKind>,
    trigger_ref: Option<String>,
    now_rfc3339: &str,
) -> anyhow::Result<Option<CssCaseDeliveryResolutionLogRecord>> {
    if !should_append_resolution_log(pool, &req.target, &req.mode, &resolution.state).await? {
        return Ok(None);
    }

    let record = write_delivery_resolution_log(
        pool,
        CreateDeliveryResolutionLogRequest {
            target: req.target.clone(),
            mode: req.mode.clone(),
            state: resolution.state.clone(),
            trigger_kind,
            trigger_ref,
            reasons: resolution.reasons.clone(),
        },
        now_rfc3339,
    )
    .await?;

    Ok(Some(record))
}
