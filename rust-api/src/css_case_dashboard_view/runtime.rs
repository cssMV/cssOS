use crate::css_case_dashboard_view::types::{
    CssCaseDashboardView, DashboardCardKind, DashboardInboxPreview, DashboardMetricCard,
};

fn to_inbox_kind(kind: &DashboardCardKind) -> crate::css_case_inbox_view::types::InboxKind {
    match kind {
        DashboardCardKind::Pending => crate::css_case_inbox_view::types::InboxKind::Pending,
        DashboardCardKind::HighRisk => crate::css_case_inbox_view::types::InboxKind::HighRisk,
        DashboardCardKind::FrozenUntilReview => {
            crate::css_case_inbox_view::types::InboxKind::FrozenUntilReview
        }
        DashboardCardKind::UpdatedToday => {
            crate::css_case_inbox_view::types::InboxKind::UpdatedToday
        }
        DashboardCardKind::EscalatedRecently => {
            crate::css_case_inbox_view::types::InboxKind::EscalatedToManual
        }
    }
}

fn dashboard_label(kind: &DashboardCardKind) -> String {
    match kind {
        DashboardCardKind::Pending => "待处理数量".into(),
        DashboardCardKind::HighRisk => "高风险数量".into(),
        DashboardCardKind::FrozenUntilReview => "冻结待复核数量".into(),
        DashboardCardKind::UpdatedToday => "今日更新数量".into(),
        DashboardCardKind::EscalatedRecently => "最近升级人工数量".into(),
    }
}

pub async fn load_dashboard_card(
    pool: &sqlx::PgPool,
    kind: DashboardCardKind,
    today_yyyy_mm_dd: &str,
) -> anyhow::Result<(DashboardMetricCard, DashboardInboxPreview)> {
    let inbox = crate::css_case_inbox_view::runtime::load_inbox(
        pool,
        crate::css_case_inbox_view::types::InboxRequest {
            inbox: to_inbox_kind(&kind),
            limit: Some(5),
            offset: Some(0),
        },
        today_yyyy_mm_dd,
    )
    .await?;

    let metric = DashboardMetricCard {
        kind: kind.clone(),
        label: dashboard_label(&kind),
        total: inbox.total,
    };

    let preview = DashboardInboxPreview {
        kind,
        label: inbox.label,
        total: inbox.total,
        rows: inbox.rows,
    };

    Ok((metric, preview))
}

pub async fn build_dashboard(
    pool: &sqlx::PgPool,
    today_yyyy_mm_dd: &str,
) -> anyhow::Result<CssCaseDashboardView> {
    let card_kinds = vec![
        DashboardCardKind::Pending,
        DashboardCardKind::HighRisk,
        DashboardCardKind::FrozenUntilReview,
        DashboardCardKind::UpdatedToday,
        DashboardCardKind::EscalatedRecently,
    ];

    let mut metrics = Vec::new();
    let mut inbox_previews = Vec::new();
    let kpi = crate::css_case_kpi_view::runtime::build_case_kpi_view(
        pool,
        crate::css_case_kpi_view::types::CaseKpiRequest {
            today_yyyy_mm_dd: today_yyyy_mm_dd.to_string(),
        },
    )
    .await
    .ok();
    let analytics = crate::css_case_analytics_view::runtime::build_case_analytics_view(
        pool,
        crate::css_case_analytics_view::types::CaseAnalyticsRequest::default(),
    )
    .await
    .ok();
    let trends = crate::css_case_trends_view::runtime::build_case_trends_view(
        pool,
        crate::css_case_trends_view::types::CaseTrendsRequest {
            end_date_yyyy_mm_dd: today_yyyy_mm_dd.to_string(),
            days: 7,
        },
    )
    .await
    .ok();
    let alerts = crate::css_case_alerts_view::runtime::build_case_alerts_view(
        pool,
        crate::css_case_alerts_view::types::CaseAlertsRequest {
            end_date_yyyy_mm_dd: today_yyyy_mm_dd.to_string(),
            days: 7,
        },
    )
    .await
    .ok();
    let digest = crate::css_case_digest_engine::runtime::build_case_digest(
        pool,
        crate::css_case_digest_engine::types::CaseDigestRequest {
            today_yyyy_mm_dd: today_yyyy_mm_dd.to_string(),
            trend_days: 7,
        },
    )
    .await
    .ok();

    for kind in card_kinds {
        let (metric, preview) = load_dashboard_card(pool, kind, today_yyyy_mm_dd).await?;
        metrics.push(metric);
        inbox_previews.push(preview);
    }

    Ok(CssCaseDashboardView {
        kpi,
        analytics,
        trends,
        alerts,
        digest,
        metrics,
        inbox_previews,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v203_escalated_recently_maps_to_escalated_inbox() {
        assert_eq!(
            to_inbox_kind(&DashboardCardKind::EscalatedRecently),
            crate::css_case_inbox_view::types::InboxKind::EscalatedToManual
        );
    }
}
