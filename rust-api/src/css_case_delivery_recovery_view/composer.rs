use crate::css_case_delivery_log::types::CssCaseDeliveryLogRecord;
use crate::css_case_delivery_recovery_view::types::{
    DeliveryRecoveryItem, DeliveryRecoveryPriority, DeliveryRecoveryState,
};

pub fn recovery_group_key(log: &CssCaseDeliveryLogRecord) -> String {
    format!(
        "{}::{:?}::{:?}::{:?}::{:?}",
        log.subscription_id.clone().unwrap_or_default(),
        log.delivery_mode,
        log.delivery_target,
        log.report_type,
        log.export_format
    )
}

pub fn priority_for_item(item: &DeliveryRecoveryItem) -> DeliveryRecoveryPriority {
    use crate::css_case_delivery_api::types::DeliveryApiTarget;

    match item.state {
        DeliveryRecoveryState::RetryStillFailing => DeliveryRecoveryPriority::High,
        DeliveryRecoveryState::PendingRecovery => match item.target {
            DeliveryApiTarget::Email | DeliveryApiTarget::ThirdPartyClient => {
                DeliveryRecoveryPriority::High
            }
            _ => DeliveryRecoveryPriority::Medium,
        },
        DeliveryRecoveryState::Recovered => DeliveryRecoveryPriority::Low,
    }
}

pub fn build_recovery_item(logs: &[CssCaseDeliveryLogRecord]) -> Option<DeliveryRecoveryItem> {
    let first = logs.first()?;
    let state = if !logs.iter().any(|x| !x.succeeded) {
        return None;
    } else if logs.last()?.succeeded {
        DeliveryRecoveryState::Recovered
    } else if logs.iter().rev().take(2).all(|x| !x.succeeded) {
        DeliveryRecoveryState::RetryStillFailing
    } else {
        DeliveryRecoveryState::PendingRecovery
    };

    let mut item = DeliveryRecoveryItem {
        subscription_id: first.subscription_id.clone(),
        mode: first.delivery_mode.clone(),
        target: first.delivery_target.clone(),
        report_type: first.report_type.clone(),
        export_format: first.export_format.clone(),
        state,
        priority: DeliveryRecoveryPriority::Low,
        latest_failed_delivery_log_id: logs
            .iter()
            .rev()
            .find(|x| !x.succeeded)
            .map(|x| x.delivery_log_id.clone()),
        latest_success_delivery_log_id: logs
            .iter()
            .rev()
            .find(|x| x.succeeded)
            .map(|x| x.delivery_log_id.clone()),
        summary: String::new(),
    };

    item.priority = priority_for_item(&item);
    item.summary = match item.state {
        DeliveryRecoveryState::PendingRecovery => "最近一次交付失败，当前仍待恢复。".into(),
        DeliveryRecoveryState::Recovered => "该交付对象曾失败，但后续已恢复成功。".into(),
        DeliveryRecoveryState::RetryStillFailing => {
            "该交付对象在重试后仍然失败，需要优先处理。".into()
        }
    };
    Some(item)
}

pub fn sort_prioritized(mut items: Vec<DeliveryRecoveryItem>) -> Vec<DeliveryRecoveryItem> {
    items.sort_by(|a, b| {
        let a_rank = match a.priority {
            DeliveryRecoveryPriority::High => 0,
            DeliveryRecoveryPriority::Medium => 1,
            DeliveryRecoveryPriority::Low => 2,
        };
        let b_rank = match b.priority {
            DeliveryRecoveryPriority::High => 0,
            DeliveryRecoveryPriority::Medium => 1,
            DeliveryRecoveryPriority::Low => 2,
        };

        a_rank.cmp(&b_rank)
    });
    items
}
