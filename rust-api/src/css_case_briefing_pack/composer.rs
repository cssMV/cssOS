use crate::css_case_alerts_view::types::CssCaseAlertsView;
use crate::css_case_analytics_view::types::CssCaseAnalyticsView;
use crate::css_case_briefing_pack::types::{BriefingTopInsight, BriefingTrendHighlight};
use crate::css_case_digest_engine::types::CssCaseDigestView;
use crate::css_case_trends_view::types::CssCaseTrendsView;

pub fn build_trend_highlights(trends: &CssCaseTrendsView) -> Vec<BriefingTrendHighlight> {
    let created_last = trends
        .daily_created_cases
        .points
        .last()
        .map(|point| point.value)
        .unwrap_or(0.0);
    let closed_last = trends
        .daily_closed_cases
        .points
        .last()
        .map(|point| point.value)
        .unwrap_or(0.0);
    let frozen_last = trends
        .daily_frozen_cases
        .points
        .last()
        .map(|point| point.value)
        .unwrap_or(0.0);
    let escalated_last = trends
        .daily_escalated_cases
        .points
        .last()
        .map(|point| point.value)
        .unwrap_or(0.0);
    let risk_last = trends
        .daily_high_risk_ratio
        .points
        .last()
        .map(|point| point.value)
        .unwrap_or(0.0);

    vec![
        BriefingTrendHighlight {
            title: "新增与结案趋势".into(),
            summary: format!(
                "最新日新增 {:.0}，结案 {:.0}，可用于观察案件池是扩张还是收缩。",
                created_last, closed_last
            ),
        },
        BriefingTrendHighlight {
            title: "冻结与升级人工趋势".into(),
            summary: format!(
                "最新日冻结 {:.0}、升级人工 {:.0}，可用于观察风险阻断与复杂案件压力。",
                frozen_last, escalated_last
            ),
        },
        BriefingTrendHighlight {
            title: "高风险占比趋势".into(),
            summary: format!(
                "最新日高风险占比为 {:.2}，可用于观察案件池风险质量变化。",
                risk_last
            ),
        },
    ]
}

pub fn build_top_insights(analytics: &CssCaseAnalyticsView) -> Vec<BriefingTopInsight> {
    let mut out = Vec::new();

    if let Some(top) = analytics.most_frozen_subjects.first() {
        out.push(BriefingTopInsight {
            title: "最易冻结的 subject 类型".into(),
            summary: format!(
                "当前冻结最集中的对象类型是 {}，数量 {}。",
                top.label, top.count
            ),
        });
    }

    if let Some(top) = analytics.most_escalated_subjects.first() {
        out.push(BriefingTopInsight {
            title: "最易升级人工的 subject 类型".into(),
            summary: format!(
                "当前升级人工最集中的对象类型是 {}，数量 {}。",
                top.label, top.count
            ),
        });
    }

    if let Some(top) = analytics.longest_resolution_subjects.first() {
        out.push(BriefingTopInsight {
            title: "平均结案时间最长的 subject 类型".into(),
            summary: format!(
                "平均结案时间最长的是 {}，平均约 {} 秒。",
                top.label,
                top.avg_seconds.unwrap_or(0)
            ),
        });
    }

    if let Some(top) = analytics.risk_to_resolution_outcomes.first() {
        out.push(BriefingTopInsight {
            title: "最常见的风险到结果组合".into(),
            summary: format!(
                "当前最常见的风险-结果组合是 {}，数量 {}。",
                top.label, top.count
            ),
        });
    }

    out
}

pub fn build_short_summary(
    digest: &CssCaseDigestView,
    alerts: &CssCaseAlertsView,
    analytics: &CssCaseAnalyticsView,
) -> String {
    let alert_count = alerts.alerts.len();
    let top_frozen = analytics
        .most_frozen_subjects
        .first()
        .map(|bucket| bucket.label.clone())
        .unwrap_or_else(|| "unknown".into());

    if alert_count > 0 {
        format!(
            "{} 当前共发现 {} 条异常预警；同时，{} 是当前最易冻结的对象类型，建议优先关注异常与高风险盘面。",
            digest.short_summary, alert_count, top_frozen
        )
    } else {
        format!(
            "{} 当前未发现明显异常；同时，{} 是当前最易冻结的对象类型，建议持续观察结构性风险分布。",
            digest.short_summary, top_frozen
        )
    }
}
