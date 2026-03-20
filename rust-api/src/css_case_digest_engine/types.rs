use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDigestView {
    pub date: String,
    pub headline: String,
    #[serde(default)]
    pub bullets: Vec<String>,
    pub short_summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseDigestRequest {
    pub today_yyyy_mm_dd: String,
    pub trend_days: usize,
}
