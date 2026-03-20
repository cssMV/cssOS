use crate::css_case_alerts_view::types::CaseAlertSeverity;
use crate::css_case_trends_view::types::{TrendPoint, TrendSeries};

pub fn last_point(series: &TrendSeries) -> Option<&TrendPoint> {
    series.points.last()
}

pub fn prev_point(series: &TrendSeries) -> Option<&TrendPoint> {
    if series.points.len() >= 2 {
        series.points.get(series.points.len() - 2)
    } else {
        None
    }
}

pub fn avg_points(series: &TrendSeries) -> Option<f64> {
    if series.points.is_empty() {
        None
    } else {
        Some(
            series.points.iter().map(|point| point.value).sum::<f64>() / series.points.len() as f64,
        )
    }
}

pub fn severity_by_ratio_up(multiplier: f64) -> CaseAlertSeverity {
    if multiplier >= 2.0 {
        CaseAlertSeverity::Critical
    } else {
        CaseAlertSeverity::Warning
    }
}

pub fn severity_by_ratio_down(multiplier: f64) -> CaseAlertSeverity {
    if multiplier <= 0.4 {
        CaseAlertSeverity::Critical
    } else {
        CaseAlertSeverity::Warning
    }
}
