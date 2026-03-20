use std::collections::HashSet;

use crate::css_case_delivery_ops_console::types::{
    CssCaseDeliveryOpsConsole, DeliveryOpsConsoleActionItem, DeliveryOpsConsoleRequest,
    DeliveryOpsConsoleStatusItem,
};

async fn build_recent_status_items(
    pool: &sqlx::PgPool,
    limit: usize,
) -> anyhow::Result<Vec<DeliveryOpsConsoleStatusItem>> {
    let mut logs = crate::css_case_delivery_log::store_pg::list_all_delivery_logs(pool)
        .await
        .unwrap_or_default();

    logs.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    let mut items = Vec::new();
    let mut seen = HashSet::new();

    for log in logs {
        let key = format!(
            "{}::{:?}::{:?}::{:?}::{:?}",
            log.subscription_id.clone().unwrap_or_default(),
            log.delivery_mode,
            log.delivery_target,
            log.report_type,
            log.export_format
        );

        if !seen.insert(key) {
            continue;
        }

        let summary = if log.succeeded {
            format!("最近一次 {:?} 交付成功。", log.report_type)
        } else {
            format!("最近一次 {:?} 交付失败。", log.report_type)
        };

        items.push(DeliveryOpsConsoleStatusItem {
            subscription_id: log.subscription_id.clone(),
            summary,
            updated_at: Some(log.created_at.clone()),
        });

        if items.len() >= limit {
            break;
        }
    }

    Ok(items)
}

pub async fn build_delivery_ops_console(
    pool: &sqlx::PgPool,
    req: DeliveryOpsConsoleRequest,
) -> anyhow::Result<CssCaseDeliveryOpsConsole> {
    let now_rfc3339 = crate::timeutil::now_rfc3339();
    let dashboard =
        crate::css_case_delivery_dashboard_view::runtime::build_delivery_dashboard_view(
            pool,
            crate::css_case_delivery_dashboard_view::types::DeliveryDashboardRequest {
                preview_limit: req.preview_limit,
            },
            &now_rfc3339,
        )
        .await?;

    let alerts = crate::css_case_delivery_alerts_view::runtime::build_delivery_alerts_view(
        pool,
        crate::css_case_delivery_alerts_view::types::DeliveryAlertsRequest { days: req.days },
    )
    .await?;

    let recovery = crate::css_case_delivery_recovery_view::runtime::build_delivery_recovery_view(
        pool,
        crate::css_case_delivery_recovery_view::types::DeliveryRecoveryViewRequest {
            limit: req.recovery_limit,
        },
    )
    .await?;

    let recent_status_items =
        build_recent_status_items(pool, req.preview_limit.unwrap_or(10)).await?;

    let actions = vec![
        DeliveryOpsConsoleActionItem {
            action_key: "retry_latest_failed".into(),
            title: "重试最近一次失败".into(),
            description: "对最近一次失败的 delivery 执行恢复重试。".into(),
        },
        DeliveryOpsConsoleActionItem {
            action_key: "retry_from_recovery_queue".into(),
            title: "从恢复队列发起重试".into(),
            description: "针对待恢复或重试后仍失败的对象执行重试。".into(),
        },
    ];

    Ok(CssCaseDeliveryOpsConsole {
        dashboard,
        alerts,
        recovery,
        recent_status_items,
        actions,
    })
}
