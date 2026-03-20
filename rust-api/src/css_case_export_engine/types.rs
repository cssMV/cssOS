use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseExportFormat {
    Json,
    Csv,
    BriefingText,
    Pdf,
    Docx,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseExportTarget {
    Dashboard,
    Kpi,
    Analytics,
    Trends,
    Alerts,
    Digest,
    Briefing,
    Bundle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseExportRequest {
    pub target: CaseExportTarget,
    pub format: CaseExportFormat,
    pub today_yyyy_mm_dd: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub trend_days: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseExportResult {
    pub format: CaseExportFormat,
    pub content_type: String,
    pub file_name: String,
    pub body: String,
}
