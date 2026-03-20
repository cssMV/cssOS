use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryApiMode {
    Report,
    Export,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryApiTarget {
    FrontendDownload,
    Bot,
    Email,
    ThirdPartyClient,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseDeliveryMode {
    Download,
    Attachment,
    RobotPull,
    ApiBundle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseDeliveryRequest {
    pub target: crate::css_case_delivery_export_engine::types::DeliveryExportTarget,
    pub format: crate::css_case_delivery_export_engine::types::DeliveryExportFormat,
    pub mode: CaseDeliveryMode,
    pub today_yyyy_mm_dd: String,
    pub trend_days: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryResponse {
    pub mode: CaseDeliveryMode,
    pub file_name: String,
    pub content_type: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text_body: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub binary_base64: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseAttachmentPayload {
    pub file_name: String,
    pub content_type: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text_body: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub binary_base64: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseRobotPayload {
    pub title: String,
    pub body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryApiRequest {
    pub mode: DeliveryApiMode,
    pub target: DeliveryApiTarget,
    pub report_type: crate::css_case_delivery_report_api::types::DeliveryReportType,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub export_format: Option<crate::css_case_delivery_export_engine::types::DeliveryExportFormat>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub days: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview_limit: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub today_yyyy_mm_dd: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetDeliveryApiRequest {
    pub mode: DeliveryApiMode,
    pub kind: crate::css_case_delivery_report_api::types::DeliveryReportKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub format: Option<crate::css_case_delivery_export_engine::types::DeliveryExportFormat>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub days: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview_limit: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub today_yyyy_mm_dd: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "data", rename_all = "snake_case")]
pub enum DeliveryApiPayload {
    Report(crate::css_case_delivery_report_api::types::CssCaseDeliveryReportApiResponse),
    Export(crate::css_case_delivery_export_engine::types::CssCaseDeliveryExportResult),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryApiResponse {
    pub mode: DeliveryApiMode,
    pub target: DeliveryApiTarget,
    pub report_type: crate::css_case_delivery_report_api::types::DeliveryReportType,
    pub kind: crate::css_case_delivery_report_api::types::DeliveryReportKind,
    pub payload: DeliveryApiPayload,
}

impl From<GetDeliveryApiRequest> for DeliveryApiRequest {
    fn from(value: GetDeliveryApiRequest) -> Self {
        Self {
            mode: value.mode,
            target: DeliveryApiTarget::ThirdPartyClient,
            report_type: value.kind.clone(),
            export_format: value.format,
            days: value.days,
            preview_limit: value.preview_limit,
            today_yyyy_mm_dd: value.today_yyyy_mm_dd,
        }
    }
}
