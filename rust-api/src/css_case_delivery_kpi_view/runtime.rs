fn ratio(numerator: usize, denominator: usize) -> f64 {
    if denominator == 0 {
        0.0
    } else {
        numerator as f64 / denominator as f64
    }
}

fn metric(
    key: &str,
    label: &str,
    numerator: usize,
    denominator: usize,
) -> crate::css_case_delivery_kpi_view::types::DeliveryKpiMetric {
    crate::css_case_delivery_kpi_view::types::DeliveryKpiMetric {
        key: key.to_string(),
        label: label.to_string(),
        numerator,
        denominator,
        ratio: ratio(numerator, denominator),
    }
}

pub async fn build_delivery_kpi_view(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_kpi_view::types::DeliveryKpiViewRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_kpi_view::types::CssCaseDeliveryKpiView> {
    use crate::css_case_delivery_query_engine::types::{
        DeliveryQueryFilters, DeliveryQueryRequest,
    };
    use crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState;

    let all = crate::css_case_delivery_query_engine::runtime::query_delivery_objects(
        pool,
        DeliveryQueryRequest {
            filters: DeliveryQueryFilters::default(),
            limit: req.limit,
        },
        now_rfc3339,
    )
    .await?;
    let total = all.items.len();

    let escalated = crate::css_case_delivery_query_engine::runtime::query_delivery_objects(
        pool,
        DeliveryQueryRequest {
            filters: DeliveryQueryFilters {
                state: Some(DeliveryResolutionState::Escalated),
                ..Default::default()
            },
            limit: req.limit,
        },
        now_rfc3339,
    )
    .await?
    .items
    .len();

    let manual = crate::css_case_delivery_query_engine::runtime::query_delivery_objects(
        pool,
        DeliveryQueryRequest {
            filters: DeliveryQueryFilters {
                state: Some(DeliveryResolutionState::UnderManualIntervention),
                ..Default::default()
            },
            limit: req.limit,
        },
        now_rfc3339,
    )
    .await?
    .items
    .len();

    let retry = crate::css_case_delivery_query_engine::runtime::query_delivery_objects(
        pool,
        DeliveryQueryRequest {
            filters: DeliveryQueryFilters {
                has_recent_retry: Some(true),
                ..Default::default()
            },
            limit: req.limit,
        },
        now_rfc3339,
    )
    .await?
    .items
    .len();

    let resolved = crate::css_case_delivery_query_engine::runtime::query_delivery_objects(
        pool,
        DeliveryQueryRequest {
            filters: DeliveryQueryFilters {
                state: Some(DeliveryResolutionState::Resolved),
                ..Default::default()
            },
            limit: req.limit,
        },
        now_rfc3339,
    )
    .await?
    .items
    .len();

    let stabilized = crate::css_case_delivery_query_engine::runtime::query_delivery_objects(
        pool,
        DeliveryQueryRequest {
            filters: DeliveryQueryFilters {
                state: Some(DeliveryResolutionState::Stabilized),
                ..Default::default()
            },
            limit: req.limit,
        },
        now_rfc3339,
    )
    .await?
    .items
    .len();

    let monitoring_only = crate::css_case_delivery_query_engine::runtime::query_delivery_objects(
        pool,
        DeliveryQueryRequest {
            filters: DeliveryQueryFilters {
                state: Some(DeliveryResolutionState::MonitoringOnly),
                ..Default::default()
            },
            limit: req.limit,
        },
        now_rfc3339,
    )
    .await?
    .items
    .len();

    let metrics = vec![
        metric("escalated_ratio", "当前已升级占比", escalated, total),
        metric(
            "manual_intervention_ratio",
            "当前人工介入占比",
            manual,
            total,
        ),
        metric("retry_coverage_ratio", "最近重试覆盖率", retry, total),
        metric(
            "resolved_or_stabilized_ratio",
            "resolved / stabilized 比例",
            resolved + stabilized,
            total,
        ),
        metric(
            "monitoring_only_ratio",
            "monitoring_only 比例",
            monitoring_only,
            total,
        ),
    ];

    Ok(crate::css_case_delivery_kpi_view::types::CssCaseDeliveryKpiView { metrics })
}
