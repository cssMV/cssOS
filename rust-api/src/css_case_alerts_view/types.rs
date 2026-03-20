use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseAlertSeverity {
    Info,
    Warning,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseAlertKind {
    FrozenSpike,
    HighRiskRatioSpike,
    ClosedCasesDrop,
    EscalationSpike,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseAlertItem {
    pub kind: CaseAlertKind,
    pub severity: CaseAlertSeverity,
    pub title: String,
    pub summary: String,
    pub metric_key: String,
    pub date: String,
    pub current_value: f64,
    pub baseline_value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseAlertsView {
    #[serde(default)]
    pub alerts: Vec<CaseAlertItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseAlertsRequest {
    pub end_date_yyyy_mm_dd: String,
    pub days: usize,
}
