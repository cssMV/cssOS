use crate::css_case_delivery_log::types::CssCaseDeliveryLogRecord;
use crate::css_case_delivery_status_view::types::{
    CaseDeliveryStatusKind, CaseDeliveryStatusRequest, CaseDeliveryStatusTarget,
    CssCaseDeliveryCurrentStatusView, CssCaseDeliveryLogStatusView, CssCaseDeliveryStatusView,
    DeliveryCurrentStatusLookup, DeliveryCurrentStatusRequest, DeliveryStatusViewRequest,
};

fn never_delivered_view(req: &CaseDeliveryStatusRequest) -> CssCaseDeliveryLogStatusView {
    CssCaseDeliveryLogStatusView {
        status: CaseDeliveryStatusKind::NeverDelivered,
        subject_key: None,
        subscription_id: req.subscription_id.clone(),
        subscriber_id: None,
        target: req.target.clone(),
        format: None,
        mode: None,
        payload_name: None,
        message: Some("no delivery log found".into()),
    }
}

fn from_delivery_log(log: CssCaseDeliveryLogRecord) -> CssCaseDeliveryLogStatusView {
    CssCaseDeliveryLogStatusView {
        status: if log.delivered {
            CaseDeliveryStatusKind::Delivered
        } else {
            CaseDeliveryStatusKind::Failed
        },
        subject_key: None,
        subscription_id: log.subscription_id,
        subscriber_id: log.subscriber_id,
        target: Some(log.target),
        format: Some(log.format),
        mode: Some(log.mode),
        payload_name: log.payload_name,
        message: Some(log.message),
    }
}

fn summary_of(
    state: &crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState,
) -> String {
    match state {
        crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState::Resolved => {
            "当前对象已进入 resolved 状态。".into()
        }
        crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState::Stabilized => {
            "当前对象已恢复到 stabilized 状态。".into()
        }
        crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState::Escalated => {
            "当前对象已进入 escalated 状态。".into()
        }
        crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState::UnderManualIntervention => {
            "当前对象处于 under_manual_intervention 状态。".into()
        }
        crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState::MonitoringOnly => {
            "当前对象当前处于 monitoring_only 状态。".into()
        }
    }
}

fn from_resolution_log(
    log: crate::css_case_delivery_resolution_log::types::CssCaseDeliveryResolutionLogRecord,
) -> CssCaseDeliveryStatusView {
    CssCaseDeliveryStatusView {
        summary: summary_of(&log.state),
        state: log.state,
        updated_at: Some(log.created_at),
        reasons: log.reasons,
    }
}

fn from_resolution(
    resolution: crate::css_case_delivery_resolution_engine::types::CssCaseDeliveryResolution,
) -> CssCaseDeliveryStatusView {
    CssCaseDeliveryStatusView {
        summary: summary_of(&resolution.state),
        state: resolution.state,
        updated_at: None,
        reasons: resolution.reasons,
    }
}

fn empty_current_status_view() -> CssCaseDeliveryCurrentStatusView {
    CssCaseDeliveryCurrentStatusView {
        subscription_id: None,
        target: None,
        mode: None,
        api_mode: None,
        success: None,
        result_message: Some("no delivery status yet".into()),
        payload_name: None,
        updated_at: None,
    }
}

fn from_current_delivery_log(log: CssCaseDeliveryLogRecord) -> CssCaseDeliveryCurrentStatusView {
    CssCaseDeliveryCurrentStatusView {
        subscription_id: log.subscription_id,
        target: Some(log.target),
        mode: Some(log.mode),
        api_mode: log.api_mode,
        success: Some(log.delivered),
        result_message: Some(log.message),
        payload_name: log.payload_name,
        updated_at: Some(log.created_at),
    }
}

async fn load_latest_resolution_log(
    pool: &sqlx::PgPool,
    target: &crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    mode: &crate::css_case_delivery_log::types::CaseDeliveryLogMode,
) -> anyhow::Result<
    Option<crate::css_case_delivery_resolution_log::types::CssCaseDeliveryResolutionLogRecord>,
> {
    crate::css_case_delivery_resolution_log::store_pg::get_latest_delivery_resolution_log_for_subject(
        pool,
        target,
        mode,
    )
    .await
}

async fn load_latest_for_subscription(
    pool: &sqlx::PgPool,
    subscription_id: &str,
) -> anyhow::Result<Option<CssCaseDeliveryLogRecord>> {
    crate::css_case_delivery_log::store_pg::get_latest_delivery_log_for_subscription(
        pool,
        subscription_id,
    )
    .await
}

