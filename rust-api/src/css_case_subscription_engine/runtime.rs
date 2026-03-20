use crate::css_case_delivery_api::types::CaseDeliveryRequest;
use crate::css_case_subscription_engine::types::{
    CaseSubscriptionDeliveryKind, CaseSubscriptionExecutionRequest,
    CaseSubscriptionExecutionResult, CaseSubscriptionScheduleKind, CaseSubscriptionSpec,
    CaseSubscriptionTarget, CreateDeliverySubscriptionRequest, DeliverySubscriptionDispatchRequest,
    DeliverySubscriptionRecord, InboxWatchSpec,
};

pub async fn execute_subscription(
    pool: &sqlx::PgPool,
    req: CaseSubscriptionExecutionRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CaseSubscriptionExecutionResult> {
    let result = if !req.subscription.enabled {
        CaseSubscriptionExecutionResult {
            subscription_id: req.subscription.subscription_id.clone(),
            delivered: false,
            message: "subscription disabled".into(),
            payload_name: None,
        }
    } else {
        let delivery = crate::css_case_delivery_api::handlers::deliver_case_report(
            pool,
            CaseDeliveryRequest {
                target: crate::css_case_subscription_engine::policy::export_target_for_subscription(
                    &req.subscription.target,
                ),
                format: crate::css_case_subscription_engine::policy::export_format_for_subscription(
                    &req.subscription.target,
                ),
                mode: crate::css_case_subscription_engine::policy::delivery_mode_for_subscription(
                    &req.subscription.delivery_kind,
                ),
                today_yyyy_mm_dd: req.today_yyyy_mm_dd.clone(),
                trend_days: req.trend_days,
            },
        )
        .await?;

        CaseSubscriptionExecutionResult {
            subscription_id: req.subscription.subscription_id.clone(),
            delivered: true,
            message: "subscription delivered".into(),
            payload_name: Some(delivery.file_name),
        }
    };

    let _ = crate::css_case_delivery_log::runtime::log_subscription_delivery(
        pool,
        &req.subscription,
        &result,
        now_rfc3339,
    )
    .await?;

    Ok(result)
}

pub fn build_subscription_record(
    req: CreateDeliverySubscriptionRequest,
) -> DeliverySubscriptionRecord {
    DeliverySubscriptionRecord {
        subscription_id: format!("cds_{}", uuid::Uuid::new_v4()),
        owner_user_id: req.owner_user_id,
        frequency: req.frequency,
        target: req.target,
        enabled: true,
        destination: req.destination,
    }
}

pub async fn create_delivery_subscription(
    req: CreateDeliverySubscriptionRequest,
) -> anyhow::Result<DeliverySubscriptionRecord> {
    crate::css_case_subscription_engine::policy::validate_subscription_target(&req.target)?;
    Ok(build_subscription_record(req))
}

pub async fn dispatch_delivery_subscription(
    pool: &sqlx::PgPool,
    subscription: &DeliverySubscriptionRecord,
    req: DeliverySubscriptionDispatchRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_api::types::CssCaseDeliveryApiResponse> {
    let mode = if subscription.target.format.is_some() {
        crate::css_case_delivery_api::types::DeliveryApiMode::Export
    } else {
        crate::css_case_delivery_api::types::DeliveryApiMode::Report
    };

    let delivery_req = crate::css_case_delivery_api::types::GetDeliveryApiRequest {
        mode,
        kind: subscription.target.kind.clone(),
        format: subscription.target.format.clone(),
        days: req.days,
        preview_limit: Some(3),
        today_yyyy_mm_dd: Some(now_rfc3339.get(0..10).unwrap_or("2026-03-14").to_string()),
    };

    match crate::css_case_delivery_api::handlers::get_delivery_payload(
        pool,
        delivery_req.clone(),
        now_rfc3339,
    )
    .await
    {
        Ok(resp) => {
            let _ = crate::css_case_delivery_log::runtime::log_delivery_result(
                pool,
                Some(subscription.subscription_id.clone()),
                &delivery_req,
                &resp,
                now_rfc3339,
            )
            .await;
            Ok(resp)
        }
        Err(err) => {
            let error_message = err.to_string();
            let _ = crate::css_case_delivery_log::runtime::log_delivery_failure(
                pool,
                Some(subscription.subscription_id.clone()),
                &delivery_req,
                error_message.clone(),
                now_rfc3339,
            )
            .await;
            Err(err)
        }
    }
}

pub async fn should_dispatch_on_alert(
    pool: &sqlx::PgPool,
    days: Option<usize>,
) -> anyhow::Result<bool> {
    let alerts = crate::css_case_delivery_alerts_view::runtime::build_delivery_alerts_view(
        pool,
        crate::css_case_delivery_alerts_view::types::DeliveryAlertsRequest { days },
    )
    .await?;

    Ok(!alerts.alerts.is_empty())
}

pub async fn execute_daily_digest_subscription(
    pool: &sqlx::PgPool,
    subscription_id: String,
    subscriber_id: String,
    delivery_kind: CaseSubscriptionDeliveryKind,
    today_yyyy_mm_dd: String,
    now_rfc3339: &str,
) -> anyhow::Result<CaseSubscriptionExecutionResult> {
    execute_subscription(
        pool,
        CaseSubscriptionExecutionRequest {
            subscription: CaseSubscriptionSpec {
                subscription_id,
                subscriber_id,
                target: CaseSubscriptionTarget::DailyDigest,
                schedule: CaseSubscriptionScheduleKind::Daily,
                delivery_kind,
                inbox_watch: None,
                enabled: true,
            },
            today_yyyy_mm_dd,
            trend_days: 7,
        },
        now_rfc3339,
    )
    .await
}

pub async fn execute_weekly_briefing_subscription(
    pool: &sqlx::PgPool,
    subscription_id: String,
    subscriber_id: String,
    delivery_kind: CaseSubscriptionDeliveryKind,
    today_yyyy_mm_dd: String,
    now_rfc3339: &str,
) -> anyhow::Result<CaseSubscriptionExecutionResult> {
    execute_subscription(
        pool,
        CaseSubscriptionExecutionRequest {
            subscription: CaseSubscriptionSpec {
                subscription_id,
                subscriber_id,
                target: CaseSubscriptionTarget::WeeklyBriefing,
                schedule: CaseSubscriptionScheduleKind::Weekly,
                delivery_kind,
                inbox_watch: None,
                enabled: true,
            },
            today_yyyy_mm_dd,
            trend_days: 7,
        },
        now_rfc3339,
    )
    .await
}

pub async fn execute_alert_subscription(
    pool: &sqlx::PgPool,
    subscription_id: String,
    subscriber_id: String,
    delivery_kind: CaseSubscriptionDeliveryKind,
    today_yyyy_mm_dd: String,
    now_rfc3339: &str,
) -> anyhow::Result<CaseSubscriptionExecutionResult> {
    execute_subscription(
        pool,
        CaseSubscriptionExecutionRequest {
            subscription: CaseSubscriptionSpec {
                subscription_id,
                subscriber_id,
                target: CaseSubscriptionTarget::Alerts,
                schedule: CaseSubscriptionScheduleKind::OnAlert,
                delivery_kind,
                inbox_watch: None,
                enabled: true,
            },
            today_yyyy_mm_dd,
            trend_days: 7,
        },
        now_rfc3339,
    )
    .await
}

pub async fn execute_inbox_watch_subscription(
    pool: &sqlx::PgPool,
    subscription_id: String,
    subscriber_id: String,
    delivery_kind: CaseSubscriptionDeliveryKind,
    inbox: crate::css_case_inbox_view::types::InboxKind,
    today_yyyy_mm_dd: String,
    now_rfc3339: &str,
) -> anyhow::Result<CaseSubscriptionExecutionResult> {
    execute_subscription(
        pool,
        CaseSubscriptionExecutionRequest {
            subscription: CaseSubscriptionSpec {
                subscription_id,
                subscriber_id,
                target: CaseSubscriptionTarget::InboxWatch,
                schedule: CaseSubscriptionScheduleKind::OnInboxChange,
                delivery_kind,
                inbox_watch: Some(InboxWatchSpec {
                    inbox,
                    min_delta_count: None,
                }),
                enabled: true,
            },
            today_yyyy_mm_dd,
            trend_days: 7,
        },
        now_rfc3339,
    )
    .await
}

#[cfg(test)]
mod tests {
    #[test]
    fn v213_daily_digest_maps_to_existing_text_export_mode() {
        assert_eq!(
            crate::css_case_subscription_engine::policy::export_format_for_subscription(
                &crate::css_case_subscription_engine::types::CaseSubscriptionTarget::DailyDigest,
            ),
            crate::css_case_delivery_export_engine::types::DeliveryExportFormat::BriefingText
        );
    }

    #[test]
    fn v260_build_subscription_record_enables_new_subscription() {
        let record = super::build_subscription_record(
            crate::css_case_subscription_engine::types::CreateDeliverySubscriptionRequest {
                owner_user_id: "user_1".into(),
                frequency: crate::css_case_subscription_engine::types::DeliverySubscriptionFrequency::Daily,
                target: crate::css_case_subscription_engine::types::DeliverySubscriptionTarget {
                    kind: crate::css_case_delivery_report_api::types::DeliveryReportKind::Digest,
                    format: Some(
                        crate::css_case_delivery_export_engine::types::DeliveryExportFormat::BriefingText,
                    ),
                },
                destination: Some("robot://ops".into()),
            },
        );

        assert!(record.enabled);
        assert_eq!(record.owner_user_id, "user_1");
    }
}
