use std::collections::HashMap;

use crate::css_case_delivery_query_engine::types::{
    CssCaseDeliveryQueryResult, DeliveryQueryFilters, DeliveryQueryRequest, DeliveryQueryResultItem,
};

fn subject_key(
    target: &crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    mode: &crate::css_case_delivery_log::types::CaseDeliveryLogMode,
) -> String {
    format!("{:?}::{:?}", target, mode)
}

async fn collect_subjects(
    pool: &sqlx::PgPool,
) -> anyhow::Result<
    Vec<(
        crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
        crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    )>,
> {
    let mut map: HashMap<
        String,
        (
            crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
            crate::css_case_delivery_log::types::CaseDeliveryLogMode,
        ),
    > = HashMap::new();

    let resolution_logs =
        crate::css_case_delivery_resolution_log::store_pg::list_delivery_resolution_logs(
            pool,
            &crate::css_case_delivery_resolution_log::types::DeliveryResolutionLogQueryRequest {
                target: None,
                mode: None,
                state: None,
                limit: Some(1000),
            },
        )
        .await
        .unwrap_or_default();

    for log in resolution_logs {
        map.entry(subject_key(&log.target, &log.mode))
            .or_insert((log.target, log.mode));
    }

    let action_logs = crate::css_case_delivery_action_log::store_pg::list_delivery_action_logs(
        pool,
        &crate::css_case_delivery_action_log::types::DeliveryActionLogQueryRequest {
            target: None,
            subject_key: None,
            actor_user_id: None,
            action: None,
            succeeded: None,
            limit: Some(1000),
        },
    )
    .await
    .unwrap_or_default();

    for log in action_logs {
        map.entry(subject_key(&log.target, &log.mode))
            .or_insert((log.target, log.mode));
    }

    Ok(map.into_values().collect())
}

async fn has_recent_retry(
    pool: &sqlx::PgPool,
    target: &crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    mode: &crate::css_case_delivery_log::types::CaseDeliveryLogMode,
) -> bool {
    let logs =
        crate::css_case_delivery_action_log::store_pg::list_delivery_action_logs_for_subject(
            pool,
            &crate::css_case_delivery_actions_engine::policy::subject_key(target, mode),
        )
        .await
        .unwrap_or_default();

    logs.iter().any(|x| {
        matches!(
            x.action,
            crate::css_case_delivery_actions_engine::types::DeliveryActionKind::Retry
        )
    })
}

async fn has_recent_resolution_change(
    pool: &sqlx::PgPool,
    target: &crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    mode: &crate::css_case_delivery_log::types::CaseDeliveryLogMode,
) -> bool {
    let logs =
        crate::css_case_delivery_resolution_log::store_pg::list_delivery_resolution_logs_for_subject(
            pool, target, mode,
        )
        .await
        .unwrap_or_default();

    logs.len() > 1
}

async fn matches_filters(
    pool: &sqlx::PgPool,
    target: &crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    mode: &crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    filters: &DeliveryQueryFilters,
    item: &DeliveryQueryResultItem,
) -> bool {
    if let Some(state) = &filters.state {
        if &item.status.state != state {
            return false;
        }
    }

    if let Some(trust_level) = &filters.trust_level {
        if &item.trust_level != trust_level {
            return false;
        }
    }

    if let Some(risk_level) = &filters.risk_level {
        if &item.risk_level != risk_level {
            return false;
        }
    }

    if let Some(v) = filters.requires_manual_intervention {
        if item.requires_manual_intervention != v {
            return false;
        }
    }

    if let Some(v) = filters.is_escalated {
        if item.is_escalated != v {
            return false;
        }
    }

    if let Some(v) = filters.has_recent_retry {
        if has_recent_retry(pool, target, mode).await != v {
            return false;
        }
    }

    if let Some(v) = filters.has_recent_resolution_change {
        if has_recent_resolution_change(pool, target, mode).await != v {
            return false;
        }
    }

    true
}

pub async fn query_delivery_objects(
    pool: &sqlx::PgPool,
    req: DeliveryQueryRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryQueryResult> {
    let subjects = collect_subjects(pool).await?;
    let mut items = Vec::new();

    for (target, mode) in subjects {
        let status = crate::css_case_delivery_status_view::runtime::build_delivery_status_view(
            pool,
            crate::css_case_delivery_status_view::types::DeliveryStatusViewRequest {
                target: target.clone(),
                mode: mode.clone(),
                consecutive_failures: 0,
                retry_still_failing: false,
                replay_limit: None,
                action_limit: None,
            },
        )
        .await?;

        let trust =
            crate::css_case_delivery_trust_view::runtime::build_delivery_trust_view_from_legacy(
                pool,
                crate::css_case_delivery_trust_view::types::DeliveryTrustRequest {
                    target: target.clone(),
                    mode: mode.clone(),
                    delivered: false,
                    failure_streak: 0,
                    consecutive_failures: Some(0),
                    retry_still_failing: false,
                },
                now_rfc3339,
            )
            .await?;

        let risk =
            crate::css_case_delivery_risk_view::runtime::build_delivery_risk_view_from_legacy(
                pool,
                crate::css_case_delivery_risk_view::types::DeliveryRiskRequest {
                    target: target.clone(),
                    mode: mode.clone(),
                    delivered: false,
                    failure_streak: 0,
                    consecutive_failures: Some(0),
                    retry_still_failing: false,
                },
                now_rfc3339,
            )
            .await?;

        let has_recent_retry = has_recent_retry(pool, &target, &mode).await;
        let has_recent_resolution_change = has_recent_resolution_change(pool, &target, &mode).await;

        let summary = crate::css_case_delivery_summary_engine::runtime::build_delivery_summary(
            pool,
            crate::css_case_delivery_summary_engine::types::DeliverySummaryRequest {
                target: target.clone(),
                mode: mode.clone(),
                consecutive_failures: 0,
                retry_still_failing: false,
                replay_limit: None,
                action_limit: None,
                timeline_limit: None,
            },
            now_rfc3339,
        )
        .await?;

        let item = DeliveryQueryResultItem {
            target: target.clone(),
            mode: mode.clone(),
            updated_at: status.updated_at.clone(),
            is_escalated: matches!(
                status.state,
                crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState::Escalated
            ),
            requires_manual_intervention: matches!(
                status.state,
                crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState::UnderManualIntervention
            ) || trust.requires_manual_intervention,
            has_recent_retry,
            has_recent_resolution_change,
            trust_level: trust.trust_level,
            risk_level: risk.risk_level,
            status,
            summary,
        };

        if !matches_filters(pool, &target, &mode, &req.filters, &item).await {
            continue;
        }

        items.push(item);
    }

    items.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    items.truncate(req.limit.unwrap_or(50));

    Ok(CssCaseDeliveryQueryResult { items })
}
