use crate::css_case_alerts_view::types::{
    CaseAlertItem, CaseAlertKind, CaseAlertSeverity, CaseAlertsRequest, CssCaseAlertsView,
};
use crate::css_case_trends_view::types::CssCaseTrendsView;

fn detect_frozen_spike(trends: &CssCaseTrendsView) -> Option<CaseAlertItem> {
    let series = &trends.daily_frozen_cases;
    let last = crate::css_case_alerts_view::rules::last_point(series)?;
    let prev = crate::css_case_alerts_view::rules::prev_point(series)?;
    let avg = crate::css_case_alerts_view::rules::avg_points(series)?;

    let prev_base = if prev.value <= 0.0 { 1.0 } else { prev.value };
    let avg_base = if avg <= 0.0 { 1.0 } else { avg };
    let ratio_prev = last.value / prev_base;
    let ratio_avg = last.value / avg_base;

    if ratio_prev >= 1.5 || ratio_avg >= 1.8 {
        return Some(CaseAlertItem {
            kind: CaseAlertKind::FrozenSpike,
            severity: crate::css_case_alerts_view::rules::severity_by_ratio_up(
                ratio_prev.max(ratio_avg),
            ),
            title: "今日冻结数异常升高".into(),
            summary: "今日进入冻结待复核的案件数明显高于近期水平。".into(),
            metric_key: series.key.clone(),
            date: last.date.clone(),
            current_value: last.value,
            baseline_value: prev.value.max(avg),
        });
    }

    None
}

fn detect_high_risk_ratio_spike(trends: &CssCaseTrendsView) -> Option<CaseAlertItem> {
    let series = &trends.daily_high_risk_ratio;
    let last = crate::css_case_alerts_view::rules::last_point(series)?;
    let prev = crate::css_case_alerts_view::rules::prev_point(series)?;
    let avg = crate::css_case_alerts_view::rules::avg_points(series)?;

    let delta_prev = last.value - prev.value;
    let ratio_avg = if avg <= 0.0 { 0.0 } else { last.value / avg };

    if delta_prev >= 0.10 || ratio_avg >= 1.3 {
        let severity = if delta_prev >= 0.20 || ratio_avg >= 1.6 {
            CaseAlertSeverity::Critical
        } else {
            CaseAlertSeverity::Warning
        };

        return Some(CaseAlertItem {
            kind: CaseAlertKind::HighRiskRatioSpike,
            severity,
            title: "高风险占比异常上升".into(),
            summary: "今日高风险案件占比明显高于昨日或近期均值。".into(),
            metric_key: series.key.clone(),
            date: last.date.clone(),
            current_value: last.value,
            baseline_value: prev.value.max(avg),
        });
    }

    None
}

fn detect_closed_cases_drop(trends: &CssCaseTrendsView) -> Option<CaseAlertItem> {
    let series = &trends.daily_closed_cases;
    let last = crate::css_case_alerts_view::rules::last_point(series)?;
    let prev = crate::css_case_alerts_view::rules::prev_point(series)?;
    let avg = crate::css_case_alerts_view::rules::avg_points(series)?;

    let prev_base = if prev.value <= 0.0 { 1.0 } else { prev.value };
    let avg_base = if avg <= 0.0 { 1.0 } else { avg };
    let ratio_prev = last.value / prev_base;
    let ratio_avg = last.value / avg_base;

    if ratio_prev <= 0.5 || ratio_avg <= 0.6 {
        return Some(CaseAlertItem {
            kind: CaseAlertKind::ClosedCasesDrop,
            severity: crate::css_case_alerts_view::rules::severity_by_ratio_down(
                ratio_prev.min(ratio_avg),
            ),
            title: "今日结案数明显下降".into(),
            summary: "今日 closed-like 案件数明显低于昨日或近期均值。".into(),
            metric_key: series.key.clone(),
            date: last.date.clone(),
            current_value: last.value,
            baseline_value: prev.value.max(avg),
        });
    }

    None
}

fn detect_escalation_spike(trends: &CssCaseTrendsView) -> Option<CaseAlertItem> {
    let series = &trends.daily_escalated_cases;
    let last = crate::css_case_alerts_view::rules::last_point(series)?;
    let prev = crate::css_case_alerts_view::rules::prev_point(series)?;
    let avg = crate::css_case_alerts_view::rules::avg_points(series)?;

    let prev_base = if prev.value <= 0.0 { 1.0 } else { prev.value };
    let avg_base = if avg <= 0.0 { 1.0 } else { avg };
    let ratio_prev = last.value / prev_base;
    let ratio_avg = last.value / avg_base;

    if ratio_prev >= 2.0 || ratio_avg >= 2.0 {
        return Some(CaseAlertItem {
            kind: CaseAlertKind::EscalationSpike,
            severity: crate::css_case_alerts_view::rules::severity_by_ratio_up(
                ratio_prev.max(ratio_avg),
            ),
            title: "升级人工量突然飙升".into(),
            summary: "今日进入升级人工流程的案件数明显高于近期水平。".into(),
            metric_key: series.key.clone(),
            date: last.date.clone(),
            current_value: last.value,
            baseline_value: prev.value.max(avg),
        });
    }

    None
}

pub async fn build_case_alerts_view(
    pool: &sqlx::PgPool,
    req: CaseAlertsRequest,
) -> anyhow::Result<CssCaseAlertsView> {
    let trends = crate::css_case_trends_view::runtime::build_case_trends_view(
        pool,
        crate::css_case_trends_view::types::CaseTrendsRequest {
            end_date_yyyy_mm_dd: req.end_date_yyyy_mm_dd,
            days: req.days,
        },
    )
    .await?;

    let mut alerts = Vec::new();

    if let Some(alert) = detect_frozen_spike(&trends) {
        alerts.push(alert);
    }
    if let Some(alert) = detect_high_risk_ratio_spike(&trends) {
        alerts.push(alert);
    }
    if let Some(alert) = detect_closed_cases_drop(&trends) {
        alerts.push(alert);
    }
    if let Some(alert) = detect_escalation_spike(&trends) {
        alerts.push(alert);
    }

    Ok(CssCaseAlertsView { alerts })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::css_case_trends_view::types::{CssCaseTrendsView, TrendPoint, TrendSeries};

    fn series(key: &str, values: &[f64]) -> TrendSeries {
        TrendSeries {
            key: key.into(),
            label: key.into(),
            points: values
                .iter()
                .enumerate()
                .map(|(idx, value)| TrendPoint {
                    date: format!("2026-03-{}", 10 + idx),
                    value: *value,
                })
                .collect(),
        }
    }

    #[test]
    fn v207_detects_frozen_spike() {
        let trends = CssCaseTrendsView {
            daily_created_cases: series("created", &[1.0, 1.0]),
            daily_closed_cases: series("closed", &[1.0, 1.0]),
            daily_frozen_cases: series("frozen", &[1.0, 3.0]),
            daily_escalated_cases: series("escalated", &[1.0, 1.0]),
            daily_high_risk_ratio: series("risk", &[0.1, 0.1]),
        };

        assert!(matches!(
            detect_frozen_spike(&trends).map(|x| x.kind),
            Some(CaseAlertKind::FrozenSpike)
        ));
    }
}
