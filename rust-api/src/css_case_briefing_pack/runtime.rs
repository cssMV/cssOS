use crate::css_case_briefing_pack::types::{CaseBriefingPackRequest, CssCaseBriefingPack};

pub async fn build_case_briefing_pack(
    pool: &sqlx::PgPool,
    req: CaseBriefingPackRequest,
) -> anyhow::Result<CssCaseBriefingPack> {
    let digest = crate::css_case_digest_engine::runtime::build_case_digest(
        pool,
        crate::css_case_digest_engine::types::CaseDigestRequest {
            today_yyyy_mm_dd: req.today_yyyy_mm_dd.clone(),
            trend_days: req.trend_days,
        },
    )
    .await?;
    let kpi = crate::css_case_kpi_view::runtime::build_case_kpi_view(
        pool,
        crate::css_case_kpi_view::types::CaseKpiRequest {
            today_yyyy_mm_dd: req.today_yyyy_mm_dd.clone(),
        },
    )
    .await?;
    let alerts = crate::css_case_alerts_view::runtime::build_case_alerts_view(
        pool,
        crate::css_case_alerts_view::types::CaseAlertsRequest {
            end_date_yyyy_mm_dd: req.today_yyyy_mm_dd.clone(),
            days: req.trend_days,
        },
    )
    .await?;
    let dashboard =
        crate::css_case_dashboard_view::runtime::build_dashboard(pool, &req.today_yyyy_mm_dd)
            .await?;
    let trends = crate::css_case_trends_view::runtime::build_case_trends_view(
        pool,
        crate::css_case_trends_view::types::CaseTrendsRequest {
            end_date_yyyy_mm_dd: req.today_yyyy_mm_dd.clone(),
            days: req.trend_days,
        },
    )
    .await?;
    let analytics = crate::css_case_analytics_view::runtime::build_case_analytics_view(
        pool,
        crate::css_case_analytics_view::types::CaseAnalyticsRequest::default(),
    )
    .await?;

    let trend_highlights = crate::css_case_briefing_pack::composer::build_trend_highlights(&trends);
    let top_insights = crate::css_case_briefing_pack::composer::build_top_insights(&analytics);
    let short_summary =
        crate::css_case_briefing_pack::composer::build_short_summary(&digest, &alerts, &analytics);

    Ok(CssCaseBriefingPack {
        date: req.today_yyyy_mm_dd,
        headline: digest.headline.clone(),
        short_summary,
        digest,
        kpi,
        alerts,
        dashboard,
        trend_highlights,
        top_insights,
    })
}

#[cfg(test)]
mod tests {
    #[test]
    fn v209_builds_top_insights_from_first_buckets() {
        let analytics = crate::css_case_analytics_view::types::CssCaseAnalyticsView {
            most_frozen_subjects: vec![crate::css_case_analytics_view::types::AnalyticsBucket {
                key: "deal".into(),
                label: "deal".into(),
                count: 3,
                ratio: None,
                avg_seconds: None,
            }],
            most_escalated_subjects: Vec::new(),
            longest_resolution_subjects: Vec::new(),
            risk_to_resolution_outcomes: Vec::new(),
        };

        let insights = crate::css_case_briefing_pack::composer::build_top_insights(&analytics);
        assert_eq!(insights.len(), 1);
        assert!(insights[0].summary.contains("deal"));
    }
}
