use crate::css_case_delivery_actions_engine::types::{
    DeliveryActionKind, DeliveryActionRequest, DeliveryActionResult,
};
use crate::css_case_delivery_api::types::{CaseDeliveryMode, CaseDeliveryRequest};
use crate::css_case_delivery_export_engine::types::{DeliveryExportFormat, DeliveryExportTarget};
use crate::css_case_delivery_log::types::{
    CaseDeliveryLogFormat, CaseDeliveryLogMode, CaseDeliveryLogTarget, CssCaseDeliveryLogRecord,
};
use crate::css_case_delivery_signals_invalidation::types::{
    DeliverySignalsInvalidationEvent, DeliverySignalsInvalidationEventKind,
};

fn export_target_from_log_target(target: &CaseDeliveryLogTarget) -> DeliveryExportTarget {
    match target {
        CaseDeliveryLogTarget::ReportBundle => DeliveryExportTarget::Bundle,
        CaseDeliveryLogTarget::Digest => DeliveryExportTarget::Digest,
        CaseDeliveryLogTarget::Briefing => DeliveryExportTarget::Briefing,
        CaseDeliveryLogTarget::Dashboard => DeliveryExportTarget::Dashboard,
        CaseDeliveryLogTarget::Kpi => DeliveryExportTarget::Kpi,
        CaseDeliveryLogTarget::Analytics => DeliveryExportTarget::Analytics,
        CaseDeliveryLogTarget::Trends => DeliveryExportTarget::Trends,
        CaseDeliveryLogTarget::Alerts => DeliveryExportTarget::Alerts,
    }
}

fn export_format_from_log_format(format: &CaseDeliveryLogFormat) -> DeliveryExportFormat {
    match format {
        CaseDeliveryLogFormat::Json => DeliveryExportFormat::JsonPackage,
        CaseDeliveryLogFormat::Csv => DeliveryExportFormat::Csv,
        CaseDeliveryLogFormat::Text => DeliveryExportFormat::BriefingText,
        CaseDeliveryLogFormat::Pdf => DeliveryExportFormat::Pdf,
        CaseDeliveryLogFormat::Docx => DeliveryExportFormat::Docx,
    }
}

fn delivery_mode_from_log_mode(mode: &CaseDeliveryLogMode) -> CaseDeliveryMode {
    match mode {
        CaseDeliveryLogMode::Download => CaseDeliveryMode::Download,
        CaseDeliveryLogMode::Attachment => CaseDeliveryMode::Attachment,
        CaseDeliveryLogMode::RobotPull => CaseDeliveryMode::RobotPull,
        CaseDeliveryLogMode::ApiBundle => CaseDeliveryMode::ApiBundle,
    }
}

fn request_date(now_rfc3339: &str) -> String {
    now_rfc3339.get(0..10).unwrap_or("2026-03-14").to_string()
}

async fn invalidate_subject_after_action(
    pool: &sqlx::PgPool,
    target: &CaseDeliveryLogTarget,
    mode: &CaseDeliveryLogMode,
    now_rfc3339: &str,
    kind: DeliverySignalsInvalidationEventKind,
) {
    let _ = crate::css_case_delivery_signals_invalidation::runtime::invalidate_from_event(
        pool,
        DeliverySignalsInvalidationEvent {
            kind,
            target: Some(target.clone()),
            mode: Some(mode.clone()),
            occurred_at: now_rfc3339.to_string(),
        },
    )
    .await;
}

