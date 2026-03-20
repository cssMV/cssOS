use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryExecutionStatusKind {
    Succeeded,
    Failed,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryExecutionStatusView {
    pub execution_state: DeliveryExecutionStatusKind,
    pub status: DeliveryExecutionStatusKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subscription_id: Option<String>,
    pub mode: crate::css_case_delivery_api::types::DeliveryApiMode,
    pub target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    pub report_type: crate::css_case_delivery_report_api::types::DeliveryReportType,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub export_format: Option<crate::css_case_delivery_export_engine::types::DeliveryExportFormat>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub latest_delivery_log_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_delivery_log_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub result_summary: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_result_message: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryExecutionStatusViewRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subscription_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mode: Option<crate::css_case_delivery_api::types::DeliveryApiMode>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target: Option<crate::css_case_delivery_api::types::DeliveryApiTarget>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub report_type: Option<crate::css_case_delivery_report_api::types::DeliveryReportType>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub export_format: Option<crate::css_case_delivery_export_engine::types::DeliveryExportFormat>,
}
