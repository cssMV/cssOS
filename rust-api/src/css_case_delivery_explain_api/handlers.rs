pub async fn get_delivery_explain(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_explain_api::types::GetDeliveryExplainRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_explain_api::types::CssCaseDeliveryExplainApiResponse>
{
    let data =
        crate::css_case_delivery_explain_view::runtime::build_delivery_explain_view_from_legacy(
            pool,
            crate::css_case_delivery_explain_view::types::DeliveryExplainRequest {
                target: req.target,
                mode: req.mode,
                delivered: req.delivered,
                failure_streak: req.failure_streak,
                consecutive_failures: None,
                retry_still_failing: false,
            },
            now_rfc3339,
        )
        .await?;

    Ok(crate::css_case_delivery_explain_api::types::CssCaseDeliveryExplainApiResponse { data })
}

pub async fn get_delivery_explain_for_recovery_item(
    pool: &sqlx::PgPool,
    item: &crate::css_case_delivery_recovery_view::types::DeliveryRecoveryItem,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_explain_api::types::CssCaseDeliveryExplainApiResponse>
{
    let target = match item.report_type {
        crate::css_case_delivery_report_api::types::DeliveryReportType::Dashboard => {
            crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Dashboard
        }
        crate::css_case_delivery_report_api::types::DeliveryReportType::Kpi => {
            crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Kpi
        }
        crate::css_case_delivery_report_api::types::DeliveryReportType::Analytics => {
            crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Analytics
        }
        crate::css_case_delivery_report_api::types::DeliveryReportType::Trends => {
            crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Trends
        }
        crate::css_case_delivery_report_api::types::DeliveryReportType::Alerts => {
            crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Alerts
        }
        crate::css_case_delivery_report_api::types::DeliveryReportType::Digest => {
            crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Digest
        }
        crate::css_case_delivery_report_api::types::DeliveryReportType::BriefingPack => {
            crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Briefing
        }
    };
    let mode = match item.target {
        crate::css_case_delivery_api::types::DeliveryApiTarget::FrontendDownload => {
            crate::css_case_delivery_log::types::CaseDeliveryLogMode::Download
        }
        crate::css_case_delivery_api::types::DeliveryApiTarget::Bot => {
            crate::css_case_delivery_log::types::CaseDeliveryLogMode::RobotPull
        }
        crate::css_case_delivery_api::types::DeliveryApiTarget::Email => {
            crate::css_case_delivery_log::types::CaseDeliveryLogMode::Attachment
        }
        crate::css_case_delivery_api::types::DeliveryApiTarget::ThirdPartyClient => {
            crate::css_case_delivery_log::types::CaseDeliveryLogMode::ApiBundle
        }
    };

    get_delivery_explain(
        pool,
        crate::css_case_delivery_explain_api::types::GetDeliveryExplainRequest {
            target,
            mode,
            delivered: matches!(
                item.state,
                crate::css_case_delivery_recovery_view::types::DeliveryRecoveryState::Recovered
            ),
            failure_streak: match item.state {
                crate::css_case_delivery_recovery_view::types::DeliveryRecoveryState::RetryStillFailing => 3,
                crate::css_case_delivery_recovery_view::types::DeliveryRecoveryState::PendingRecovery => 1,
                crate::css_case_delivery_recovery_view::types::DeliveryRecoveryState::Recovered => 0,
            },
        },
        now_rfc3339,
    )
    .await
}

pub async fn get_delivery_explain_for_delivery_log_status(
    pool: &sqlx::PgPool,
    delivery_log_status: &crate::css_case_delivery_status_view::types::CssCaseDeliveryLogStatusView,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_explain_api::types::CssCaseDeliveryExplainApiResponse>
{
    let target = delivery_log_status
        .target
        .clone()
        .ok_or_else(|| anyhow::anyhow!("missing target in delivery log status"))?;
    let mode = delivery_log_status
        .mode
        .clone()
        .ok_or_else(|| anyhow::anyhow!("missing mode in delivery log status"))?;

    let delivered = matches!(
        delivery_log_status.status,
        crate::css_case_delivery_status_view::types::CaseDeliveryStatusKind::Delivered
    );

    let failure_streak = if delivered { 0 } else { 1 };

    get_delivery_explain(
        pool,
        crate::css_case_delivery_explain_api::types::GetDeliveryExplainRequest {
            target,
            mode,
            delivered,
            failure_streak,
        },
        now_rfc3339,
    )
    .await
}

// Legacy-kept wrapper for older callers; delivery explain should prefer the
// explicit delivery-log status entrypoint above so it does not get confused
// with formal resolution-backed status views.
pub async fn get_delivery_explain_for_status(
    pool: &sqlx::PgPool,
    status: &crate::css_case_delivery_status_view::types::CssCaseDeliveryLogStatusView,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_explain_api::types::CssCaseDeliveryExplainApiResponse>
{
    get_delivery_explain_for_delivery_log_status(pool, status, now_rfc3339).await
}
