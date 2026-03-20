use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseKpiView {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub avg_resolution_seconds: Option<i64>,
    pub created_today_count: usize,
    pub resolved_today_count: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub high_risk_to_manual_ratio: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub frozen_to_release_ratio: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub closed_like_ratio: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseKpiRequest {
    pub today_yyyy_mm_dd: String,
}