async fn load_latest_for_target_mode(
    pool: &sqlx::PgPool,
    target: &crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    mode: &crate::css_case_delivery_log::types::CaseDeliveryLogMode,
) -> anyhow::Result<Option<CssCaseDeliveryLogRecord>> {
    crate::css_case_delivery_log::store_pg::get_latest_delivery_log_for_target_mode(
        pool, target, mode,
    )
    .await
}

pub async fn load_delivery_status(
    pool: &sqlx::PgPool,
    req: CaseDeliveryStatusRequest,
) -> anyhow::Result<CssCaseDeliveryLogStatusView> {
    match req.query_kind {
        CaseDeliveryStatusTarget::Subscription => {
            if let Some(subscription_id) = req.subscription_id.clone() {
                let latest = crate::css_case_delivery_log::store_pg::get_latest_delivery_log_for_subscription(
                    pool,
                    &subscription_id,
                )
                .await?;

                match latest {
                    Some(log) => Ok(from_delivery_log(log)),
                    None => Ok(CssCaseDeliveryLogStatusView {
                        status: CaseDeliveryStatusKind::NeverDelivered,
                        subject_key: None,
                        subscription_id: Some(subscription_id),
                        subscriber_id: None,
                        target: None,
                        format: None,
                        mode: None,
                        payload_name: None,
                        message: Some("no delivery log found for subscription".into()),
                    }),
                }
            } else {
                Ok(never_delivered_view(&req))
            }
        }
        CaseDeliveryStatusTarget::ExportTarget => {
            if let Some(target) = req.target.clone() {
                let latest =
                    crate::css_case_delivery_log::store_pg::get_latest_delivery_log_by_target(
                        pool, &target,
                    )
                    .await?;

                match latest {
                    Some(log) => Ok(from_delivery_log(log)),
                    None => Ok(CssCaseDeliveryLogStatusView {
                        status: CaseDeliveryStatusKind::NeverDelivered,
                        subject_key: None,
                        subscription_id: None,
                        subscriber_id: None,
                        target: Some(target),
                        format: None,
                        mode: None,
                        payload_name: None,
                        message: Some("no delivery log found for target".into()),
                    }),
                }
            } else {
                Ok(never_delivered_view(&req))
            }
        }
    }
}

pub async fn build_delivery_status_view(
    pool: &sqlx::PgPool,
    req: DeliveryStatusViewRequest,
) -> anyhow::Result<CssCaseDeliveryStatusView> {
    if let Some(latest) = load_latest_resolution_log(pool, &req.target, &req.mode).await? {
        return Ok(from_resolution_log(latest));
    }

    let resolution = crate::css_case_delivery_resolution_engine::runtime::resolve_delivery_state(
        pool,
        crate::css_case_delivery_resolution_engine::types::DeliveryResolutionRequest {
            target: req.target,
            mode: req.mode,
            delivered: req.consecutive_failures == 0,
            failure_streak: req.consecutive_failures,
        },
        &crate::timeutil::now_rfc3339(),
    )
    .await?;

    let _ = req.retry_still_failing;
    let _ = req.replay_limit;
    let _ = req.action_limit;

    Ok(from_resolution(resolution))
}

pub async fn build_delivery_current_status_view(
    pool: &sqlx::PgPool,
    req: DeliveryCurrentStatusRequest,
) -> anyhow::Result<CssCaseDeliveryCurrentStatusView> {
    let latest = match req.lookup {
        DeliveryCurrentStatusLookup::BySubscription { subscription_id } => {
            load_latest_for_subscription(pool, &subscription_id).await?
        }
        DeliveryCurrentStatusLookup::ByTargetMode { target, mode } => {
            load_latest_for_target_mode(pool, &target, &mode).await?
        }
    };

    match latest {
        Some(log) => Ok(from_current_delivery_log(log)),
        None => Ok(empty_current_status_view()),
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn v215_never_delivered_fallback_keeps_subscription_context() {
        let view = super::never_delivered_view(
            &crate::css_case_delivery_status_view::types::CaseDeliveryStatusRequest {
                query_kind:
                    crate::css_case_delivery_status_view::types::CaseDeliveryStatusTarget::Subscription,
                subscription_id: Some("sub_1".into()),
                target: None,
            },
        );

        assert_eq!(
            view.status,
            crate::css_case_delivery_status_view::types::CaseDeliveryStatusKind::NeverDelivered
        );
        assert_eq!(view.subscription_id.as_deref(), Some("sub_1"));
    }
}
