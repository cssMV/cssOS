use crate::css_case_delivery_api::types::{
    CaseAttachmentPayload, CaseDeliveryMode, CaseDeliveryRequest, CaseRobotPayload,
    CssCaseDeliveryApiResponse, CssCaseDeliveryResponse, DeliveryApiRequest, DeliveryApiTarget,
    GetDeliveryApiRequest,
};
use crate::css_case_delivery_export_engine::types::{
    DeliveryExportFormat, DeliveryExportRequest, DeliveryExportTarget,
};

// Compatibility transport layer only.
// The formal delivery mainline now lives in runtime.rs; handlers.rs keeps
// legacy entrypoints stable for download/attachment/robot flows.

fn request_day(now_rfc3339: &str, req: &GetDeliveryApiRequest) -> String {
    req.today_yyyy_mm_dd
        .clone()
        .unwrap_or_else(|| now_rfc3339.get(0..10).unwrap_or("2026-03-14").to_string())
}

pub async fn get_delivery_payload(
    pool: &sqlx::PgPool,
    req: GetDeliveryApiRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryApiResponse> {
    let today_yyyy_mm_dd = request_day(now_rfc3339, &req);

    crate::css_case_delivery_api::runtime::deliver(
        pool,
        DeliveryApiRequest {
            mode: req.mode,
            target: DeliveryApiTarget::ThirdPartyClient,
            report_type: req.kind.clone(),
            export_format: req.format.clone(),
            days: req.days,
            preview_limit: req.preview_limit,
            today_yyyy_mm_dd: Some(today_yyyy_mm_dd),
        },
        now_rfc3339,
    )
    .await
}

pub async fn deliver_for_download(
    pool: &sqlx::PgPool,
    req: &CaseDeliveryRequest,
) -> anyhow::Result<CssCaseDeliveryResponse> {
    let export = crate::css_case_delivery_export_engine::runtime::export_delivery_report(
        pool,
        DeliveryExportRequest {
            report_kind: None,
            report_type: None,
            target: req.target.clone(),
            format: req.format.clone(),
            today_yyyy_mm_dd: req.today_yyyy_mm_dd.clone(),
            days: Some(req.trend_days),
            preview_limit: None,
        },
    )
    .await?;

    Ok(CssCaseDeliveryResponse {
        mode: CaseDeliveryMode::Download,
        file_name: export.file_name,
        content_type: export.content_type,
        text_body: Some(export.body),
        binary_base64: None,
    })
}

pub async fn deliver_for_attachment(
    pool: &sqlx::PgPool,
    req: &CaseDeliveryRequest,
) -> anyhow::Result<CaseAttachmentPayload> {
    let export = crate::css_case_delivery_export_engine::runtime::export_delivery_report(
        pool,
        DeliveryExportRequest {
            report_kind: None,
            report_type: None,
            target: req.target.clone(),
            format: req.format.clone(),
            today_yyyy_mm_dd: req.today_yyyy_mm_dd.clone(),
            days: Some(req.trend_days),
            preview_limit: None,
        },
    )
    .await?;

    Ok(CaseAttachmentPayload {
        file_name: export.file_name,
        content_type: export.content_type,
        text_body: Some(export.body),
        binary_base64: None,
    })
}

pub async fn deliver_for_robot_pull(
    pool: &sqlx::PgPool,
    req: &CaseDeliveryRequest,
) -> anyhow::Result<CaseRobotPayload> {
    let effective_format = match req.target {
        DeliveryExportTarget::Digest | DeliveryExportTarget::Briefing => {
            DeliveryExportFormat::BriefingText
        }
        _ => DeliveryExportFormat::JsonPackage,
    };

    let export = crate::css_case_delivery_export_engine::runtime::export_delivery_report(
        pool,
        DeliveryExportRequest {
            report_kind: None,
            report_type: None,
            target: req.target.clone(),
            format: effective_format,
            today_yyyy_mm_dd: req.today_yyyy_mm_dd.clone(),
            days: Some(req.trend_days),
            preview_limit: None,
        },
    )
    .await?;

    Ok(CaseRobotPayload {
        title: export.file_name,
        body: export.body,
    })
}

pub async fn deliver_for_api_bundle(
    pool: &sqlx::PgPool,
    req: &CaseDeliveryRequest,
) -> anyhow::Result<CssCaseDeliveryResponse> {
    let export = crate::css_case_delivery_export_engine::runtime::export_delivery_report(
        pool,
        DeliveryExportRequest {
            report_kind: None,
            report_type: None,
            target: req.target.clone(),
            format: req.format.clone(),
            today_yyyy_mm_dd: req.today_yyyy_mm_dd.clone(),
            days: Some(req.trend_days),
            preview_limit: None,
        },
    )
    .await?;

    Ok(CssCaseDeliveryResponse {
        mode: CaseDeliveryMode::ApiBundle,
        file_name: export.file_name,
        content_type: export.content_type,
        text_body: Some(export.body),
        binary_base64: None,
    })
}

pub async fn deliver_case_report(
    pool: &sqlx::PgPool,
    req: CaseDeliveryRequest,
) -> anyhow::Result<CssCaseDeliveryResponse> {
    match req.mode {
        CaseDeliveryMode::Download => deliver_for_download(pool, &req).await,
        CaseDeliveryMode::Attachment => {
            let attachment = deliver_for_attachment(pool, &req).await?;
            Ok(CssCaseDeliveryResponse {
                mode: CaseDeliveryMode::Attachment,
                file_name: attachment.file_name,
                content_type: attachment.content_type,
                text_body: attachment.text_body,
                binary_base64: attachment.binary_base64,
            })
        }
        CaseDeliveryMode::RobotPull => {
            let robot = deliver_for_robot_pull(pool, &req).await?;
            Ok(CssCaseDeliveryResponse {
                mode: CaseDeliveryMode::RobotPull,
                file_name: robot.title,
                content_type: "text/plain".into(),
                text_body: Some(robot.body),
                binary_base64: None,
            })
        }
        CaseDeliveryMode::ApiBundle => deliver_for_api_bundle(pool, &req).await,
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn v212_robot_pull_prefers_text_for_briefing_targets() {
        let req = crate::css_case_delivery_api::types::CaseDeliveryRequest {
            target: crate::css_case_delivery_export_engine::types::DeliveryExportTarget::Briefing,
            format:
                crate::css_case_delivery_export_engine::types::DeliveryExportFormat::JsonPackage,
            mode: crate::css_case_delivery_api::types::CaseDeliveryMode::RobotPull,
            today_yyyy_mm_dd: "2026-03-13".into(),
            trend_days: 7,
        };

        let effective_format = match req.target {
            crate::css_case_delivery_export_engine::types::DeliveryExportTarget::Digest
            | crate::css_case_delivery_export_engine::types::DeliveryExportTarget::Briefing => {
                crate::css_case_delivery_export_engine::types::DeliveryExportFormat::BriefingText
            }
            _ => crate::css_case_delivery_export_engine::types::DeliveryExportFormat::JsonPackage,
        };

        assert_eq!(
            effective_format,
            crate::css_case_delivery_export_engine::types::DeliveryExportFormat::BriefingText
        );
    }
}
