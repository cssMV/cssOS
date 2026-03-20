pub fn to_json_string<T: serde::Serialize>(value: &T) -> anyhow::Result<String> {
    Ok(serde_json::to_string_pretty(value)?)
}

pub fn digest_to_text(digest: &crate::css_case_digest_engine::types::CssCaseDigestView) -> String {
    let mut out = String::new();
    out.push_str(&digest.headline);
    out.push_str("\n\n");

    for bullet in &digest.bullets {
        out.push_str("- ");
        out.push_str(bullet);
        out.push('\n');
    }

    out.push('\n');
    out.push_str(&digest.short_summary);
    out
}

pub fn briefing_to_text(
    briefing: &crate::css_case_briefing_pack::types::CssCaseBriefingPack,
) -> String {
    let mut out = Vec::new();

    out.push(briefing.headline.clone());
    out.push(String::new());
    out.push(briefing.short_summary.clone());
    out.push(String::new());
    out.push("重点摘要：".into());

    for bullet in &briefing.digest.bullets {
        out.push(format!("- {bullet}"));
    }

    if !briefing.top_insights.is_empty() {
        out.push(String::new());
        out.push("Top Insights：".into());
        for insight in &briefing.top_insights {
            out.push(format!("- {}：{}", insight.title, insight.summary));
        }
    }

    if !briefing.trend_highlights.is_empty() {
        out.push(String::new());
        out.push("趋势摘要：".into());
        for highlight in &briefing.trend_highlights {
            out.push(format!("- {}：{}", highlight.title, highlight.summary));
        }
    }

    out.join("\n")
}

pub fn dashboard_to_csv(
    dashboard: &crate::css_case_dashboard_view::types::CssCaseDashboardView,
) -> String {
    let mut lines = vec!["kind,label,total".to_string()];

    for metric in &dashboard.metrics {
        lines.push(format!(
            "{},{},{}",
            format!("{:?}", metric.kind).to_lowercase(),
            metric.label,
            metric.total
        ));
    }

    lines.join("\n")
}

pub fn kpi_to_csv(kpi: &crate::css_case_kpi_view::types::CssCaseKpiView) -> String {
    vec![
        "metric,value".to_string(),
        format!(
            "avg_resolution_seconds,{}",
            kpi.avg_resolution_seconds.unwrap_or(0)
        ),
        format!("created_today_count,{}", kpi.created_today_count),
        format!("resolved_today_count,{}", kpi.resolved_today_count),
        format!(
            "high_risk_to_manual_ratio,{}",
            kpi.high_risk_to_manual_ratio.unwrap_or(0.0)
        ),
        format!(
            "frozen_to_release_ratio,{}",
            kpi.frozen_to_release_ratio.unwrap_or(0.0)
        ),
        format!("closed_like_ratio,{}", kpi.closed_like_ratio.unwrap_or(0.0)),
    ]
    .join("\n")
}

pub fn alerts_to_csv(alerts: &crate::css_case_alerts_view::types::CssCaseAlertsView) -> String {
    let mut lines = vec!["kind,severity,title,date,current_value,baseline_value".to_string()];

    for alert in &alerts.alerts {
        lines.push(format!(
            "{},{},{},{},{},{}",
            format!("{:?}", alert.kind).to_lowercase(),
            format!("{:?}", alert.severity).to_lowercase(),
            alert.title,
            alert.date,
            alert.current_value,
            alert.baseline_value
        ));
    }

    lines.join("\n")
}

pub fn trends_to_csv(trends: &crate::css_case_trends_view::types::CssCaseTrendsView) -> String {
    let mut lines = vec![
        "date,daily_created_cases,daily_closed_cases,daily_frozen_cases,daily_escalated_cases,daily_high_risk_ratio".to_string(),
    ];

    let len = trends.daily_created_cases.points.len();
    for idx in 0..len {
        lines.push(format!(
            "{},{},{},{},{},{}",
            trends.daily_created_cases.points[idx].date,
            trends.daily_created_cases.points[idx].value,
            trends.daily_closed_cases.points[idx].value,
            trends.daily_frozen_cases.points[idx].value,
            trends.daily_escalated_cases.points[idx].value,
            trends.daily_high_risk_ratio.points[idx].value
        ));
    }

    lines.join("\n")
}

pub fn unsupported_format_message(
    format: &crate::css_case_export_engine::types::CaseExportFormat,
) -> String {
    format!("format {format:?} is reserved for future export rendering")
}

pub fn delivery_digest_to_text(
    digest: &crate::css_case_delivery_digest_engine::types::CssCaseDeliveryDigest,
) -> String {
    let mut out = Vec::new();
    out.push(digest.title.clone());
    out.push(String::new());
    out.push(digest.summary.clone());
    out.push(String::new());
    out.push("今日指标：".into());
    out.push(format!(
        "- escalated={}，manual_intervention={}，retry={}，resolution_change={}",
        digest.daily_metrics.escalated_count,
        digest.daily_metrics.manual_intervention_count,
        digest.daily_metrics.retry_count,
        digest.daily_metrics.resolution_change_count
    ));

    if !digest.inbox_counts.is_empty() {
        out.push(String::new());
        out.push("关键队列：".into());
        for item in &digest.inbox_counts {
            out.push(format!("- {}：{} 个", item.title, item.count));
        }
    }

    if !digest.alert_titles.is_empty() {
        out.push(String::new());
        out.push("异常预警：".into());
        for title in &digest.alert_titles {
            out.push(format!("- {title}"));
        }
    }

    if !digest.highlights.is_empty() {
        out.push(String::new());
        out.push("重点摘要：".into());
        for line in &digest.highlights {
            out.push(format!("- {line}"));
        }
    }

    out.join("\n")
}

