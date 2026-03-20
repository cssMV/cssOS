pub fn executive_summary(
    digest: &crate::css_case_delivery_digest_engine::types::CssCaseDeliveryDigest,
    alerts: &crate::css_case_delivery_alerts_view::types::CssCaseDeliveryAlertsView,
) -> String {
    if alerts.alerts.is_empty() {
        return format!("{} {}", digest.title, digest.summary);
    }

    format!(
        "{} {} 当前存在 {} 条需要优先关注的异常。",
        digest.title,
        digest.summary,
        alerts.alerts.len()
    )
}

pub fn digest_section(
    digest: &crate::css_case_delivery_digest_engine::types::CssCaseDeliveryDigest,
) -> crate::css_case_delivery_briefing_pack::types::DeliveryBriefingSection {
    crate::css_case_delivery_briefing_pack::types::DeliveryBriefingSection {
        title: "今日摘要".into(),
        lines: digest.highlights.clone(),
    }
}

pub fn kpi_section(
    kpi: &crate::css_case_delivery_kpi_view::types::CssCaseDeliveryKpiView,
) -> crate::css_case_delivery_briefing_pack::types::DeliveryBriefingSection {
    let lines = kpi
        .metrics
        .iter()
        .map(|m| format!("{}：{:.1}%", m.label, m.ratio * 100.0))
        .collect();

    crate::css_case_delivery_briefing_pack::types::DeliveryBriefingSection {
        title: "KPI 摘要".into(),
        lines,
    }
}

pub fn alerts_section(
    alerts: &crate::css_case_delivery_alerts_view::types::CssCaseDeliveryAlertsView,
) -> crate::css_case_delivery_briefing_pack::types::DeliveryBriefingSection {
    let lines = if alerts.alerts.is_empty() {
        vec!["当前暂无重点异常预警。".into()]
    } else {
        alerts
            .alerts
            .iter()
            .map(|x| format!("{}：{}", x.title, x.summary))
            .collect()
    };

    crate::css_case_delivery_briefing_pack::types::DeliveryBriefingSection {
        title: "Alerts 摘要".into(),
        lines,
    }
}

pub fn inbox_section(
    inbox: &crate::css_case_delivery_inbox_view::types::CssCaseDeliveryInboxView,
) -> crate::css_case_delivery_briefing_pack::types::DeliveryBriefingSection {
    let lines = inbox
        .sections
        .iter()
        .map(|s| format!("{}：{} 个", s.title, s.items.len()))
        .collect();

    crate::css_case_delivery_briefing_pack::types::DeliveryBriefingSection {
        title: "Inbox 摘要".into(),
        lines,
    }
}

pub fn trends_section(
    trends: &crate::css_case_delivery_trends_view::types::CssCaseDeliveryTrendsView,
) -> crate::css_case_delivery_briefing_pack::types::DeliveryBriefingSection {
    let lines = trends
        .series
        .iter()
        .filter_map(|s| {
            s.points
                .last()
                .map(|p| format!("{}：{:.2}", s.label, p.value))
        })
        .collect();

    crate::css_case_delivery_briefing_pack::types::DeliveryBriefingSection {
        title: "Trends 摘要".into(),
        lines,
    }
}

pub fn analytics_section(
    analytics: &crate::css_case_delivery_analytics_view::types::CssCaseDeliveryAnalyticsView,
) -> crate::css_case_delivery_briefing_pack::types::DeliveryBriefingSection {
    let lines = analytics
        .insights
        .iter()
        .take(3)
        .map(|x| format!("{}：{}", x.title, x.summary))
        .collect();

    crate::css_case_delivery_briefing_pack::types::DeliveryBriefingSection {
        title: "Top Analytics 洞察".into(),
        lines,
    }
}
