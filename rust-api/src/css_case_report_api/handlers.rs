use crate::css_case_report_api::types::{
    CssCaseReportBundleResponse, GetCaseAlertsRequest, GetCaseAnalyticsRequest,
    GetCaseBriefingRequest, GetCaseDashboardRequest, GetCaseDigestRequest, GetCaseKpiRequest,
    GetCaseReportBundleRequest, GetCaseTrendsRequest,
};

// Legacy-kept report facade for the older case domain.
// Delivery export/download flows should not add new dependencies here.

pub async fn get_case_dashboard(
    pool: &sqlx::PgPool,
    req: GetCaseDashboardRequest,
) -> anyhow::Result<crate::css_case_dashboard_view::types::CssCaseDashboardView> {
    crate::css_case_dashboard_view::runtime::build_dashboard(pool, &req.today_yyyy_mm_dd).await
}

pub async fn get_case_kpi(
    pool: &sqlx::PgPool,
    req: GetCaseKpiRequest,
) -> anyhow::Result<crate::css_case_kpi_view::types::CssCaseKpiView> {
    crate::css_case_kpi_view::runtime::build_case_kpi_view(
        pool,
        crate::css_case_kpi_view::types::CaseKpiRequest {
            today_yyyy_mm_dd: req.today_yyyy_mm_dd,
        },
    )
    .await
}

pub async fn get_case_analytics(
    pool: &sqlx::PgPool,
    _req: GetCaseAnalyticsRequest,
) -> anyhow::Result<crate::css_case_analytics_view::types::CssCaseAnalyticsView> {
    crate::css_case_analytics_view::runtime::build_case_analytics_view(
        pool,
        crate::css_case_analytics_view::types::CaseAnalyticsRequest::default(),
    )
    .await
}

pub async fn get_case_trends(
    pool: &sqlx::PgPool,
    req: GetCaseTrendsRequest,
) -> anyhow::Result<crate::css_case_trends_view::types::CssCaseTrendsView> {
    crate::css_case_trends_view::runtime::build_case_trends_view(
        pool,
        crate::css_case_trends_view::types::CaseTrendsRequest {
            end_date_yyyy_mm_dd: req.end_date_yyyy_mm_dd,
            days: req.days,
        },
    )
    .await
}

pub async fn get_case_alerts(
    pool: &sqlx::PgPool,
    req: GetCaseAlertsRequest,
) -> anyhow::Result<crate::css_case_alerts_view::types::CssCaseAlertsView> {
    crate::css_case_alerts_view::runtime::build_case_alerts_view(
        pool,
        crate::css_case_alerts_view::types::CaseAlertsRequest {
            end_date_yyyy_mm_dd: req.end_date_yyyy_mm_dd,
            days: req.days,
        },
    )
    .await
}

pub async fn get_case_digest(
    pool: &sqlx::PgPool,
    req: GetCaseDigestRequest,
) -> anyhow::Result<crate::css_case_digest_engine::types::CssCaseDigestView> {
    crate::css_case_digest_engine::runtime::build_case_digest(
        pool,
        crate::css_case_digest_engine::types::CaseDigestRequest {
            today_yyyy_mm_dd: req.today_yyyy_mm_dd,
            trend_days: req.trend_days,
        },
    )
    .await
}

pub async fn get_case_briefing(
    pool: &sqlx::PgPool,
    req: GetCaseBriefingRequest,
) -> anyhow::Result<crate::css_case_briefing_pack::types::CssCaseBriefingPack> {
    crate::css_case_briefing_pack::runtime::build_case_briefing_pack(
        pool,
        crate::css_case_briefing_pack::types::CaseBriefingPackRequest {
            today_yyyy_mm_dd: req.today_yyyy_mm_dd,
            trend_days: req.trend_days,
        },
    )
    .await
}

pub async fn get_case_report_bundle(
    pool: &sqlx::PgPool,
    req: GetCaseReportBundleRequest,
) -> anyhow::Result<CssCaseReportBundleResponse> {
    let dashboard = if req.include_dashboard {
        Some(
            get_case_dashboard(
                pool,
                GetCaseDashboardRequest {
                    today_yyyy_mm_dd: req.today_yyyy_mm_dd.clone(),
                },
            )
            .await?,
        )
    } else {
        None
    };

    let kpi = if req.include_kpi {
        Some(
            get_case_kpi(
                pool,
                GetCaseKpiRequest {
                    today_yyyy_mm_dd: req.today_yyyy_mm_dd.clone(),
                },
            )
            .await?,
        )
    } else {
        None
    };

    let analytics = if req.include_analytics {
        Some(get_case_analytics(pool, GetCaseAnalyticsRequest::default()).await?)
    } else {
        None
    };

    let trends = if req.include_trends {
        Some(
            get_case_trends(
                pool,
                GetCaseTrendsRequest {
                    end_date_yyyy_mm_dd: req.today_yyyy_mm_dd.clone(),
                    days: req.trend_days,
                },
            )
            .await?,
        )
    } else {
        None
    };

    let alerts = if req.include_alerts {
        Some(
            get_case_alerts(
                pool,
                GetCaseAlertsRequest {
                    end_date_yyyy_mm_dd: req.today_yyyy_mm_dd.clone(),
                    days: req.trend_days,
                },
            )
            .await?,
        )
    } else {
        None
    };

    let digest = if req.include_digest {
        Some(
            get_case_digest(
                pool,
                GetCaseDigestRequest {
                    today_yyyy_mm_dd: req.today_yyyy_mm_dd.clone(),
                    trend_days: req.trend_days,
                },
            )
            .await?,
        )
    } else {
        None
    };

    let briefing = if req.include_briefing {
        Some(
            get_case_briefing(
                pool,
                GetCaseBriefingRequest {
                    today_yyyy_mm_dd: req.today_yyyy_mm_dd.clone(),
                    trend_days: req.trend_days,
                },
            )
            .await?,
        )
    } else {
        None
    };

    Ok(CssCaseReportBundleResponse {
        dashboard,
        kpi,
        analytics,
        trends,
        alerts,
        digest,
        briefing,
    })
}
