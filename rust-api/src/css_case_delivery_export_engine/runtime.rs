fn report_type_from_target(
    target: &crate::css_case_delivery_export_engine::types::DeliveryExportTarget,
) -> Option<crate::css_case_delivery_report_api::types::DeliveryReportType> {
    match target {
        crate::css_case_delivery_export_engine::types::DeliveryExportTarget::Dashboard => {
            Some(crate::css_case_delivery_report_api::types::DeliveryReportType::Dashboard)
        }
        crate::css_case_delivery_export_engine::types::DeliveryExportTarget::Kpi => {
            Some(crate::css_case_delivery_report_api::types::DeliveryReportType::Kpi)
        }
        crate::css_case_delivery_export_engine::types::DeliveryExportTarget::Analytics => {
            Some(crate::css_case_delivery_report_api::types::DeliveryReportType::Analytics)
        }
        crate::css_case_delivery_export_engine::types::DeliveryExportTarget::Trends => {
            Some(crate::css_case_delivery_report_api::types::DeliveryReportType::Trends)
        }
        crate::css_case_delivery_export_engine::types::DeliveryExportTarget::Alerts => {
            Some(crate::css_case_delivery_report_api::types::DeliveryReportType::Alerts)
        }
        crate::css_case_delivery_export_engine::types::DeliveryExportTarget::Digest => {
            Some(crate::css_case_delivery_report_api::types::DeliveryReportType::Digest)
        }
        crate::css_case_delivery_export_engine::types::DeliveryExportTarget::Briefing => {
            Some(crate::css_case_delivery_report_api::types::DeliveryReportType::BriefingPack)
        }
        crate::css_case_delivery_export_engine::types::DeliveryExportTarget::Bundle => None,
    }
}

fn effective_report_type(
    req: &crate::css_case_delivery_export_engine::types::DeliveryExportRequest,
) -> Option<crate::css_case_delivery_report_api::types::DeliveryReportType> {
    let report_kind = req.report_kind.clone();
    req.report_type
        .clone()
        .or(report_kind)
        .or_else(|| report_type_from_target(&req.target))
}

fn report_slug(
    report_type: Option<&crate::css_case_delivery_report_api::types::DeliveryReportType>,
    target: &crate::css_case_delivery_export_engine::types::DeliveryExportTarget,
) -> &'static str {
    match report_type {
        Some(crate::css_case_delivery_report_api::types::DeliveryReportType::Dashboard) => {
            "dashboard"
        }
        Some(crate::css_case_delivery_report_api::types::DeliveryReportType::Kpi) => "kpi",
        Some(crate::css_case_delivery_report_api::types::DeliveryReportType::Analytics) => {
            "analytics"
        }
        Some(crate::css_case_delivery_report_api::types::DeliveryReportType::Trends) => "trends",
        Some(crate::css_case_delivery_report_api::types::DeliveryReportType::Alerts) => "alerts",
        Some(crate::css_case_delivery_report_api::types::DeliveryReportType::Digest) => "digest",
        Some(crate::css_case_delivery_report_api::types::DeliveryReportType::BriefingPack) => {
            "briefing_pack"
        }
        None => match target {
            crate::css_case_delivery_export_engine::types::DeliveryExportTarget::Bundle => {
                "report_bundle"
            }
            crate::css_case_delivery_export_engine::types::DeliveryExportTarget::Dashboard => {
                "dashboard"
            }
            crate::css_case_delivery_export_engine::types::DeliveryExportTarget::Kpi => "kpi",
            crate::css_case_delivery_export_engine::types::DeliveryExportTarget::Analytics => {
                "analytics"
            }
            crate::css_case_delivery_export_engine::types::DeliveryExportTarget::Trends => "trends",
            crate::css_case_delivery_export_engine::types::DeliveryExportTarget::Alerts => "alerts",
            crate::css_case_delivery_export_engine::types::DeliveryExportTarget::Digest => "digest",
            crate::css_case_delivery_export_engine::types::DeliveryExportTarget::Briefing => {
                "briefing_pack"
            }
        },
    }
}

