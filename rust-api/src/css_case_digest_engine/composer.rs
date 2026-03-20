use crate::css_case_alerts_view::types::CssCaseAlertsView;
use crate::css_case_dashboard_view::types::{CssCaseDashboardView, DashboardCardKind};
use crate::css_case_kpi_view::types::CssCaseKpiView;
use crate::css_case_trends_view::types::CssCaseTrendsView;

pub fn build_headline(today: &str, created_today: usize, resolved_today: usize) -> String {
    format!("{today} 案件日报：今日新增 {created_today}，今日结案 {resolved_today}。")
}

pub fn build_metric_bullets(kpi: &CssCaseKpiView, trends: &CssCaseTrendsView) -> Vec<String> {
    let frozen_today = trends
        .daily_frozen_cases
        .points
        .last()
        .map(|point| point.value)
        .unwrap_or(0.0);
    let escalated_today = trends
        .daily_escalated_cases
        .points
        .last()
        .map(|point| point.value)
        .unwrap_or(0.0);

    vec![
        format!("今日新增案件：{}。", kpi.created_today_count),
        format!("今日结案件数：{}。", kpi.resolved_today_count),
        format!("今日冻结案件：{}。", frozen_today as usize),
        format!("今日升级人工：{}。", escalated_today as usize),
    ]
}

pub fn build_alert_bullets(alerts: &CssCaseAlertsView) -> Vec<String> {
    alerts
        .alerts
        .iter()
        .map(|alert| format!("预警：{} {}", alert.title, alert.summary))
        .collect()
}

pub fn build_inbox_bullets(dashboard: &CssCaseDashboardView) -> Vec<String> {
    dashboard
        .metrics
        .iter()
        .map(|metric| format!("{}：{}。", metric.label, metric.total))
        .collect()
}

pub fn build_short_summary(
    kpi: &CssCaseKpiView,
    alerts: &CssCaseAlertsView,
    dashboard: &CssCaseDashboardView,
) -> String {
    let pending = dashboard
        .metrics
        .iter()
        .find(|metric| matches!(metric.kind, DashboardCardKind::Pending))
        .map(|metric| metric.total)
        .unwrap_or(0);
    let high_risk = dashboard
        .metrics
        .iter()
        .find(|metric| matches!(metric.kind, DashboardCardKind::HighRisk))
        .map(|metric| metric.total)
        .unwrap_or(0);
    let frozen = dashboard
        .metrics
        .iter()
        .find(|metric| matches!(metric.kind, DashboardCardKind::FrozenUntilReview))
        .map(|metric| metric.total)
        .unwrap_or(0);

    if !alerts.alerts.is_empty() {
        format!(
            "今日案件池仍有较高处理压力，当前待处理 {pending}、高风险 {high_risk}、冻结待复核 {frozen}。同时已触发 {} 条异常预警，建议优先关注冻结与高风险队列；当前 closed-like 比例为 {:.2}。",
            alerts.alerts.len(),
            kpi.closed_like_ratio.unwrap_or(0.0)
        )
    } else {
        format!(
            "今日案件盘面整体相对稳定，当前待处理 {pending}、高风险 {high_risk}、冻结待复核 {frozen}。未发现明显异常预警；当前 closed-like 比例为 {:.2}。",
            kpi.closed_like_ratio.unwrap_or(0.0)
        )
    }
}

pub fn merge_bullets(
    metric_bullets: Vec<String>,
    alert_bullets: Vec<String>,
    inbox_bullets: Vec<String>,
) -> Vec<String> {
    let mut out = Vec::new();
    out.extend(metric_bullets);
    out.extend(alert_bullets);
    out.extend(inbox_bullets);
    out.into_iter().take(8).collect()
}
