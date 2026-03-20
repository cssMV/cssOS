pub fn to_case_export_target(
    target: &crate::css_case_delivery_export_engine::types::DeliveryExportTarget,
) -> crate::css_case_export_engine::types::CaseExportTarget {
    match target {
        crate::css_case_delivery_export_engine::types::DeliveryExportTarget::Dashboard => {
            crate::css_case_export_engine::types::CaseExportTarget::Dashboard
        }
        crate::css_case_delivery_export_engine::types::DeliveryExportTarget::Kpi => {
            crate::css_case_export_engine::types::CaseExportTarget::Kpi
        }
        crate::css_case_delivery_export_engine::types::DeliveryExportTarget::Analytics => {
            crate::css_case_export_engine::types::CaseExportTarget::Analytics
        }
        crate::css_case_delivery_export_engine::types::DeliveryExportTarget::Trends => {
            crate::css_case_export_engine::types::CaseExportTarget::Trends
        }
        crate::css_case_delivery_export_engine::types::DeliveryExportTarget::Alerts => {
            crate::css_case_export_engine::types::CaseExportTarget::Alerts
        }
        crate::css_case_delivery_export_engine::types::DeliveryExportTarget::Digest => {
            crate::css_case_export_engine::types::CaseExportTarget::Digest
        }
        crate::css_case_delivery_export_engine::types::DeliveryExportTarget::Briefing => {
            crate::css_case_export_engine::types::CaseExportTarget::Briefing
        }
        crate::css_case_delivery_export_engine::types::DeliveryExportTarget::Bundle => {
            crate::css_case_export_engine::types::CaseExportTarget::Bundle
        }
    }
}

pub fn to_case_export_format(
    format: &crate::css_case_delivery_export_engine::types::DeliveryExportFormat,
) -> crate::css_case_export_engine::types::CaseExportFormat {
    match format {
        crate::css_case_delivery_export_engine::types::DeliveryExportFormat::JsonPackage => {
            crate::css_case_export_engine::types::CaseExportFormat::Json
        }
        crate::css_case_delivery_export_engine::types::DeliveryExportFormat::Csv => {
            crate::css_case_export_engine::types::CaseExportFormat::Csv
        }
        crate::css_case_delivery_export_engine::types::DeliveryExportFormat::BriefingText => {
            crate::css_case_export_engine::types::CaseExportFormat::BriefingText
        }
        crate::css_case_delivery_export_engine::types::DeliveryExportFormat::Pdf => {
            crate::css_case_export_engine::types::CaseExportFormat::Pdf
        }
        crate::css_case_delivery_export_engine::types::DeliveryExportFormat::Docx => {
            crate::css_case_export_engine::types::CaseExportFormat::Docx
        }
    }
}

pub fn to_case_export_request(
    req: crate::css_case_delivery_export_engine::types::DeliveryExportRequest,
) -> crate::css_case_export_engine::types::CaseExportRequest {
    crate::css_case_export_engine::types::CaseExportRequest {
        target: to_case_export_target(&req.target),
        format: to_case_export_format(&req.format),
        today_yyyy_mm_dd: req.today_yyyy_mm_dd,
        trend_days: req.days,
    }
}

pub fn from_case_export_result(
    result: crate::css_case_export_engine::types::CssCaseExportResult,
) -> crate::css_case_delivery_export_engine::types::CssCaseDeliveryExportResult {
    crate::css_case_delivery_export_engine::types::CssCaseDeliveryExportResult {
        report_kind: None,
        report_type: None,
        format: match result.format {
            crate::css_case_export_engine::types::CaseExportFormat::Json => {
                crate::css_case_delivery_export_engine::types::DeliveryExportFormat::JsonPackage
            }
            crate::css_case_export_engine::types::CaseExportFormat::Csv => {
                crate::css_case_delivery_export_engine::types::DeliveryExportFormat::Csv
            }
            crate::css_case_export_engine::types::CaseExportFormat::BriefingText => {
                crate::css_case_delivery_export_engine::types::DeliveryExportFormat::BriefingText
            }
            crate::css_case_export_engine::types::CaseExportFormat::Pdf => {
                crate::css_case_delivery_export_engine::types::DeliveryExportFormat::Pdf
            }
            crate::css_case_export_engine::types::CaseExportFormat::Docx => {
                crate::css_case_delivery_export_engine::types::DeliveryExportFormat::Docx
            }
        },
        content_type: result.content_type,
        file_name: result.file_name,
        body: result.body,
    }
}
