fn report_title(kind: &crate::css_case_delivery_report_api::types::DeliveryReportKind) -> String {
    use crate::css_case_delivery_report_api::types::DeliveryReportKind as K;

    match kind {
        K::Dashboard => "交付看板报表".into(),
        K::Kpi => "交付 KPI 报表".into(),
        K::Analytics => "交付分析报表".into(),
        K::Trends => "交付趋势报表".into(),
        K::Alerts => "交付预警报表".into(),
        K::Digest => "交付日报报表".into(),
        K::BriefingPack => "交付简报包".into(),
    }
}

fn report_meta(
    kind: crate::css_case_delivery_report_api::types::DeliveryReportKind,
    now_rfc3339: &str,
) -> crate::css_case_delivery_report_api::types::DeliveryReportMeta {
    crate::css_case_delivery_report_api::types::DeliveryReportMeta {
        title: report_title(&kind),
        kind,
        generated_at: now_rfc3339.to_string(),
    }
}

pub async fn build_delivery_dashboard(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_report_api::types::GetDeliveryDashboardRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_dashboard_view::types::CssCaseDeliveryDashboardView> {
    crate::css_case_delivery_dashboard_view::runtime::build_delivery_dashboard_view(
        pool,
        crate::css_case_delivery_dashboard_view::types::DeliveryDashboardRequest {
            preview_limit: req.preview_limit,
        },
        now_rfc3339,
    )
    .await
}

pub async fn build_delivery_kpi(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_report_api::types::GetDeliveryKpiRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_kpi_view::types::CssCaseDeliveryKpiView> {
    crate::css_case_delivery_kpi_view::runtime::build_delivery_kpi_view(
        pool,
        crate::css_case_delivery_kpi_view::types::DeliveryKpiViewRequest { limit: req.limit },
        now_rfc3339,
    )
    .await
}

pub async fn build_delivery_analytics(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_report_api::types::GetDeliveryAnalyticsRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_analytics_view::types::CssCaseDeliveryAnalyticsView> {
    crate::css_case_delivery_analytics_view::runtime::build_delivery_analytics_view(
        pool,
        crate::css_case_delivery_analytics_view::types::DeliveryAnalyticsViewRequest {
            limit: req.limit,
        },
        now_rfc3339,
    )
    .await
}

pub async fn build_delivery_trends(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_report_api::types::GetDeliveryTrendsRequest,
) -> anyhow::Result<crate::css_case_delivery_trends_view::types::CssCaseDeliveryTrendsView> {
    crate::css_case_delivery_trends_view::runtime::build_delivery_trends_view(
        pool,
        crate::css_case_delivery_trends_view::types::DeliveryTrendsViewRequest { days: req.days },
    )
    .await
}

pub async fn build_delivery_alerts(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_report_api::types::GetDeliveryAlertsRequest,
) -> anyhow::Result<crate::css_case_delivery_alerts_view::types::CssCaseDeliveryAlertsView> {
    crate::css_case_delivery_alerts_view::runtime::build_delivery_alerts_view(
        pool,
        crate::css_case_delivery_alerts_view::types::DeliveryAlertsRequest { days: req.days },
    )
    .await
}

pub async fn build_delivery_digest(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_report_api::types::GetDeliveryDigestRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_digest_engine::types::CssCaseDeliveryDigest> {
    crate::css_case_delivery_digest_engine::runtime::build_delivery_digest(
        pool,
        crate::css_case_delivery_digest_engine::types::DeliveryDigestRequest {
            days: req.days,
            preview_limit: req.preview_limit,
        },
        now_rfc3339,
    )
    .await
}

pub async fn build_delivery_briefing_pack(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_report_api::types::GetDeliveryBriefingPackRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_briefing_pack::types::CssCaseDeliveryBriefingPack> {
    crate::css_case_delivery_briefing_pack::runtime::build_delivery_briefing_pack(
        pool,
        crate::css_case_delivery_briefing_pack::types::DeliveryBriefingPackRequest {
            days: req.days,
            preview_limit: req.preview_limit,
        },
        now_rfc3339,
    )
    .await
}

pub async fn build_delivery_report(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_report_api::types::DeliveryReportApiRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_report_api::types::CssCaseDeliveryReportApiResponse> {
    use crate::css_case_delivery_report_api::types::{
        CssCaseDeliveryReportApiResponse, DeliveryReportKind as K, DeliveryReportPayload,
    };

    let kind = req.kind.clone();

    let data = match req.kind {
        K::Dashboard => DeliveryReportPayload::Dashboard(
            build_delivery_dashboard(
                pool,
                crate::css_case_delivery_report_api::types::GetDeliveryDashboardRequest {
                    preview_limit: req.preview_limit,
                },
                now_rfc3339,
            )
            .await?,
        ),
        K::Kpi => DeliveryReportPayload::Kpi(
            build_delivery_kpi(
                pool,
                crate::css_case_delivery_report_api::types::GetDeliveryKpiRequest { limit: None },
                now_rfc3339,
            )
            .await?,
        ),
        K::Analytics => DeliveryReportPayload::Analytics(
            build_delivery_analytics(
                pool,
                crate::css_case_delivery_report_api::types::GetDeliveryAnalyticsRequest {
                    limit: None,
                },
                now_rfc3339,
            )
            .await?,
        ),
        K::Trends => DeliveryReportPayload::Trends(
            build_delivery_trends(
                pool,
                crate::css_case_delivery_report_api::types::GetDeliveryTrendsRequest {
                    days: req.days,
                },
            )
            .await?,
        ),
        K::Alerts => DeliveryReportPayload::Alerts(
            build_delivery_alerts(
                pool,
                crate::css_case_delivery_report_api::types::GetDeliveryAlertsRequest {
                    days: req.days,
                },
            )
            .await?,
        ),
        K::Digest => DeliveryReportPayload::Digest(
            build_delivery_digest(
                pool,
                crate::css_case_delivery_report_api::types::GetDeliveryDigestRequest {
                    days: req.days,
                    preview_limit: req.preview_limit,
                },
                now_rfc3339,
            )
            .await?,
        ),
        K::BriefingPack => DeliveryReportPayload::BriefingPack(
            build_delivery_briefing_pack(
                pool,
                crate::css_case_delivery_report_api::types::GetDeliveryBriefingPackRequest {
                    days: req.days,
                    preview_limit: req.preview_limit,
                },
                now_rfc3339,
            )
            .await?,
        ),
    };

    Ok(CssCaseDeliveryReportApiResponse {
        meta: report_meta(kind, now_rfc3339),
        data,
    })
}
