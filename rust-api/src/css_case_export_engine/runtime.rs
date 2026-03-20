use crate::css_case_export_engine::types::{
    CaseExportFormat, CaseExportRequest, CaseExportTarget, CssCaseExportResult,
};

// Export stays as the single delivery-facing mainline.
// Old case report APIs are kept for compatibility/report pages, but delivery
// download/attachment/robot/subscription flows should converge here.

fn build_file_name(target: &CaseExportTarget, format: &CaseExportFormat, today: &str) -> String {
    let ext = match format {
        CaseExportFormat::Json => "json",
        CaseExportFormat::Csv => "csv",
        CaseExportFormat::BriefingText => "txt",
        CaseExportFormat::Pdf => "pdf",
        CaseExportFormat::Docx => "docx",
    };

    format!(
        "case_report_{}_{}.{}",
        format!("{target:?}").to_lowercase(),
        today,
        ext
    )
}

fn content_type(format: &CaseExportFormat) -> String {
    match format {
        CaseExportFormat::Json => "application/json".into(),
        CaseExportFormat::Csv => "text/csv".into(),
        CaseExportFormat::BriefingText => "text/plain".into(),
        CaseExportFormat::Pdf => "application/pdf".into(),
        CaseExportFormat::Docx => {
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document".into()
        }
    }
}

