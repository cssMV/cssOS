use crate::css_case_delivery_alerts_view::types::CssCaseDeliveryAlertsView;
use crate::css_case_delivery_briefing_pack::types::{
    CssCaseDeliveryBriefingPack, DeliveryBriefingAlertsBlock, DeliveryBriefingAnalyticsBlock,
    DeliveryBriefingInboxBlock, DeliveryBriefingKpiBlock, DeliveryBriefingPackRequest,
    DeliveryBriefingTrendsBlock,
};
use crate::css_case_delivery_digest_engine::types::CssCaseDeliveryDigest;

fn briefing_highlights(
    digest: &CssCaseDeliveryDigest,
    alerts: &CssCaseDeliveryAlertsView,
) -> Vec<String> {
    let mut out = Vec::new();

    out.push(digest.summary.clone());

    if !alerts.alerts.is_empty() {
        out.push(format!(
            "当前存在 {} 条需要关注的异常预警。",
            alerts.alerts.len()
        ));
    }

    if let Some(first) = digest.inbox_counts.first() {
        out.push(format!(
            "当前最主要工作队列“{}”共有 {} 项。",
            first.title, first.count
        ));
    }

    out
}

fn briefing_summary(digest: &CssCaseDeliveryDigest) -> String {
    digest.summary.clone()
}

pub async fn build_delivery_briefing_pack(
    pool: &sqlx::PgPool,
    req: DeliveryBriefingPackRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryBriefingPack> {
    let digest = crate::css_case_delivery_digest_engine::runtime::build_delivery_digest(
        pool,
        crate::css_case_delivery_digest_engine::types::DeliveryDigestRequest {
            days: req.days,
            preview_limit: req.preview_limit,
        },
        now_rfc3339,
    )
    .await?;

    let kpi = crate::css_case_delivery_kpi_view::runtime::build_delivery_kpi_view(
        pool,
        crate::css_case_delivery_kpi_view::types::DeliveryKpiViewRequest { limit: None },
        now_rfc3339,
    )
    .await?;

    let alerts = crate::css_case_delivery_alerts_view::runtime::build_delivery_alerts_view(
        pool,
        crate::css_case_delivery_alerts_view::types::DeliveryAlertsViewRequest { days: req.days },
    )
    .await?;

    let inbox = crate::css_case_delivery_inbox_view::runtime::build_delivery_inbox_view(
        pool,
        crate::css_case_delivery_inbox_view::types::DeliveryInboxViewRequest {
            section_limit: req.preview_limit.or(Some(5)),
        },
        now_rfc3339,
    )
    .await?;

    let trends = crate::css_case_delivery_trends_view::runtime::build_delivery_trends_view(
        pool,
        crate::css_case_delivery_trends_view::types::DeliveryTrendsViewRequest { days: req.days },
    )
    .await?;

    let analytics =
        crate::css_case_delivery_analytics_view::runtime::build_delivery_analytics_view(
            pool,
            crate::css_case_delivery_analytics_view::types::DeliveryAnalyticsViewRequest {
                limit: None,
            },
            now_rfc3339,
        )
        .await?;

    let highlights = briefing_highlights(&digest, &alerts);
    let summary = briefing_summary(&digest);

    Ok(CssCaseDeliveryBriefingPack {
        title: "交付管理简报".into(),
        summary,
        highlights,
        digest,
        kpi: DeliveryBriefingKpiBlock {
            metrics: kpi.metrics,
        },
        alerts: DeliveryBriefingAlertsBlock {
            alerts: alerts.alerts,
        },
        inbox: DeliveryBriefingInboxBlock {
            sections: inbox.sections,
        },
        trends: DeliveryBriefingTrendsBlock {
            series: trends.series,
        },
        analytics: DeliveryBriefingAnalyticsBlock {
            insights: analytics.insights,
        },
    })
}
