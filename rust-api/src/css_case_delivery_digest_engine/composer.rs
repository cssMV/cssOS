pub fn headline(
    alerts: &crate::css_case_delivery_alerts_view::types::CssCaseDeliveryAlertsView,
) -> String {
    if alerts.alerts.is_empty() {
        "今日交付运营整体平稳".into()
    } else {
        format!("今日交付运营出现 {} 条重点预警", alerts.alerts.len())
    }
}

pub fn summary(
    dashboard: &crate::css_case_delivery_dashboard_view::types::CssCaseDeliveryDashboardView,
    alerts: &crate::css_case_delivery_alerts_view::types::CssCaseDeliveryAlertsView,
) -> String {
    let total_focus = dashboard
        .cards
        .iter()
        .find(|x| {
            matches!(
                x.kind,
                crate::css_case_delivery_dashboard_view::types::DeliveryDashboardCardKind::NeedsAttention
            )
        })
        .map(|x| x.count)
        .unwrap_or(0);

    if alerts.alerts.is_empty() {
        return format!("当前待关注对象 {} 个，整体无新增明显异常。", total_focus);
    }

    format!(
        "当前待关注对象 {} 个，且存在 {} 条需要优先查看的异常。",
        total_focus,
        alerts.alerts.len()
    )
}

pub fn change_section(
    trends: &crate::css_case_delivery_trends_view::types::CssCaseDeliveryTrendsView,
) -> crate::css_case_delivery_digest_engine::types::DeliveryDigestSection {
    fn latest(
        series: &crate::css_case_delivery_trends_view::types::DeliveryTrendSeries,
    ) -> Option<f64> {
        series.points.last().map(|x| x.value)
    }

    let mut lines = Vec::new();

    for key in [
        "daily_escalated_count",
        "daily_manual_intervention_count",
        "daily_retry_count",
        "daily_resolution_change_count",
    ] {
        if let Some(series) = trends.series.iter().find(|x| x.key == key) {
            if let Some(v) = latest(series) {
                lines.push(format!("{}：{:.0}", series.label, v));
            }
        }
    }

    crate::css_case_delivery_digest_engine::types::DeliveryDigestSection {
        title: "今日关键变化".into(),
        lines,
    }
}

pub fn alerts_section(
    alerts: &crate::css_case_delivery_alerts_view::types::CssCaseDeliveryAlertsView,
) -> crate::css_case_delivery_digest_engine::types::DeliveryDigestSection {
    let lines = if alerts.alerts.is_empty() {
        vec!["今日暂无重点异常预警。".into()]
    } else {
        alerts
            .alerts
            .iter()
            .map(|x| format!("{}：{}", x.title, x.summary))
            .collect()
    };

    crate::css_case_delivery_digest_engine::types::DeliveryDigestSection {
        title: "今日异常预警".into(),
        lines,
    }
}

pub fn inbox_section(
    inbox: &crate::css_case_delivery_inbox_view::types::CssCaseDeliveryInboxView,
) -> crate::css_case_delivery_digest_engine::types::DeliveryDigestSection {
    let lines = inbox
        .sections
        .iter()
        .map(|x| format!("{}：{} 个", x.title, x.items.len()))
        .collect();

    crate::css_case_delivery_digest_engine::types::DeliveryDigestSection {
        title: "今日关键队列".into(),
        lines,
    }
}

pub fn analytics_section(
    analytics: &crate::css_case_delivery_analytics_view::types::CssCaseDeliveryAnalyticsView,
) -> crate::css_case_delivery_digest_engine::types::DeliveryDigestSection {
    let lines = analytics
        .insights
        .iter()
        .map(|x| format!("{}：{}", x.title, x.summary))
        .collect();

    crate::css_case_delivery_digest_engine::types::DeliveryDigestSection {
        title: "结构洞察摘要".into(),
        lines,
    }
}