async fn execute_retry(
    pool: &sqlx::PgPool,
    req: &DeliveryActionRequest,
    now_rfc3339: &str,
) -> anyhow::Result<DeliveryActionResult> {
    let failed_log =
        crate::css_case_delivery_log::store_pg::get_latest_failed_delivery_log_by_target(
            pool,
            &req.target,
        )
        .await?;

    let Some(failed_log) = failed_log else {
        return Ok(DeliveryActionResult {
            action: DeliveryActionKind::Retry,
            success: false,
            message: "no failed delivery log found for target".into(),
            subject_key: Some(
                crate::css_case_delivery_actions_engine::policy::subject_key(
                    &req.target,
                    &req.mode,
                ),
            ),
            payload_name: None,
            snapshot_id: None,
        });
    };

    let delivery = crate::css_case_delivery_api::handlers::deliver_case_report(
        pool,
        CaseDeliveryRequest {
            target: export_target_from_log_target(&failed_log.target),
            format: export_format_from_log_format(&failed_log.format),
            mode: delivery_mode_from_log_mode(&failed_log.mode),
            today_yyyy_mm_dd: request_date(now_rfc3339),
            trend_days: req.failure_streak.max(1),
        },
    )
    .await;

    let success = delivery.is_ok();
    let payload_name = delivery.ok().map(|value| value.file_name);

    invalidate_subject_after_action(
        pool,
        &req.target,
        &req.mode,
        now_rfc3339,
        DeliverySignalsInvalidationEventKind::RetryResultChanged,
    )
    .await;

    Ok(DeliveryActionResult {
        action: DeliveryActionKind::Retry,
        success,
        message: if success {
            crate::css_case_delivery_actions_engine::policy::success_message(
                &DeliveryActionKind::Retry,
            )
        } else {
            "delivery retry failed".into()
        },
        subject_key: Some(
            crate::css_case_delivery_actions_engine::policy::subject_key(&req.target, &req.mode),
        ),
        payload_name,
        snapshot_id: None,
    })
}

async fn execute_force_refresh_signals(
    pool: &sqlx::PgPool,
    req: &DeliveryActionRequest,
    now_rfc3339: &str,
) -> anyhow::Result<DeliveryActionResult> {
    let _record = crate::css_case_delivery_signals_cache::runtime::refresh_signals_cache(
        pool,
        crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheRequest {
            target: req.target.clone(),
            mode: req.mode.clone(),
            delivered: req.delivered,
            failure_streak: req.failure_streak,
            consecutive_failures: Some(req.failure_streak),
            retry_still_failing: req.failure_streak >= 2,
        },
        now_rfc3339,
    )
    .await?;

    Ok(DeliveryActionResult {
        action: DeliveryActionKind::ForceRefreshSignals,
        success: true,
        message: crate::css_case_delivery_actions_engine::policy::success_message(
            &DeliveryActionKind::ForceRefreshSignals,
        ),
        subject_key: Some(
            crate::css_case_delivery_actions_engine::policy::subject_key(&req.target, &req.mode),
        ),
        payload_name: None,
        snapshot_id: None,
    })
}

async fn execute_capture_snapshot(
    pool: &sqlx::PgPool,
    req: &DeliveryActionRequest,
    now_rfc3339: &str,
) -> anyhow::Result<DeliveryActionResult> {
    let snapshot = crate::css_case_delivery_signals_snapshot::runtime::create_signals_snapshot(
        pool,
        crate::css_case_delivery_signals_snapshot::types::CreateDeliverySignalsSnapshotRequest {
            target: req.target.clone(),
            mode: req.mode.clone(),
            delivered: req.delivered,
            failure_streak: req.failure_streak,
            consecutive_failures: Some(req.failure_streak),
            retry_still_failing: req.failure_streak >= 2,
            reason: crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotReason::ManualCapture,
        },
        now_rfc3339,
    )
    .await?;

    Ok(DeliveryActionResult {
        action: DeliveryActionKind::CaptureSnapshot,
        success: true,
        message: crate::css_case_delivery_actions_engine::policy::success_message(
            &DeliveryActionKind::CaptureSnapshot,
        ),
        subject_key: Some(snapshot.subject_key),
        payload_name: None,
        snapshot_id: Some(snapshot.snapshot_id),
    })
}

async fn execute_escalate_ops(
    _pool: &sqlx::PgPool,
    req: &DeliveryActionRequest,
) -> anyhow::Result<DeliveryActionResult> {
    Ok(DeliveryActionResult {
        action: DeliveryActionKind::EscalateOps,
        success: true,
        message: format!("delivery object escalated to ops: {}", req.reason),
        subject_key: Some(
            crate::css_case_delivery_actions_engine::policy::subject_key(&req.target, &req.mode),
        ),
        payload_name: None,
        snapshot_id: None,
    })
}