pub fn delivery_briefing_to_text(
    briefing: &crate::css_case_delivery_briefing_pack::types::CssCaseDeliveryBriefingPack,
) -> String {
    let mut out = Vec::new();
    out.push(briefing.title.clone());
    out.push(String::new());
    out.push(briefing.summary.clone());

    if !briefing.highlights.is_empty() {
        out.push(String::new());
        out.push("重点摘要：".into());
        for line in &briefing.highlights {
            out.push(format!("- {line}"));
        }
    }

    out.push(String::new());
    out.push("KPI 摘要：".into());
    for metric in &briefing.kpi.metrics {
        out.push(format!("- {}：{:.1}%", metric.label, metric.ratio * 100.0));
    }

    out.push(String::new());
    out.push("Alerts 摘要：".into());
    if briefing.alerts.alerts.is_empty() {
        out.push("- 当前暂无重点异常预警。".into());
    } else {
        for alert in &briefing.alerts.alerts {
            out.push(format!("- {}：{}", alert.title, alert.summary));
        }
    }

    out.push(String::new());
    out.push("Inbox 摘要：".into());
    for section in &briefing.inbox.sections {
        out.push(format!("- {}：{} 个", section.title, section.items.len()));
    }

    out.push(String::new());
    out.push("Trends 摘要：".into());
    for series in &briefing.trends.series {
        if let Some(point) = series.points.last() {
            out.push(format!("- {}：{:.2}", series.label, point.value));
        }
    }

    out.push(String::new());
    out.push("Top Analytics 洞察：".into());
    for insight in &briefing.analytics.insights {
        out.push(format!("- {}：{}", insight.title, insight.summary));
    }

    out.join("\n")
}

pub fn delivery_dashboard_to_csv(
    dashboard: &crate::css_case_delivery_dashboard_view::types::CssCaseDeliveryDashboardView,
) -> String {
    fn card_key(
        kind: &crate::css_case_delivery_dashboard_view::types::DeliveryDashboardCardKind,
    ) -> &'static str {
        match kind {
            crate::css_case_delivery_dashboard_view::types::DeliveryDashboardCardKind::NeedsAttention => "needs_attention",
            crate::css_case_delivery_dashboard_view::types::DeliveryDashboardCardKind::Escalated => "escalated",
            crate::css_case_delivery_dashboard_view::types::DeliveryDashboardCardKind::UnderManualIntervention => "under_manual_intervention",
            crate::css_case_delivery_dashboard_view::types::DeliveryDashboardCardKind::RecentRetry => "recent_retry",
            crate::css_case_delivery_dashboard_view::types::DeliveryDashboardCardKind::RecentResolutionChange => "recent_resolution_change",
        }
    }

    let mut lines = vec!["key,title,count".to_string()];

    for card in &dashboard.cards {
        lines.push(format!(
            "{},{},{}",
            card_key(&card.kind),
            card.title,
            card.count
        ));
    }

    lines.join("\n")
}

pub fn delivery_kpi_to_csv(
    kpi: &crate::css_case_delivery_kpi_view::types::CssCaseDeliveryKpiView,
) -> String {
    let mut lines = vec!["key,label,numerator,denominator,ratio".to_string()];

    for metric in &kpi.metrics {
        lines.push(format!(
            "{},{},{},{},{}",
            metric.key, metric.label, metric.numerator, metric.denominator, metric.ratio
        ));
    }

    lines.join("\n")
}

pub fn delivery_analytics_to_csv(
    analytics: &crate::css_case_delivery_analytics_view::types::CssCaseDeliveryAnalyticsView,
) -> String {
    let mut lines = vec!["key,title,summary".to_string()];

    for insight in &analytics.insights {
        lines.push(format!(
            "{},{},{}",
            insight.key, insight.title, insight.summary
        ));
    }

    lines.join("\n")
}

pub fn delivery_alerts_to_csv(
    alerts: &crate::css_case_delivery_alerts_view::types::CssCaseDeliveryAlertsView,
) -> String {
    let mut lines = vec!["key,severity,title,summary,day".to_string()];

    for alert in &alerts.alerts {
        lines.push(format!(
            "{},{},{},{},{}",
            alert.key,
            format!("{:?}", alert.severity).to_lowercase(),
            alert.title,
            alert.summary,
            alert.day.clone().unwrap_or_default()
        ));
    }

    lines.join("\n")
}

pub fn delivery_trends_to_csv(
    trends: &crate::css_case_delivery_trends_view::types::CssCaseDeliveryTrendsView,
) -> String {
    let mut lines = vec!["series_key,series_label,day,value".to_string()];

    for series in &trends.series {
        for point in &series.points {
            lines.push(format!(
                "{},{},{},{}",
                series.key, series.label, point.day, point.value
            ));
        }
    }

    lines.join("\n")
}
