use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryExportTarget {
    Dashboard,
    Kpi,
    Analytics,
    Trends,
    Alerts,
    Digest,
    Briefing,
    Bundle,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryExportFormat {
    #[serde(alias = "json")]
    #[serde(alias = "json_package")]
    JsonPackage,
    Csv,
    #[serde(alias = "brief_text")]
    #[serde(alias = "briefing_text")]
    BriefingText,
    Pdf,
    Docx,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryExportRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub report_kind: Option<crate::css_case_delivery_report_api::types::DeliveryReportKind>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub report_type: Option<crate::css_case_delivery_report_api::types::DeliveryReportType>,
    pub target: DeliveryExportTarget,
    pub format: DeliveryExportFormat,
    pub today_yyyy_mm_dd: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub days: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview_limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryExportResult {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub report_kind: Option<crate::css_case_delivery_report_api::types::DeliveryReportKind>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub report_type: Option<crate::css_case_delivery_report_api::types::DeliveryReportType>,
    pub format: DeliveryExportFormat,
    pub content_type: String,
    pub file_name: String,
    pub body: String,
}

pub type CssCaseDeliveryExportArtifact = CssCaseDeliveryExportResult;