async fn execute_require_manual_intervention(
    _pool: &sqlx::PgPool,
    req: &DeliveryActionRequest,
) -> anyhow::Result<DeliveryActionResult> {
    Ok(DeliveryActionResult {
        action: DeliveryActionKind::RequireManualIntervention,
        success: true,
        message: format!("manual intervention required: {}", req.reason),
        subject_key: Some(
            crate::css_case_delivery_actions_engine::policy::subject_key(&req.target, &req.mode),
        ),
        payload_name: None,
        snapshot_id: None,
    })
}

fn consecutive_failures(logs: &[CssCaseDeliveryLogRecord]) -> usize {
    let mut count = 0;

    for log in logs {
        if log.delivered {
            break;
        }
        count += 1;
    }

    count
}

async fn build_resolution_request_for_target_mode(
    pool: &sqlx::PgPool,
    req: &DeliveryActionRequest,
) -> anyhow::Result<crate::css_case_delivery_resolution_engine::types::DeliveryResolutionRequest> {
    let logs = crate::css_case_delivery_log::store_pg::list_delivery_logs_for_target_mode(
        pool,
        &req.target,
        &req.mode,
    )
    .await
    .unwrap_or_default();

    let latest = logs.first();
    let delivered = latest.map(|log| log.delivered).unwrap_or(req.delivered);
    let failure_streak = if delivered {
        0
    } else if logs.is_empty() {
        req.failure_streak
    } else {
        consecutive_failures(&logs)
    };

    Ok(
        crate::css_case_delivery_resolution_engine::types::DeliveryResolutionRequest {
            target: req.target.clone(),
            mode: req.mode.clone(),
            delivered,
            failure_streak,
        },
    )
}

fn should_recompute_resolution(action: &DeliveryActionKind, success: bool) -> bool {
    success
        && matches!(
            action,
            DeliveryActionKind::Retry
                | DeliveryActionKind::EscalateOps
                | DeliveryActionKind::RequireManualIntervention
        )
}

pub async fn execute_delivery_action(
    pool: &sqlx::PgPool,
    req: DeliveryActionRequest,
    now_rfc3339: &str,
) -> anyhow::Result<DeliveryActionResult> {
    let result = if !crate::css_case_delivery_actions_engine::policy::allow_action(&req.action) {
        DeliveryActionResult {
            action: req.action.clone(),
            success: false,
            message: "action not allowed".into(),
            subject_key: Some(
                crate::css_case_delivery_actions_engine::policy::subject_key(
                    &req.target,
                    &req.mode,
                ),
            ),
            payload_name: None,
            snapshot_id: None,
        }
    } else {
        match req.action {
            DeliveryActionKind::Retry => execute_retry(pool, &req, now_rfc3339).await,
            DeliveryActionKind::ForceRefreshSignals => {
                execute_force_refresh_signals(pool, &req, now_rfc3339).await
            }
            DeliveryActionKind::CaptureSnapshot => {
                execute_capture_snapshot(pool, &req, now_rfc3339).await
            }
            DeliveryActionKind::EscalateOps => execute_escalate_ops(pool, &req).await,
            DeliveryActionKind::RequireManualIntervention => {
                execute_require_manual_intervention(pool, &req).await
            }
        }?
    };

    let action_log = crate::css_case_delivery_action_log::runtime::log_delivery_action_result(
        pool,
        &req,
        &result,
        now_rfc3339,
    )
    .await?;

    if should_recompute_resolution(&result.action, result.success) {
        let resolution_req = build_resolution_request_for_target_mode(pool, &req).await?;
        let _ = crate::css_case_delivery_resolution_log::runtime::resolve_and_log_if_changed(
            pool,
            resolution_req,
            crate::css_case_delivery_resolution_log::types::DeliveryResolutionTriggerKind::ActionDriven,
            Some(action_log.action_log_id),
            now_rfc3339,
        )
        .await;
    }

    Ok(result)
}
