fn insight(
    key: &str,
    title: &str,
    summary: String,
    details: Vec<String>,
) -> crate::css_case_delivery_analytics_view::types::DeliveryAnalyticsInsight {
    crate::css_case_delivery_analytics_view::types::DeliveryAnalyticsInsight {
        key: key.to_string(),
        title: title.to_string(),
        summary,
        details,
    }
}

async fn escalation_structure_insight(
    pool: &sqlx::PgPool,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_analytics_view::types::DeliveryAnalyticsInsight> {
    use crate::css_case_delivery_query_engine::types::{
        DeliveryQueryFilters, DeliveryQueryRequest,
    };
    use crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState;

    let escalated = crate::css_case_delivery_query_engine::runtime::query_delivery_objects(
        pool,
        DeliveryQueryRequest {
            filters: DeliveryQueryFilters {
                state: Some(DeliveryResolutionState::Escalated),
                ..Default::default()
            },
            limit: None,
        },
        now_rfc3339,
    )
    .await?;

    Ok(insight(
        "escalation_structure",
        "升级结构分析",
        format!("当前共有 {} 个对象处于 escalated。", escalated.items.len()),
        vec![
            "第一版先按当前正式状态聚合升级对象。".into(),
            "后续可继续细分到 trust、risk 与动作来源。".into(),
        ],
    ))
}

async fn manual_intervention_structure_insight(
    pool: &sqlx::PgPool,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_analytics_view::types::DeliveryAnalyticsInsight> {
    use crate::css_case_delivery_query_engine::types::{
        DeliveryQueryFilters, DeliveryQueryRequest,
    };
    use crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState;

    let items = crate::css_case_delivery_query_engine::runtime::query_delivery_objects(
        pool,
        DeliveryQueryRequest {
            filters: DeliveryQueryFilters {
                state: Some(DeliveryResolutionState::UnderManualIntervention),
                ..Default::default()
            },
            limit: None,
        },
        now_rfc3339,
    )
    .await?;

    Ok(insight(
        "manual_intervention_structure",
        "人工介入结构分析",
        format!("当前共有 {} 个对象处于人工介入中。", items.items.len()),
        vec![
            "第一版按正式处置状态识别人工介入对象。".into(),
            "后续可叠加 must-deliver 与 no-silent-failure 结构。".into(),
        ],
    ))
}

async fn monitoring_only_structure_insight(
    pool: &sqlx::PgPool,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_analytics_view::types::DeliveryAnalyticsInsight> {
    use crate::css_case_delivery_query_engine::types::{
        DeliveryQueryFilters, DeliveryQueryRequest,
    };
    use crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState;

    let items = crate::css_case_delivery_query_engine::runtime::query_delivery_objects(
        pool,
        DeliveryQueryRequest {
            filters: DeliveryQueryFilters {
                state: Some(DeliveryResolutionState::MonitoringOnly),
                ..Default::default()
            },
            limit: None,
        },
        now_rfc3339,
    )
    .await?;

    Ok(insight(
        "monitoring_only_structure",
        "监控态结构分析",
        format!(
            "当前共有 {} 个对象停留在 monitoring_only。",
            items.items.len()
        ),
        vec![
            "第一版按正式状态聚合监控态对象。".into(),
            "后续可继续分析其停留时长与转出率。".into(),
        ],
    ))
}

async fn retry_after_state_insight(
    pool: &sqlx::PgPool,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_analytics_view::types::DeliveryAnalyticsInsight> {
    use crate::css_case_delivery_query_engine::types::{
        DeliveryQueryFilters, DeliveryQueryRequest,
    };

    let retry_items = crate::css_case_delivery_query_engine::runtime::query_delivery_objects(
        pool,
        DeliveryQueryRequest {
            filters: DeliveryQueryFilters {
                has_recent_retry: Some(true),
                ..Default::default()
            },
            limit: None,
        },
        now_rfc3339,
    )
    .await?;

    Ok(insight(
        "retry_after_state_structure",
        "Retry 前置状态分析",
        format!(
            "当前共有 {} 个对象存在 recent retry。",
            retry_items.items.len()
        ),
        vec![
            "第一版先识别最近重试对象集合。".into(),
            "后续可进一步分析 retry 前最常见的 resolution、trust 与 risk 状态。".into(),
        ],
    ))
}

fn analytics_summary(
    insights: &[crate::css_case_delivery_analytics_view::types::DeliveryAnalyticsInsight],
) -> String {
    format!("当前共生成 {} 条交付运营结构洞察。", insights.len())
}

pub async fn build_delivery_analytics_view(
    pool: &sqlx::PgPool,
    _req: crate::css_case_delivery_analytics_view::types::DeliveryAnalyticsViewRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_analytics_view::types::CssCaseDeliveryAnalyticsView> {
    let insights = vec![
        escalation_structure_insight(pool, now_rfc3339).await?,
        manual_intervention_structure_insight(pool, now_rfc3339).await?,
        monitoring_only_structure_insight(pool, now_rfc3339).await?,
        retry_after_state_insight(pool, now_rfc3339).await?,
    ];

    let summary = analytics_summary(&insights);

    Ok(
        crate::css_case_delivery_analytics_view::types::CssCaseDeliveryAnalyticsView {
            summary,
            insights,
        },
    )
}
