use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseDeliveryLogTarget {
    ReportBundle,
    Digest,
    Briefing,
    Dashboard,
    Kpi,
    Analytics,
    Trends,
    Alerts,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseDeliveryLogFormat {
    Json,
    Csv,
    Text,
    Pdf,
    Docx,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseDeliveryLogMode {
    Download,
    Attachment,
    RobotPull,
    ApiBundle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryLogRecord {
    pub delivery_log_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subscription_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subscriber_id: Option<String>,
    pub target: CaseDeliveryLogTarget,
    pub format: CaseDeliveryLogFormat,
    pub mode: CaseDeliveryLogMode,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub api_mode: Option<crate::css_case_delivery_api::types::DeliveryApiMode>,
    pub delivered: bool,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payload_name: Option<String>,
    pub delivery_mode: crate::css_case_delivery_api::types::DeliveryApiMode,
    pub delivery_target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    pub report_type: crate::css_case_delivery_report_api::types::DeliveryReportType,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub export_format: Option<crate::css_case_delivery_export_engine::types::DeliveryExportFormat>,
    pub succeeded: bool,
    pub result_message: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseDeliveryLogCreateRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subscription_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subscriber_id: Option<String>,
    pub target: CaseDeliveryLogTarget,
    pub format: CaseDeliveryLogFormat,
    pub mode: CaseDeliveryLogMode,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub api_mode: Option<crate::css_case_delivery_api::types::DeliveryApiMode>,
    pub delivered: bool,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payload_name: Option<String>,
    pub delivery_mode: crate::css_case_delivery_api::types::DeliveryApiMode,
    pub delivery_target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    pub report_type: crate::css_case_delivery_report_api::types::DeliveryReportType,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub export_format: Option<crate::css_case_delivery_export_engine::types::DeliveryExportFormat>,
    pub succeeded: bool,
    pub result_message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryLogQueryRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subscription_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target: Option<CaseDeliveryLogTarget>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mode: Option<CaseDeliveryLogMode>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub api_mode: Option<crate::css_case_delivery_api::types::DeliveryApiMode>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub delivered: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub report_type: Option<crate::css_case_delivery_report_api::types::DeliveryReportType>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub succeeded: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub limit: Option<usize>,
}
