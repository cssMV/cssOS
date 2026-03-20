fn card_title(
    kind: &crate::css_case_delivery_dashboard_view::types::DeliveryDashboardCardKind,
) -> String {
    match kind {
        crate::css_case_delivery_dashboard_view::types::DeliveryDashboardCardKind::NeedsAttention => {
            "待关注".into()
        }
        crate::css_case_delivery_dashboard_view::types::DeliveryDashboardCardKind::Escalated => {
            "已升级".into()
        }
        crate::css_case_delivery_dashboard_view::types::DeliveryDashboardCardKind::UnderManualIntervention => {
            "人工介入中".into()
        }
        crate::css_case_delivery_dashboard_view::types::DeliveryDashboardCardKind::RecentRetry => {
            "最近重试".into()
        }
        crate::css_case_delivery_dashboard_view::types::DeliveryDashboardCardKind::RecentResolutionChange => {
            "最近状态变化".into()
        }
    }
}

fn dashboard_key(kind: &crate::css_case_delivery_inbox_view::types::DeliveryInboxKind) -> String {
    format!("{:?}", kind).to_lowercase()
}

fn dashboard_kind_from_inbox_kind(
    kind: &crate::css_case_delivery_inbox_view::types::DeliveryInboxKind,
) -> crate::css_case_delivery_dashboard_view::types::DeliveryDashboardCardKind {
    match kind {
        crate::css_case_delivery_inbox_view::types::DeliveryInboxKind::NeedsAttention => {
            crate::css_case_delivery_dashboard_view::types::DeliveryDashboardCardKind::NeedsAttention
        }
        crate::css_case_delivery_inbox_view::types::DeliveryInboxKind::Escalated => {
            crate::css_case_delivery_dashboard_view::types::DeliveryDashboardCardKind::Escalated
        }
        crate::css_case_delivery_inbox_view::types::DeliveryInboxKind::UnderManualIntervention => {
            crate::css_case_delivery_dashboard_view::types::DeliveryDashboardCardKind::UnderManualIntervention
        }
        crate::css_case_delivery_inbox_view::types::DeliveryInboxKind::RecentRetry => {
            crate::css_case_delivery_dashboard_view::types::DeliveryDashboardCardKind::RecentRetry
        }
        crate::css_case_delivery_inbox_view::types::DeliveryInboxKind::RecentResolutionChange => {
            crate::css_case_delivery_dashboard_view::types::DeliveryDashboardCardKind::RecentResolutionChange
        }
    }
}

fn preview_subject_key(
    item: &crate::css_case_delivery_query_engine::types::DeliveryQueryResultItem,
) -> String {
    format!("delivery::{:?}::{:?}", item.target, item.mode)
}

fn metric_card(
    section: &crate::css_case_delivery_inbox_view::types::DeliveryInboxSection,
) -> crate::css_case_delivery_dashboard_view::types::DeliveryDashboardMetricCard {
    crate::css_case_delivery_dashboard_view::types::DeliveryDashboardMetricCard {
        key: dashboard_key(&section.kind),
        title: section.title.clone(),
        count: section.items.len(),
    }
}

fn inbox_preview(
    section: &crate::css_case_delivery_inbox_view::types::DeliveryInboxSection,
) -> crate::css_case_delivery_dashboard_view::types::DeliveryDashboardInboxPreview {
    crate::css_case_delivery_dashboard_view::types::DeliveryDashboardInboxPreview {
        key: dashboard_key(&section.kind),
        title: section.title.clone(),
        count: section.items.len(),
        items: section.items.clone(),
    }
}

fn dashboard_summary(
    metrics: &[crate::css_case_delivery_dashboard_view::types::DeliveryDashboardMetricCard],
) -> String {
    let total: usize = metrics.iter().map(|x| x.count).sum();
    format!("当前看板共聚合 {} 个默认工作队列项目。", total)
}

fn card_from_section(
    section: crate::css_case_delivery_inbox_view::types::DeliveryInboxSection,
    preview_limit: usize,
) -> crate::css_case_delivery_dashboard_view::types::DeliveryDashboardCard {
    let kind = dashboard_kind_from_inbox_kind(&section.kind);

    let preview_subject_keys = section
        .items
        .iter()
        .take(preview_limit)
        .map(preview_subject_key)
        .collect::<Vec<_>>();

    crate::css_case_delivery_dashboard_view::types::DeliveryDashboardCard {
        title: card_title(&kind),
        kind,
        count: section.items.len(),
        preview_subject_keys,
    }
}

pub async fn build_delivery_dashboard_view(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_dashboard_view::types::DeliveryDashboardRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_dashboard_view::types::CssCaseDeliveryDashboardView> {
    let preview_limit = req.preview_limit.unwrap_or(3);

    let inbox = crate::css_case_delivery_inbox_view::runtime::build_delivery_inbox_view(
        pool,
        crate::css_case_delivery_inbox_view::types::DeliveryInboxViewRequest {
            section_limit: Some(20),
        },
        now_rfc3339,
    )
    .await?;

    let cards = inbox
        .sections
        .clone()
        .into_iter()
        .map(|section| card_from_section(section, preview_limit))
        .collect::<Vec<_>>();

    let metrics = inbox.sections.iter().map(metric_card).collect::<Vec<_>>();
    let inbox_previews = inbox.sections.iter().map(inbox_preview).collect::<Vec<_>>();
    let summary = dashboard_summary(&metrics);

    Ok(
        crate::css_case_delivery_dashboard_view::types::CssCaseDeliveryDashboardView {
            summary,
            metrics,
            inbox_previews,
            cards,
        },
    )
}
