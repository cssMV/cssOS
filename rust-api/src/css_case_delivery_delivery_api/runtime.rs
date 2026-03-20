use crate::css_case_delivery_delivery_api::types::{
    CssCaseDeliveryApiResponse, DeliveryApiMeta, DeliveryApiMode, DeliveryApiPayload,
    DeliveryApiRequest,
};
use crate::css_case_delivery_export_engine::types::{DeliveryExportRequest, DeliveryExportTarget};
use crate::css_case_delivery_report_api::types::{
    CssCaseDeliveryReportApiResponse, DeliveryReportApiRequest, DeliveryReportKind,
};

fn report_kind_to_export_target(kind: &DeliveryReportKind) -> DeliveryExportTarget {
    match kind {
        DeliveryReportKind::Dashboard => DeliveryExportTarget::Dashboard,
        DeliveryReportKind::Kpi => DeliveryExportTarget::Kpi,
        DeliveryReportKind::Analytics => DeliveryExportTarget::Analytics,
        DeliveryReportKind::Trends => DeliveryExportTarget::Trends,
        DeliveryReportKind::Alerts => DeliveryExportTarget::Alerts,
        DeliveryReportKind::Digest => DeliveryExportTarget::Digest,
        DeliveryReportKind::BriefingPack => DeliveryExportTarget::Briefing,
    }
}

fn delivery_api_meta(req: &DeliveryApiRequest, now_rfc3339: &str) -> DeliveryApiMeta {
    DeliveryApiMeta {
        report_kind: req.report_kind.clone(),
        mode: req.mode.clone(),
        generated_at: now_rfc3339.to_string(),
    }
}

async fn deliver_report(
    pool: &sqlx::PgPool,
    req: &DeliveryApiRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryReportApiResponse> {
    crate::css_case_delivery_report_api::runtime::build_delivery_report(
        pool,
        DeliveryReportApiRequest {
            kind: req.report_kind.clone(),
            days: req.days,
            preview_limit: req.preview_limit,
        },
        now_rfc3339,
    )
    .await
}

async fn deliver_export(
    pool: &sqlx::PgPool,
    req: &DeliveryApiRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_export_engine::types::CssCaseDeliveryExportResult> {
    let export_format = req
        .export_format
        .clone()
        .ok_or_else(|| anyhow::anyhow!("export_format is required when mode=export"))?;

    crate::css_case_delivery_export_engine::runtime::export_delivery_report(
        pool,
        DeliveryExportRequest {
            report_kind: Some(req.report_kind.clone()),
            report_type: Some(req.report_kind.clone()),
            target: report_kind_to_export_target(&req.report_kind),
            format: export_format,
            today_yyyy_mm_dd: now_rfc3339.get(0..10).unwrap_or("2026-03-17").to_string(),
            days: req.days,
            preview_limit: req.preview_limit,
        },
    )
    .await
}

pub async fn deliver(
    pool: &sqlx::PgPool,
    req: DeliveryApiRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryApiResponse> {
    let meta = delivery_api_meta(&req, now_rfc3339);

    let data = match req.mode {
        DeliveryApiMode::Report => {
            DeliveryApiPayload::Report(deliver_report(pool, &req, now_rfc3339).await?)
        }
        DeliveryApiMode::Export => {
            DeliveryApiPayload::Export(deliver_export(pool, &req, now_rfc3339).await?)
        }
    };

    Ok(CssCaseDeliveryApiResponse { meta, data })
}