fn format_extension(
    format: &crate::css_case_delivery_export_engine::types::DeliveryExportFormat,
) -> &'static str {
    match format {
        crate::css_case_delivery_export_engine::types::DeliveryExportFormat::JsonPackage => "json",
        crate::css_case_delivery_export_engine::types::DeliveryExportFormat::Csv => "csv",
        crate::css_case_delivery_export_engine::types::DeliveryExportFormat::BriefingText => "txt",
        crate::css_case_delivery_export_engine::types::DeliveryExportFormat::Pdf => "pdf",
        crate::css_case_delivery_export_engine::types::DeliveryExportFormat::Docx => "docx",
    }
}

fn build_file_name(
    req: &crate::css_case_delivery_export_engine::types::DeliveryExportRequest,
    report_type: Option<&crate::css_case_delivery_report_api::types::DeliveryReportType>,
) -> String {
    format!(
        "delivery_{}_{}.{}",
        report_slug(report_type, &req.target),
        req.today_yyyy_mm_dd,
        format_extension(&req.format)
    )
}

fn request_now_rfc3339(
    req: &crate::css_case_delivery_export_engine::types::DeliveryExportRequest,
) -> String {
    format!("{}T00:00:00Z", req.today_yyyy_mm_dd)
}

async fn load_report(
    pool: &sqlx::PgPool,
    req: &crate::css_case_delivery_export_engine::types::DeliveryExportRequest,
) -> anyhow::Result<crate::css_case_delivery_report_api::types::CssCaseDeliveryReportApiResponse> {
    let report_type = effective_report_type(req)
        .ok_or_else(|| anyhow::anyhow!("bundle export must use the legacy bundle path"))?;

    crate::css_case_delivery_report_api::runtime::build_delivery_report(
        pool,
        crate::css_case_delivery_report_api::types::DeliveryReportApiRequest {
            kind: report_type,
            days: req.days,
            preview_limit: req.preview_limit,
        },
        &request_now_rfc3339(req),
    )
    .await
}

async fn export_bundle_json(
    pool: &sqlx::PgPool,
    req: &crate::css_case_delivery_export_engine::types::DeliveryExportRequest,
) -> anyhow::Result<crate::css_case_delivery_export_engine::types::CssCaseDeliveryExportResult> {
    let bundle = crate::css_case_delivery_report_api::handlers::get_delivery_report_bundle(
        pool,
        crate::css_case_delivery_report_api::types::GetDeliveryReportBundleRequest {
            days: req.days,
            preview_limit: req.preview_limit,
            include_dashboard: true,
            include_kpi: true,
            include_analytics: true,
            include_trends: true,
            include_alerts: true,
            include_digest: true,
            include_briefing: true,
        },
        &request_now_rfc3339(req),
    )
    .await?;

    Ok(
        crate::css_case_delivery_export_engine::types::CssCaseDeliveryExportResult {
            report_kind: None,
            report_type: None,
            format:
                crate::css_case_delivery_export_engine::types::DeliveryExportFormat::JsonPackage,
            content_type: "application/json".into(),
            file_name: build_file_name(req, None),
            body: crate::css_case_export_engine::formatters::to_json_string(&bundle)?,
        },
    )
}

fn export_json_package(
    req: &crate::css_case_delivery_export_engine::types::DeliveryExportRequest,
    resp: &crate::css_case_delivery_report_api::types::CssCaseDeliveryReportApiResponse,
) -> anyhow::Result<crate::css_case_delivery_export_engine::types::CssCaseDeliveryExportResult> {
    Ok(
        crate::css_case_delivery_export_engine::types::CssCaseDeliveryExportResult {
            report_kind: Some(resp.meta.kind.clone()),
            report_type: Some(resp.meta.kind.clone()),
            format:
                crate::css_case_delivery_export_engine::types::DeliveryExportFormat::JsonPackage,
            content_type: "application/json".into(),
            file_name: build_file_name(req, Some(&resp.meta.kind)),
            body: crate::css_case_export_engine::formatters::to_json_string(resp)?,
        },
    )
}

