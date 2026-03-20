use crate::css_case_delivery_report_api::types::{
    CssCaseDeliveryReportApiResponse, CssCaseDeliveryReportBundleResponse,
    GetDeliveryAlertsRequest, GetDeliveryAnalyticsRequest, GetDeliveryBriefingPackRequest,
    GetDeliveryDashboardRequest, GetDeliveryDigestRequest, GetDeliveryKpiRequest,
    GetDeliveryReportBundleRequest, GetDeliveryReportRequest, GetDeliveryTrendsRequest,
};

pub async fn get_delivery_dashboard(
    pool: &sqlx::PgPool,
    req: GetDeliveryDashboardRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_dashboard_view::types::CssCaseDeliveryDashboardView> {
    crate::css_case_delivery_report_api::runtime::build_delivery_dashboard(pool, req, now_rfc3339)
        .await
}

pub async fn get_delivery_kpi(
    pool: &sqlx::PgPool,
    req: GetDeliveryKpiRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_kpi_view::types::CssCaseDeliveryKpiView> {
    crate::css_case_delivery_report_api::runtime::build_delivery_kpi(pool, req, now_rfc3339).await
}

pub async fn get_delivery_analytics(
    pool: &sqlx::PgPool,
    req: GetDeliveryAnalyticsRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_analytics_view::types::CssCaseDeliveryAnalyticsView> {
    crate::css_case_delivery_report_api::runtime::build_delivery_analytics(pool, req, now_rfc3339)
        .await
}

pub async fn get_delivery_trends(
    pool: &sqlx::PgPool,
    req: GetDeliveryTrendsRequest,
) -> anyhow::Result<crate::css_case_delivery_trends_view::types::CssCaseDeliveryTrendsView> {
    crate::css_case_delivery_report_api::runtime::build_delivery_trends(pool, req).await
}

pub async fn get_delivery_alerts(
    pool: &sqlx::PgPool,
    req: GetDeliveryAlertsRequest,
) -> anyhow::Result<crate::css_case_delivery_alerts_view::types::CssCaseDeliveryAlertsView> {
    crate::css_case_delivery_report_api::runtime::build_delivery_alerts(pool, req).await
}

pub async fn get_delivery_digest(
    pool: &sqlx::PgPool,
    req: GetDeliveryDigestRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_digest_engine::types::CssCaseDeliveryDigest> {
    crate::css_case_delivery_report_api::runtime::build_delivery_digest(pool, req, now_rfc3339)
        .await
}

pub async fn get_delivery_briefing_pack(
    pool: &sqlx::PgPool,
    req: GetDeliveryBriefingPackRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_briefing_pack::types::CssCaseDeliveryBriefingPack> {
    crate::css_case_delivery_report_api::runtime::build_delivery_briefing_pack(
        pool,
        req,
        now_rfc3339,
    )
    .await
}

pub async fn get_delivery_report(
    pool: &sqlx::PgPool,
    req: GetDeliveryReportRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryReportApiResponse> {
    crate::css_case_delivery_report_api::runtime::build_delivery_report(pool, req, now_rfc3339)
        .await
}

pub async fn get_delivery_report_bundle(
    pool: &sqlx::PgPool,
    req: GetDeliveryReportBundleRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryReportBundleResponse> {
    let dashboard = if req.include_dashboard {
        Some(
            get_delivery_dashboard(
                pool,
                GetDeliveryDashboardRequest {
                    preview_limit: req.preview_limit,
                },
                now_rfc3339,
            )
            .await?,
        )
    } else {
        None
    };

    let kpi = if req.include_kpi {
        Some(get_delivery_kpi(pool, GetDeliveryKpiRequest::default(), now_rfc3339).await?)
    } else {
        None
    };

    let analytics = if req.include_analytics {
        Some(
            get_delivery_analytics(pool, GetDeliveryAnalyticsRequest::default(), now_rfc3339)
                .await?,
        )
    } else {
        None
    };

    let trends = if req.include_trends {
        Some(get_delivery_trends(pool, GetDeliveryTrendsRequest { days: req.days }).await?)
    } else {
        None
    };

    let alerts = if req.include_alerts {
        Some(get_delivery_alerts(pool, GetDeliveryAlertsRequest { days: req.days }).await?)
    } else {
        None
    };

    let digest = if req.include_digest {
        Some(
            get_delivery_digest(
                pool,
                GetDeliveryDigestRequest {
                    days: req.days,
                    preview_limit: req.preview_limit,
                },
                now_rfc3339,
            )
            .await?,
        )
    } else {
        None
    };

    let briefing = if req.include_briefing {
        Some(
            get_delivery_briefing_pack(
                pool,
                GetDeliveryBriefingPackRequest {
                    days: req.days,
                    preview_limit: req.preview_limit,
                },
                now_rfc3339,
            )
            .await?,
        )
    } else {
        None
    };

    Ok(CssCaseDeliveryReportBundleResponse {
        dashboard,
        kpi,
        analytics,
        trends,
        alerts,
        digest,
        briefing,
    })
}
