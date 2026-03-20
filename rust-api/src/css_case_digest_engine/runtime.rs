use crate::css_case_digest_engine::types::{CaseDigestRequest, CssCaseDigestView};

pub async fn build_case_digest(
    pool: &sqlx::PgPool,
    req: CaseDigestRequest,
) -> anyhow::Result<CssCaseDigestView> {
    let kpi = crate::css_case_kpi_view::runtime::build_case_kpi_view(
        pool,
        crate::css_case_kpi_view::types::CaseKpiRequest {
            today_yyyy_mm_dd: req.today_yyyy_mm_dd.clone(),
        },
    )
    .await?;
    let trends = crate::css_case_trends_view::runtime::build_case_trends_view(
        pool,
        crate::css_case_trends_view::types::CaseTrendsRequest {
            end_date_yyyy_mm_dd: req.today_yyyy_mm_dd.clone(),
            days: req.trend_days,
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
    let card_kinds = vec![
        crate::css_case_dashboard_view::types::DashboardCardKind::Pending,
        crate::css_case_dashboard_view::types::DashboardCardKind::HighRisk,
        crate::css_case_dashboard_view::types::DashboardCardKind::FrozenUntilReview,
        crate::css_case_dashboard_view::types::DashboardCardKind::UpdatedToday,
        crate::css_case_dashboard_view::types::DashboardCardKind::EscalatedRecently,
    ];
    let mut metrics = Vec::new();
    let mut inbox_previews = Vec::new();

    for kind in card_kinds {
        let (metric, preview) = crate::css_case_dashboard_view::runtime::load_dashboard_card(
            pool,
            kind,
            &req.today_yyyy_mm_dd,
        )
        .await?;
        metrics.push(metric);
        inbox_previews.push(preview);
    }

    let dashboard = crate::css_case_dashboard_view::types::CssCaseDashboardView {
        kpi: Some(kpi.clone()),
        analytics: None,
        trends: Some(trends.clone()),
        alerts: Some(alerts.clone()),
        digest: None,
        metrics,
        inbox_previews,
    };

    let headline = crate::css_case_digest_engine::composer::build_headline(
        &req.today_yyyy_mm_dd,
        kpi.created_today_count,
        kpi.resolved_today_count,
    );
    let metric_bullets =
        crate::css_case_digest_engine::composer::build_metric_bullets(&kpi, &trends);
    let alert_bullets = crate::css_case_digest_engine::composer::build_alert_bullets(&alerts);
    let inbox_bullets = crate::css_case_digest_engine::composer::build_inbox_bullets(&dashboard);
    let bullets = crate::css_case_digest_engine::composer::merge_bullets(
        metric_bullets,
        alert_bullets,
        inbox_bullets,
    );
    let short_summary =
        crate::css_case_digest_engine::composer::build_short_summary(&kpi, &alerts, &dashboard);

    Ok(CssCaseDigestView {
        date: req.today_yyyy_mm_dd,
        headline,
        bullets,
        short_summary,
    })
}

#[cfg(test)]
mod tests {
    #[test]
    fn v208_merge_bullets_caps_output() {
        let bullets = crate::css_case_digest_engine::composer::merge_bullets(
            vec!["a".into(), "b".into(), "c".into(), "d".into()],
            vec!["e".into(), "f".into(), "g".into()],
            vec!["h".into(), "i".into()],
        );
        assert_eq!(bullets.len(), 8);
    }
}
