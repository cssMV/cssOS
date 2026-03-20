use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryApiMode {
    Report,
    Export,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryApiRequest {
    pub report_kind: crate::css_case_delivery_report_api::types::DeliveryReportKind,
    pub mode: DeliveryApiMode,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub export_format: Option<crate::css_case_delivery_export_engine::types::DeliveryExportFormat>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub days: Option<usize>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview_limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryApiMeta {
    pub report_kind: crate::css_case_delivery_report_api::types::DeliveryReportKind,
    pub mode: DeliveryApiMode,
    pub generated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "payload_kind", content = "payload", rename_all = "snake_case")]
pub enum DeliveryApiPayload {
    Report(crate::css_case_delivery_report_api::types::CssCaseDeliveryReportApiResponse),
    Export(crate::css_case_delivery_export_engine::types::CssCaseDeliveryExportResult),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryApiResponse {
    pub meta: DeliveryApiMeta,
    pub data: DeliveryApiPayload,
}
