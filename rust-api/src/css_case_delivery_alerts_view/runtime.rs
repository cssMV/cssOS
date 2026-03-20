use crate::css_case_delivery_alerts_view::types::{
    CssCaseDeliveryAlertsView, DeliveryAlertItem, DeliveryAlertSeverity, DeliveryAlertsViewRequest,
};
use crate::css_case_delivery_trends_view::types::{
    CssCaseDeliveryTrendsView, DeliveryTrendPoint, DeliveryTrendSeries, DeliveryTrendsViewRequest,
};

fn last_two_points(
    series: &DeliveryTrendSeries,
) -> Option<(DeliveryTrendPoint, DeliveryTrendPoint)> {
    if series.points.len() < 2 {
        return None;
    }

    let prev = series.points[series.points.len() - 2].clone();
    let curr = series.points[series.points.len() - 1].clone();
    Some((prev, curr))
}

fn spike_severity(prev: f64, curr: f64) -> Option<DeliveryAlertSeverity> {
    if curr <= prev {
        return None;
    }

    if prev == 0.0 {
        if curr >= 1.0 {
            return Some(DeliveryAlertSeverity::Critical);
        }
        return None;
    }

    let growth = (curr - prev) / prev;

    if growth >= 1.0 {
        Some(DeliveryAlertSeverity::Critical)
    } else if growth >= 0.5 {
        Some(DeliveryAlertSeverity::Warning)
    } else {
        None
    }
}

fn drop_severity(prev: f64, curr: f64) -> Option<DeliveryAlertSeverity> {
    if curr >= prev {
        return None;
    }

    let drop = prev - curr;

    if drop >= 0.30 {
        Some(DeliveryAlertSeverity::Critical)
    } else if drop >= 0.15 {
        Some(DeliveryAlertSeverity::Warning)
    } else {
        None
    }
}

fn escalated_spike_alert(series: &DeliveryTrendSeries) -> Option<DeliveryAlertItem> {
    let (prev, curr) = last_two_points(series)?;
    let severity = spike_severity(prev.value, curr.value)?;

    Some(DeliveryAlertItem {
        key: "daily_escalated_spike".into(),
        title: "今日 escalated 数异常升高".into(),
        summary: format!("{} 从 {} 上升到 {}。", curr.day, prev.value, curr.value),
        severity,
        day: Some(curr.day),
    })
}

fn manual_intervention_spike_alert(series: &DeliveryTrendSeries) -> Option<DeliveryAlertItem> {
    let (prev, curr) = last_two_points(series)?;
    let severity = spike_severity(prev.value, curr.value)?;

    Some(DeliveryAlertItem {
        key: "daily_manual_intervention_spike".into(),
        title: "今日人工介入量异常升高".into(),
        summary: format!("{} 从 {} 上升到 {}。", curr.day, prev.value, curr.value),
        severity,
        day: Some(curr.day),
    })
}

fn retry_spike_alert(series: &DeliveryTrendSeries) -> Option<DeliveryAlertItem> {
    let (prev, curr) = last_two_points(series)?;
    let severity = spike_severity(prev.value, curr.value)?;

    Some(DeliveryAlertItem {
        key: "daily_retry_spike".into(),
        title: "今日 retry 数异常升高".into(),
        summary: format!("{} 从 {} 上升到 {}。", curr.day, prev.value, curr.value),
        severity,
        day: Some(curr.day),
    })
}

fn resolved_or_stabilized_ratio_drop_alert(
    series: &DeliveryTrendSeries,
) -> Option<DeliveryAlertItem> {
    let (prev, curr) = last_two_points(series)?;
    let severity = drop_severity(prev.value, curr.value)?;

    Some(DeliveryAlertItem {
        key: "resolved_or_stabilized_ratio_drop".into(),
        title: "resolved / stabilized 比例明显下降".into(),
        summary: format!(
            "{} 从 {:.2} 下降到 {:.2}。",
            curr.day, prev.value, curr.value
        ),
        severity,
        day: Some(curr.day),
    })
}

fn series_by_key<'a>(
    trends: &'a CssCaseDeliveryTrendsView,
    key: &str,
) -> Option<&'a DeliveryTrendSeries> {
    trends.series.iter().find(|x| x.key == key)
}

fn alerts_summary(alerts: &[DeliveryAlertItem]) -> String {
    if alerts.is_empty() {
        "当前没有检测到明显异常预警。".into()
    } else {
        format!("当前检测到 {} 条交付运营预警。", alerts.len())
    }
}

pub async fn build_delivery_alerts_view(
    pool: &sqlx::PgPool,
    _req: DeliveryAlertsViewRequest,
) -> anyhow::Result<CssCaseDeliveryAlertsView> {
    let trends = crate::css_case_delivery_trends_view::runtime::build_delivery_trends_view(
        pool,
        DeliveryTrendsViewRequest { days: None },
    )
    .await?;

    let mut alerts = Vec::new();

    if let Some(series) = series_by_key(&trends, "daily_escalated_count") {
        if let Some(alert) = escalated_spike_alert(series) {
            alerts.push(alert);
        }
    }

    if let Some(series) = series_by_key(&trends, "daily_manual_intervention_count") {
        if let Some(alert) = manual_intervention_spike_alert(series) {
            alerts.push(alert);
        }
    }

    if let Some(series) = series_by_key(&trends, "daily_retry_count") {
        if let Some(alert) = retry_spike_alert(series) {
            alerts.push(alert);
        }
    }

    if let Some(series) = series_by_key(&trends, "daily_resolved_or_stabilized_ratio") {
        if let Some(alert) = resolved_or_stabilized_ratio_drop_alert(series) {
            alerts.push(alert);
        }
    }

    Ok(CssCaseDeliveryAlertsView {
        summary: alerts_summary(&alerts),
        alerts,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn series(key: &str, values: &[f64]) -> DeliveryTrendSeries {
        DeliveryTrendSeries {
            key: key.into(),
            title: key.into(),
            label: key.into(),
            points: values
                .iter()
                .enumerate()
                .map(|(idx, value)| DeliveryTrendPoint {
                    day: format!("2026-03-{}", 10 + idx),
                    value: *value,
                })
                .collect(),
        }
    }

    #[test]
    fn v346_spike_severity_thresholds_work() {
        assert_eq!(spike_severity(10.0, 14.0), None);
        assert_eq!(
            spike_severity(10.0, 15.0),
            Some(DeliveryAlertSeverity::Warning)
        );
        assert_eq!(
            spike_severity(10.0, 20.0),
            Some(DeliveryAlertSeverity::Critical)
        );
        assert_eq!(
            spike_severity(0.0, 1.0),
            Some(DeliveryAlertSeverity::Critical)
        );
    }

    #[test]
    fn v346_drop_severity_thresholds_work() {
        assert_eq!(drop_severity(0.8, 0.7), None);
        assert_eq!(
            drop_severity(0.8, 0.65),
            Some(DeliveryAlertSeverity::Warning)
        );
        assert_eq!(
            drop_severity(0.8, 0.5),
            Some(DeliveryAlertSeverity::Critical)
        );
    }

    #[test]
    fn v346_builds_ratio_drop_alert() {
        let alert = resolved_or_stabilized_ratio_drop_alert(&series("ratio", &[0.85, 0.5]))
            .expect("expected alert");
        assert_eq!(alert.key, "resolved_or_stabilized_ratio_drop");
        assert_eq!(alert.severity, DeliveryAlertSeverity::Critical);
        assert_eq!(alert.day.as_deref(), Some("2026-03-11"));
    }
}
