use crate::css_case_query_engine::types::{CaseQueryRiskLevel, CaseQuerySubjectKind};

pub fn safe_ratio(numerator: usize, denominator: usize) -> Option<f64> {
    if denominator == 0 {
        None
    } else {
        Some(numerator as f64 / denominator as f64)
    }
}

pub fn avg_i64(values: &[i64]) -> Option<i64> {
    if values.is_empty() {
        None
    } else {
        Some(values.iter().sum::<i64>() / values.len() as i64)
    }
}

pub fn subject_label(kind: &CaseQuerySubjectKind) -> String {
    format!("{kind:?}").to_lowercase()
}

pub fn risk_label(level: &CaseQueryRiskLevel) -> String {
    format!("{level:?}").to_lowercase()
}