fn export_csv(
    req: &crate::css_case_delivery_export_engine::types::DeliveryExportRequest,
    resp: &crate::css_case_delivery_report_api::types::CssCaseDeliveryReportApiResponse,
) -> anyhow::Result<crate::css_case_delivery_export_engine::types::CssCaseDeliveryExportResult> {
    use crate::css_case_delivery_report_api::types::DeliveryReportPayload;

    let body = match &resp.data {
        DeliveryReportPayload::Dashboard(x) => {
            crate::css_case_export_engine::formatters::delivery_dashboard_to_csv(x)
        }
        DeliveryReportPayload::Kpi(x) => {
            crate::css_case_export_engine::formatters::delivery_kpi_to_csv(x)
        }
        DeliveryReportPayload::Analytics(x) => {
            crate::css_case_export_engine::formatters::delivery_analytics_to_csv(x)
        }
        DeliveryReportPayload::Trends(x) => {
            crate::css_case_export_engine::formatters::delivery_trends_to_csv(x)
        }
        DeliveryReportPayload::Alerts(x) => {
            crate::css_case_export_engine::formatters::delivery_alerts_to_csv(x)
        }
        DeliveryReportPayload::Digest(_) | DeliveryReportPayload::BriefingPack(_) => {
            anyhow::bail!("csv export is not supported for digest/briefing_pack in v1")
        }
    };

    Ok(
        crate::css_case_delivery_export_engine::types::CssCaseDeliveryExportResult {
            report_kind: Some(resp.meta.kind.clone()),
            report_type: Some(resp.meta.kind.clone()),
            format: crate::css_case_delivery_export_engine::types::DeliveryExportFormat::Csv,
            content_type: "text/csv".into(),
            file_name: build_file_name(req, Some(&resp.meta.kind)),
            body,
        },
    )
}

fn export_briefing_text(
    req: &crate::css_case_delivery_export_engine::types::DeliveryExportRequest,
    resp: &crate::css_case_delivery_report_api::types::CssCaseDeliveryReportApiResponse,
) -> anyhow::Result<crate::css_case_delivery_export_engine::types::CssCaseDeliveryExportResult> {
    use crate::css_case_delivery_report_api::types::DeliveryReportPayload;

    let body = match &resp.data {
        DeliveryReportPayload::Digest(x) => {
            crate::css_case_export_engine::formatters::delivery_digest_to_text(x)
        }
        DeliveryReportPayload::BriefingPack(x) => {
            crate::css_case_export_engine::formatters::delivery_briefing_to_text(x)
        }
        _ => anyhow::bail!("briefing_text export is only supported for digest/briefing_pack in v1"),
    };

    Ok(
        crate::css_case_delivery_export_engine::types::CssCaseDeliveryExportResult {
            report_kind: Some(resp.meta.kind.clone()),
            report_type: Some(resp.meta.kind.clone()),
            format:
                crate::css_case_delivery_export_engine::types::DeliveryExportFormat::BriefingText,
            content_type: "text/plain".into(),
            file_name: build_file_name(req, Some(&resp.meta.kind)),
            body,
        },
    )
}

pub async fn export_delivery_report(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_export_engine::types::DeliveryExportRequest,
) -> anyhow::Result<crate::css_case_delivery_export_engine::types::CssCaseDeliveryExportResult> {
    if matches!(
        req.target,
        crate::css_case_delivery_export_engine::types::DeliveryExportTarget::Bundle
    ) {
        return match req.format {
            crate::css_case_delivery_export_engine::types::DeliveryExportFormat::JsonPackage => {
                export_bundle_json(pool, &req).await
            }
            _ => anyhow::bail!("bundle export only supports json_package in v1"),
        };
    }

    let resp = load_report(pool, &req).await?;

    match req.format {
        crate::css_case_delivery_export_engine::types::DeliveryExportFormat::JsonPackage => {
            export_json_package(&req, &resp)
        }
        crate::css_case_delivery_export_engine::types::DeliveryExportFormat::Csv => {
            export_csv(&req, &resp)
        }
        crate::css_case_delivery_export_engine::types::DeliveryExportFormat::BriefingText => {
            export_briefing_text(&req, &resp)
        }
        crate::css_case_delivery_export_engine::types::DeliveryExportFormat::Pdf => {
            anyhow::bail!("pdf export is reserved for a later version")
        }
        crate::css_case_delivery_export_engine::types::DeliveryExportFormat::Docx => {
            anyhow::bail!("docx export is reserved for a later version")
        }
    }
}
