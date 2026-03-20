use std::collections::HashMap;

use crate::css_case_delivery_inbox_view::types::{
    CssCaseDeliveryInboxView, DeliveryInboxKind, DeliveryInboxSection, DeliveryInboxViewRequest,
};

fn inbox_title(kind: &DeliveryInboxKind) -> String {
    match kind {
        DeliveryInboxKind::NeedsAttention => "待关注".into(),
        DeliveryInboxKind::Escalated => "已升级".into(),
        DeliveryInboxKind::UnderManualIntervention => "人工介入中".into(),
        DeliveryInboxKind::RecentRetry => "最近重试".into(),
        DeliveryInboxKind::RecentResolutionChange => "最近状态变化".into(),
    }
}

fn inbox_description(kind: &DeliveryInboxKind) -> String {
    match kind {
        DeliveryInboxKind::NeedsAttention => "当前最值得优先关注和处理的对象。".into(),
        DeliveryInboxKind::Escalated => "当前正式状态已进入 escalated 的对象。".into(),
        DeliveryInboxKind::UnderManualIntervention => "当前已进入人工介入路径的对象。".into(),
        DeliveryInboxKind::RecentRetry => "最近执行过 retry 动作的对象。".into(),
        DeliveryInboxKind::RecentResolutionChange => "最近发生过正式处置状态变化的对象。".into(),
    }
}

async fn build_inbox_section(
    pool: &sqlx::PgPool,
    kind: DeliveryInboxKind,
    limit: Option<usize>,
    now_rfc3339: &str,
) -> anyhow::Result<DeliveryInboxSection> {
    use crate::css_case_delivery_query_engine::types::{
        DeliveryQueryFilters, DeliveryQueryRequest,
    };

    let filters = match kind {
        DeliveryInboxKind::NeedsAttention => DeliveryQueryFilters {
            trust_level: Some(crate::css_case_delivery_trust_view::types::DeliveryTrustLevel::Risky),
            ..Default::default()
        },
        DeliveryInboxKind::Escalated => DeliveryQueryFilters {
            state: Some(
                crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState::Escalated,
            ),
            ..Default::default()
        },
        DeliveryInboxKind::UnderManualIntervention => DeliveryQueryFilters {
            state: Some(
                crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState::UnderManualIntervention,
            ),
            ..Default::default()
        },
        DeliveryInboxKind::RecentRetry => DeliveryQueryFilters {
            has_recent_retry: Some(true),
            ..Default::default()
        },
        DeliveryInboxKind::RecentResolutionChange => DeliveryQueryFilters {
            has_recent_resolution_change: Some(true),
            ..Default::default()
        },
    };

    let result = crate::css_case_delivery_query_engine::runtime::query_delivery_objects(
        pool,
        DeliveryQueryRequest { filters, limit },
        now_rfc3339,
    )
    .await?;

    Ok(DeliveryInboxSection {
        title: inbox_title(&kind),
        description: inbox_description(&kind),
        kind,
        items: result.items,
    })
}

async fn build_needs_attention_section(
    pool: &sqlx::PgPool,
    limit: Option<usize>,
    now_rfc3339: &str,
) -> anyhow::Result<DeliveryInboxSection> {
    let risky = crate::css_case_delivery_query_engine::runtime::query_delivery_objects(
        pool,
        crate::css_case_delivery_query_engine::types::DeliveryQueryRequest {
            filters: crate::css_case_delivery_query_engine::types::DeliveryQueryFilters {
                trust_level: Some(
                    crate::css_case_delivery_trust_view::types::DeliveryTrustLevel::Risky,
                ),
                ..Default::default()
            },
            limit,
        },
        now_rfc3339,
    )
    .await?;

    let manual = crate::css_case_delivery_query_engine::runtime::query_delivery_objects(
        pool,
        crate::css_case_delivery_query_engine::types::DeliveryQueryRequest {
            filters: crate::css_case_delivery_query_engine::types::DeliveryQueryFilters {
                requires_manual_intervention: Some(true),
                ..Default::default()
            },
            limit,
        },
        now_rfc3339,
    )
    .await?;

    let untrusted = crate::css_case_delivery_query_engine::runtime::query_delivery_objects(
        pool,
        crate::css_case_delivery_query_engine::types::DeliveryQueryRequest {
            filters: crate::css_case_delivery_query_engine::types::DeliveryQueryFilters {
                trust_level: Some(
                    crate::css_case_delivery_trust_view::types::DeliveryTrustLevel::Untrusted,
                ),
                ..Default::default()
            },
            limit,
        },
        now_rfc3339,
    )
    .await?;

    let mut map: HashMap<
        String,
        crate::css_case_delivery_query_engine::types::DeliveryQueryResultItem,
    > = HashMap::new();

    for item in risky
        .items
        .into_iter()
        .chain(manual.items.into_iter())
        .chain(untrusted.items.into_iter())
    {
        let key = format!("{:?}::{:?}", item.target, item.mode);
        map.entry(key).or_insert(item);
    }

    let mut items = map.into_values().collect::<Vec<_>>();
    items.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    items.truncate(limit.unwrap_or(20));

    Ok(DeliveryInboxSection {
        kind: DeliveryInboxKind::NeedsAttention,
        title: inbox_title(&DeliveryInboxKind::NeedsAttention),
        description: inbox_description(&DeliveryInboxKind::NeedsAttention),
        items,
    })
}

pub async fn build_delivery_inbox_view(
    pool: &sqlx::PgPool,
    req: DeliveryInboxViewRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryInboxView> {
    let limit = req.section_limit.or(Some(20));

    let mut sections = Vec::new();
    sections.push(build_needs_attention_section(pool, limit, now_rfc3339).await?);

    for kind in [
        DeliveryInboxKind::Escalated,
        DeliveryInboxKind::UnderManualIntervention,
        DeliveryInboxKind::RecentRetry,
        DeliveryInboxKind::RecentResolutionChange,
    ] {
        sections.push(build_inbox_section(pool, kind, limit, now_rfc3339).await?);
    }

    Ok(CssCaseDeliveryInboxView { sections })
}