pub async fn export_case_report(
    pool: &sqlx::PgPool,
    req: CaseExportRequest,
) -> anyhow::Result<CssCaseExportResult> {
    let trend_days = req.trend_days.unwrap_or(7);

    let body = match (&req.target, &req.format) {
        (CaseExportTarget::Dashboard, CaseExportFormat::Json) => {
            let value = crate::css_case_delivery_report_api::handlers::get_delivery_dashboard(
                pool,
                crate::css_case_delivery_report_api::types::GetDeliveryDashboardRequest {
                    preview_limit: Some(3),
                },
                &format!("{}T00:00:00Z", req.today_yyyy_mm_dd),
            )
            .await?;
            crate::css_case_export_engine::formatters::to_json_string(&value)?
        }
        (CaseExportTarget::Dashboard, CaseExportFormat::Csv) => {
            let value = crate::css_case_delivery_report_api::handlers::get_delivery_dashboard(
                pool,
                crate::css_case_delivery_report_api::types::GetDeliveryDashboardRequest {
                    preview_limit: Some(3),
                },
                &format!("{}T00:00:00Z", req.today_yyyy_mm_dd),
            )
            .await?;
            crate::css_case_export_engine::formatters::delivery_dashboard_to_csv(&value)
        }
        (CaseExportTarget::Kpi, CaseExportFormat::Json) => {
            let value = crate::css_case_delivery_report_api::handlers::get_delivery_kpi(
                pool,
                crate::css_case_delivery_report_api::types::GetDeliveryKpiRequest::default(),
                &format!("{}T00:00:00Z", req.today_yyyy_mm_dd),
            )
            .await?;
            crate::css_case_export_engine::formatters::to_json_string(&value)?
        }
        (CaseExportTarget::Kpi, CaseExportFormat::Csv) => {
            let value = crate::css_case_delivery_report_api::handlers::get_delivery_kpi(
                pool,
                crate::css_case_delivery_report_api::types::GetDeliveryKpiRequest::default(),
                &format!("{}T00:00:00Z", req.today_yyyy_mm_dd),
            )
            .await?;
            crate::css_case_export_engine::formatters::delivery_kpi_to_csv(&value)
        }
        (CaseExportTarget::Analytics, CaseExportFormat::Json) => {
            let value = crate::css_case_delivery_report_api::handlers::get_delivery_analytics(
                pool,
                crate::css_case_delivery_report_api::types::GetDeliveryAnalyticsRequest::default(),
                &format!("{}T00:00:00Z", req.today_yyyy_mm_dd),
            )
            .await?;
            crate::css_case_export_engine::formatters::to_json_string(&value)?
        }
        (CaseExportTarget::Trends, CaseExportFormat::Json) => {
            let value = crate::css_case_delivery_report_api::handlers::get_delivery_trends(
                pool,
                crate::css_case_delivery_report_api::types::GetDeliveryTrendsRequest {
                    days: Some(trend_days),
                },
            )
            .await?;
            crate::css_case_export_engine::formatters::to_json_string(&value)?
        }
        (CaseExportTarget::Trends, CaseExportFormat::Csv) => {
            let value = crate::css_case_delivery_report_api::handlers::get_delivery_trends(
                pool,
                crate::css_case_delivery_report_api::types::GetDeliveryTrendsRequest {
                    days: Some(trend_days),
                },
            )
            .await?;
            crate::css_case_export_engine::formatters::delivery_trends_to_csv(&value)
        }
        (CaseExportTarget::Alerts, CaseExportFormat::Json) => {
            let value = crate::css_case_delivery_report_api::handlers::get_delivery_alerts(
                pool,
                crate::css_case_delivery_report_api::types::GetDeliveryAlertsRequest {
                    days: Some(trend_days),
                },
            )
            .await?;
            crate::css_case_export_engine::formatters::to_json_string(&value)?
        }
        (CaseExportTarget::Alerts, CaseExportFormat::Csv) => {
            let value = crate::css_case_delivery_report_api::handlers::get_delivery_alerts(
                pool,
                crate::css_case_delivery_report_api::types::GetDeliveryAlertsRequest {
                    days: Some(trend_days),
                },
            )
            .await?;
            crate::css_case_export_engine::formatters::delivery_alerts_to_csv(&value)
        }
        (CaseExportTarget::Digest, CaseExportFormat::Json) => {
            let value = crate::css_case_delivery_report_api::handlers::get_delivery_digest(
                pool,
                crate::css_case_delivery_report_api::types::GetDeliveryDigestRequest {
                    days: Some(trend_days),
                    preview_limit: Some(3),
                },
                &format!("{}T00:00:00Z", req.today_yyyy_mm_dd),
            )
            .await?;
            crate::css_case_export_engine::formatters::to_json_string(&value)?
        }
        (CaseExportTarget::Digest, CaseExportFormat::BriefingText) => {
            let value = crate::css_case_delivery_report_api::handlers::get_delivery_digest(
                pool,
                crate::css_case_delivery_report_api::types::GetDeliveryDigestRequest {
                    days: Some(trend_days),
                    preview_limit: Some(3),
                },
                &format!("{}T00:00:00Z", req.today_yyyy_mm_dd),
            )
            .await?;
            crate::css_case_export_engine::formatters::delivery_digest_to_text(&value)
        }
        (CaseExportTarget::Briefing, CaseExportFormat::Json) => {
            let value = crate::css_case_delivery_report_api::handlers::get_delivery_briefing_pack(
                pool,
                crate::css_case_delivery_report_api::types::GetDeliveryBriefingPackRequest {
                    days: Some(trend_days),
                    preview_limit: Some(3),
                },
                &format!("{}T00:00:00Z", req.today_yyyy_mm_dd),
            )
            .await?;
            crate::css_case_export_engine::formatters::to_json_string(&value)?
        }
        (CaseExportTarget::Briefing, CaseExportFormat::BriefingText) => {
            let value = crate::css_case_delivery_report_api::handlers::get_delivery_briefing_pack(
                pool,
                crate::css_case_delivery_report_api::types::GetDeliveryBriefingPackRequest {
                    days: Some(trend_days),
                    preview_limit: Some(3),
                },
                &format!("{}T00:00:00Z", req.today_yyyy_mm_dd),
            )
            .await?;
            crate::css_case_export_engine::formatters::delivery_briefing_to_text(&value)
        }
        (CaseExportTarget::Bundle, CaseExportFormat::Json) => {
            let value = crate::css_case_delivery_report_api::handlers::get_delivery_report_bundle(
                pool,
                crate::css_case_delivery_report_api::types::GetDeliveryReportBundleRequest {
                    days: Some(trend_days),
                    preview_limit: Some(3),
                    include_dashboard: true,
                    include_kpi: true,
                    include_analytics: true,
                    include_trends: true,
                    include_alerts: true,
                    include_digest: true,
                    include_briefing: true,
                },
                &format!("{}T00:00:00Z", req.today_yyyy_mm_dd),
            )
            .await?;
            crate::css_case_export_engine::formatters::to_json_string(&value)?
        }
        (_, CaseExportFormat::Pdf) | (_, CaseExportFormat::Docx) => {
            crate::css_case_export_engine::formatters::unsupported_format_message(&req.format)
        }
        _ => format!(
            "export format {:?} is not supported for target {:?} in v1",
            req.format, req.target
        ),
    };

    Ok(CssCaseExportResult {
        format: req.format.clone(),
        content_type: content_type(&req.format),
        file_name: build_file_name(&req.target, &req.format, &req.today_yyyy_mm_dd),
        body,
    })
}

#[cfg(test)]
mod tests {
    #[test]
    fn v211_build_file_name_uses_target_and_extension() {
        let name = super::build_file_name(
            &crate::css_case_export_engine::types::CaseExportTarget::Kpi,
            &crate::css_case_export_engine::types::CaseExportFormat::Csv,
            "2026-03-13",
        );
        assert_eq!(name, "case_report_kpi_2026-03-13.csv");
    }
}
