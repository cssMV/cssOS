use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendPoint {
    pub date: String,
    pub value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendSeries {
    pub key: String,
    pub label: String,
    #[serde(default)]
    pub points: Vec<TrendPoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseTrendsView {
    pub daily_created_cases: TrendSeries,
    pub daily_closed_cases: TrendSeries,
    pub daily_frozen_cases: TrendSeries,
    pub daily_escalated_cases: TrendSeries,
    pub daily_high_risk_ratio: TrendSeries,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseTrendsRequest {
    pub end_date_yyyy_mm_dd: String,
    pub days: usize,
}
