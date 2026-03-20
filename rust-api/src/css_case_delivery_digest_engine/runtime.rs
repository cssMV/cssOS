use crate::css_case_delivery_alerts_view::types::CssCaseDeliveryAlertsView;
use crate::css_case_delivery_dashboard_view::types::CssCaseDeliveryDashboardView;
use crate::css_case_delivery_digest_engine::types::{
    CssCaseDeliveryDigest, DeliveryDigestDailyMetrics, DeliveryDigestInboxCount,
    DeliveryDigestRequest,
};
use crate::css_case_delivery_trends_view::types::{
    CssCaseDeliveryTrendsView, DeliveryTrendPoint, DeliveryTrendSeries, DeliveryTrendsViewRequest,
};

fn last_point(series: &DeliveryTrendSeries) -> Option<DeliveryTrendPoint> {
    series.points.last().cloned()
}

fn trend_by_key<'a>(
    trends: &'a CssCaseDeliveryTrendsView,
    key: &str,
) -> Option<&'a DeliveryTrendSeries> {
    trends.series.iter().find(|x| x.key == key)
}

fn daily_metrics(trends: &CssCaseDeliveryTrendsView) -> DeliveryDigestDailyMetrics {
    let escalated_count = trend_by_key(trends, "daily_escalated_count")
        .and_then(last_point)
        .map(|x| x.value as usize)
        .unwrap_or(0);

    let manual_intervention_count = trend_by_key(trends, "daily_manual_intervention_count")
        .and_then(last_point)
        .map(|x| x.value as usize)
        .unwrap_or(0);

    let retry_count = trend_by_key(trends, "daily_retry_count")
        .and_then(last_point)
        .map(|x| x.value as usize)
        .unwrap_or(0);

    let resolution_change_count = trend_by_key(trends, "daily_resolution_change_count")
        .and_then(last_point)
        .map(|x| x.value as usize)
        .unwrap_or(0);

    DeliveryDigestDailyMetrics {
        escalated_count,
        manual_intervention_count,
        retry_count,
        resolution_change_count,
    }
}

fn inbox_counts(dashboard: &CssCaseDeliveryDashboardView) -> Vec<DeliveryDigestInboxCount> {
    dashboard
        .metrics
        .iter()
        .map(|x| DeliveryDigestInboxCount {
            key: x.key.clone(),
            title: x.title.clone(),
            count: x.count,
        })
        .collect()
}

fn alert_titles(alerts: &CssCaseDeliveryAlertsView) -> Vec<String> {
    alerts.alerts.iter().map(|x| x.title.clone()).collect()
}

fn highlights(
    metrics: &DeliveryDigestDailyMetrics,
    alerts: &CssCaseDeliveryAlertsView,
    analytics: &crate::css_case_delivery_analytics_view::types::CssCaseDeliveryAnalyticsView,
) -> Vec<String> {
    let mut out = Vec::new();

    out.push(format!(
        "今日 escalated={}, manual_intervention={}, retry={}, resolution_change={}",
        metrics.escalated_count,
        metrics.manual_intervention_count,
        metrics.retry_count,
        metrics.resolution_change_count,
    ));

    if !alerts.alerts.is_empty() {
        out.push(format!("今日共检测到 {} 条异常预警。", alerts.alerts.len()));
    } else {
        out.push("今日未检测到明显异常预警。".into());
    }

    if let Some(insight) = analytics.insights.first() {
        out.push(format!("重点洞察：{}。", insight.summary));
    }

    out
}

fn digest_summary(
    metrics: &DeliveryDigestDailyMetrics,
    alerts: &CssCaseDeliveryAlertsView,
) -> String {
    if alerts.alerts.is_empty() {
        format!(
            "今日交付运营整体平稳，escalated={}，manual_intervention={}，retry={}。",
            metrics.escalated_count, metrics.manual_intervention_count, metrics.retry_count,
        )
    } else {
        format!(
            "今日交付运营需要关注，检测到 {} 条异常预警，escalated={}，manual_intervention={}，retry={}。",
            alerts.alerts.len(),
            metrics.escalated_count,
            metrics.manual_intervention_count,
            metrics.retry_count,
        )
    }
}

pub async fn build_delivery_digest(
    pool: &sqlx::PgPool,
    req: DeliveryDigestRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryDigest> {
    let dashboard =
        crate::css_case_delivery_dashboard_view::runtime::build_delivery_dashboard_view(
            pool,
            crate::css_case_delivery_dashboard_view::types::DeliveryDashboardRequest {
                preview_limit: req.preview_limit.or(Some(5)),
            },
            now_rfc3339,
        )
        .await?;

    let trends = crate::css_case_delivery_trends_view::runtime::build_delivery_trends_view(
        pool,
        DeliveryTrendsViewRequest { days: req.days },
    )
    .await?;

    let alerts = crate::css_case_delivery_alerts_view::runtime::build_delivery_alerts_view(
        pool,
        crate::css_case_delivery_alerts_view::types::DeliveryAlertsViewRequest { days: req.days },
    )
    .await?;

    let analytics =
        crate::css_case_delivery_analytics_view::runtime::build_delivery_analytics_view(
            pool,
            crate::css_case_delivery_analytics_view::types::DeliveryAnalyticsViewRequest {
                limit: None,
            },
            now_rfc3339,
        )
        .await?;

    let metrics = daily_metrics(&trends);
    let inbox_counts = inbox_counts(&dashboard);
    let alert_titles = alert_titles(&alerts);
    let highlights = highlights(&metrics, &alerts, &analytics);
    let summary = digest_summary(&metrics, &alerts);

    Ok(CssCaseDeliveryDigest {
        title: "交付运营日报".into(),
        summary,
        daily_metrics: metrics,
        inbox_counts,
        alert_titles,
        highlights,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn series(key: &str, value: f64) -> DeliveryTrendSeries {
        DeliveryTrendSeries {
            key: key.into(),
            title: key.into(),
            label: key.into(),
            points: vec![DeliveryTrendPoint {
                day: "2026-03-17".into(),
                value,
            }],
        }
    }

    #[test]
    fn v347_daily_metrics_reads_latest_points() {
        let trends = CssCaseDeliveryTrendsView {
            summary: String::new(),
            series: vec![
                series("daily_escalated_count", 3.0),
                series("daily_manual_intervention_count", 4.0),
                series("daily_retry_count", 2.0),
                series("daily_resolution_change_count", 9.0),
            ],
        };

        let metrics = daily_metrics(&trends);
        assert_eq!(metrics.escalated_count, 3);
        assert_eq!(metrics.manual_intervention_count, 4);
        assert_eq!(metrics.retry_count, 2);
        assert_eq!(metrics.resolution_change_count, 9);
    }

    #[test]
    fn v347_summary_mentions_alert_count_when_present() {
        let metrics = DeliveryDigestDailyMetrics {
            escalated_count: 3,
            manual_intervention_count: 4,
            retry_count: 2,
            resolution_change_count: 9,
        };
        let alerts = CssCaseDeliveryAlertsView {
            summary: "x".into(),
            alerts: vec![
                crate::css_case_delivery_alerts_view::types::DeliveryAlertItem {
                    key: "daily_retry_spike".into(),
                    title: "今日 retry 数异常升高".into(),
                    summary: "2026-03-17 从 1 上升到 2。".into(),
                    severity:
                        crate::css_case_delivery_alerts_view::types::DeliveryAlertSeverity::Warning,
                    day: Some("2026-03-17".into()),
                },
            ],
        };

        assert!(digest_summary(&metrics, &alerts).contains("1 条异常预警"));
    }
}
