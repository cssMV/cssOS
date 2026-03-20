use std::collections::HashMap;

use crate::css_case_delivery_log::types::CssCaseDeliveryLogRecord;
use crate::css_case_delivery_recovery_view::types::{
    CssCaseDeliveryRecoveryView, DeliveryRecoveryItem, DeliveryRecoveryPriority,
    DeliveryRecoveryState, DeliveryRecoverySummary, DeliveryRecoveryViewRequest,
};

fn recovery_shape_key(log: &CssCaseDeliveryLogRecord) -> String {
    format!(
        "{}::{:?}::{:?}::{:?}::{:?}",
        log.subscription_id.clone().unwrap_or_default(),
        log.delivery_mode,
        log.delivery_target,
        log.report_type,
        log.export_format
    )
}

fn group_logs(
    logs: Vec<CssCaseDeliveryLogRecord>,
) -> HashMap<String, Vec<CssCaseDeliveryLogRecord>> {
    let mut map: HashMap<String, Vec<CssCaseDeliveryLogRecord>> = HashMap::new();

    for log in logs {
        map.entry(recovery_shape_key(&log)).or_default().push(log);
    }

    for items in map.values_mut() {
        items.sort_by(|a, b| a.created_at.cmp(&b.created_at));
    }

    map
}

fn has_failure(logs: &[CssCaseDeliveryLogRecord]) -> bool {
    logs.iter().any(|x| !x.succeeded)
}

fn latest_success(logs: &[CssCaseDeliveryLogRecord]) -> Option<&CssCaseDeliveryLogRecord> {
    logs.iter().rev().find(|x| x.succeeded)
}

fn latest_failure(logs: &[CssCaseDeliveryLogRecord]) -> Option<&CssCaseDeliveryLogRecord> {
    logs.iter().rev().find(|x| !x.succeeded)
}

fn recovery_state(logs: &[CssCaseDeliveryLogRecord]) -> Option<DeliveryRecoveryState> {
    if !has_failure(logs) {
        return None;
    }

    let last = logs.last()?;
    if last.succeeded {
        return Some(DeliveryRecoveryState::Recovered);
    }

    if logs.len() >= 2 {
        let retried_after_failure = logs.iter().rev().take(2).all(|x| !x.succeeded);
        if retried_after_failure {
            return Some(DeliveryRecoveryState::RetryStillFailing);
        }
    }

    Some(DeliveryRecoveryState::PendingRecovery)
}

fn recovery_priority(
    state: &DeliveryRecoveryState,
    target: &crate::css_case_delivery_api::types::DeliveryApiTarget,
) -> DeliveryRecoveryPriority {
    use crate::css_case_delivery_api::types::DeliveryApiTarget;

    match state {
        DeliveryRecoveryState::RetryStillFailing => DeliveryRecoveryPriority::High,
        DeliveryRecoveryState::PendingRecovery => match target {
            DeliveryApiTarget::Email | DeliveryApiTarget::ThirdPartyClient => {
                DeliveryRecoveryPriority::High
            }
            _ => DeliveryRecoveryPriority::Medium,
        },
        DeliveryRecoveryState::Recovered => DeliveryRecoveryPriority::Low,
    }
}

fn recovery_summary(state: &DeliveryRecoveryState, _logs: &[CssCaseDeliveryLogRecord]) -> String {
    match state {
        DeliveryRecoveryState::PendingRecovery => "最近一次交付失败，当前仍待恢复。".into(),
        DeliveryRecoveryState::Recovered => "该交付对象曾失败，但后续已恢复成功。".into(),
        DeliveryRecoveryState::RetryStillFailing => {
            "该交付对象在重试后仍然失败，需要优先处理。".into()
        }
    }
}

fn item_from_logs(logs: &[CssCaseDeliveryLogRecord]) -> Option<DeliveryRecoveryItem> {
    let first = logs.first()?;
    let state = recovery_state(logs)?;
    let priority = recovery_priority(&state, &first.delivery_target);

    Some(DeliveryRecoveryItem {
        subscription_id: first.subscription_id.clone(),
        mode: first.delivery_mode.clone(),
        target: first.delivery_target.clone(),
        report_type: first.report_type.clone(),
        export_format: first.export_format.clone(),
        state: state.clone(),
        priority,
        latest_failed_delivery_log_id: latest_failure(logs).map(|x| x.delivery_log_id.clone()),
        latest_success_delivery_log_id: latest_success(logs).map(|x| x.delivery_log_id.clone()),
        summary: recovery_summary(&state, logs),
    })
}

fn priority_rank(priority: &DeliveryRecoveryPriority) -> usize {
    match priority {
        DeliveryRecoveryPriority::High => 0,
        DeliveryRecoveryPriority::Medium => 1,
        DeliveryRecoveryPriority::Low => 2,
    }
}

fn sort_items(items: &mut Vec<DeliveryRecoveryItem>) {
    items.sort_by(|a, b| priority_rank(&a.priority).cmp(&priority_rank(&b.priority)));
}

fn build_priority_queue(
    pending_recovery: &[DeliveryRecoveryItem],
    still_failing: &[DeliveryRecoveryItem],
) -> Vec<DeliveryRecoveryItem> {
    let mut queue = Vec::with_capacity(pending_recovery.len() + still_failing.len());
    queue.extend_from_slice(still_failing);
    queue.extend_from_slice(pending_recovery);
    sort_items(&mut queue);
    queue
}

pub async fn build_delivery_recovery_view(
    pool: &sqlx::PgPool,
    req: DeliveryRecoveryViewRequest,
) -> anyhow::Result<CssCaseDeliveryRecoveryView> {
    let logs = crate::css_case_delivery_log::store_pg::list_all_delivery_logs(pool)
        .await
        .unwrap_or_default();

    let grouped = group_logs(logs);

    let mut pending_recovery = Vec::new();
    let mut recovered = Vec::new();
    let mut still_failing = Vec::new();

    for (_key, logs) in grouped {
        if let Some(item) = item_from_logs(&logs) {
            match item.state {
                DeliveryRecoveryState::PendingRecovery => pending_recovery.push(item),
                DeliveryRecoveryState::Recovered => recovered.push(item),
                DeliveryRecoveryState::RetryStillFailing => still_failing.push(item),
            }
        }
    }

    sort_items(&mut pending_recovery);
    sort_items(&mut recovered);
    sort_items(&mut still_failing);

    let mut priority_queue = build_priority_queue(&pending_recovery, &still_failing);

    let limit = req.limit.unwrap_or(50);
    pending_recovery.truncate(limit);
    recovered.truncate(limit);
    still_failing.truncate(limit);
    priority_queue.truncate(limit);

    let summary = DeliveryRecoverySummary {
        pending_recovery_count: pending_recovery.len(),
        recovered_count: recovered.len(),
        still_failing_count: still_failing.len(),
        high_priority_count: priority_queue
            .iter()
            .filter(|item| matches!(item.priority, DeliveryRecoveryPriority::High))
            .count(),
    };

    Ok(CssCaseDeliveryRecoveryView {
        pending_recovery,
        recovered,
        still_failing,
        priority_queue,
        summary,
    })
}
