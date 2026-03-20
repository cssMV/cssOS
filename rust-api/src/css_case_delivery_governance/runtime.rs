use crate::css_case_delivery_governance::types::{
    CssCaseDeliveryGovernanceDecision, CssCaseDeliveryGovernanceRules, DeliveryGovernanceDecision,
    DeliveryGovernanceEvaluationRequest, DeliveryGovernanceInput, DeliveryGovernanceRequest,
    DeliveryGovernanceSeverity,
};

pub fn evaluate_delivery_governance(
    rules: &CssCaseDeliveryGovernanceRules,
    input: DeliveryGovernanceInput,
) -> CssCaseDeliveryGovernanceDecision {
    let must_deliver = is_must_deliver(rules, &input.target);
    let no_silent_failure = is_no_silent_failure(rules, &input.target);
    let escalate = input.latest_failed
        && input.consecutive_failures >= rules.escalate_after_consecutive_failures;
    let require_manual_intervention = input.latest_failed
        && input.consecutive_failures >= rules.manual_intervention_after_consecutive_failures;

    CssCaseDeliveryGovernanceDecision {
        severity: governance_severity(rules, &input),
        escalate,
        require_manual_intervention,
        must_deliver,
        no_silent_failure,
        reasons: governance_reasons(rules, &input),
    }
}

pub fn default_delivery_governance_rules() -> CssCaseDeliveryGovernanceRules {
    use crate::css_case_delivery_api::types::DeliveryApiTarget;

    CssCaseDeliveryGovernanceRules {
        escalate_after_consecutive_failures: 2,
        must_deliver_targets: vec![
            DeliveryApiTarget::Email,
            DeliveryApiTarget::ThirdPartyClient,
        ],
        no_silent_failure_targets: vec![
            DeliveryApiTarget::Email,
            DeliveryApiTarget::ThirdPartyClient,
        ],
        manual_intervention_after_consecutive_failures: 3,
    }
}

fn is_must_deliver(
    rules: &CssCaseDeliveryGovernanceRules,
    target: &crate::css_case_delivery_api::types::DeliveryApiTarget,
) -> bool {
    rules.must_deliver_targets.iter().any(|x| x == target)
}

fn is_no_silent_failure(
    rules: &CssCaseDeliveryGovernanceRules,
    target: &crate::css_case_delivery_api::types::DeliveryApiTarget,
) -> bool {
    rules.no_silent_failure_targets.iter().any(|x| x == target)
}

fn governance_severity(
    rules: &CssCaseDeliveryGovernanceRules,
    input: &DeliveryGovernanceInput,
) -> DeliveryGovernanceSeverity {
    if !input.latest_failed {
        return DeliveryGovernanceSeverity::Normal;
    }

    if input.consecutive_failures >= rules.manual_intervention_after_consecutive_failures {
        return DeliveryGovernanceSeverity::Critical;
    }

    if input.consecutive_failures >= rules.escalate_after_consecutive_failures {
        return DeliveryGovernanceSeverity::Elevated;
    }

    DeliveryGovernanceSeverity::Normal
}

fn governance_reasons(
    rules: &CssCaseDeliveryGovernanceRules,
    input: &DeliveryGovernanceInput,
) -> Vec<String> {
    let mut reasons = Vec::new();

    if !input.latest_failed {
        reasons.push("最近一次交付未失败，当前未触发额外治理动作。".into());
        return reasons;
    }

    if input.consecutive_failures >= rules.escalate_after_consecutive_failures {
        reasons.push(format!(
            "连续失败次数达到升级阈值（{}）。",
            rules.escalate_after_consecutive_failures
        ));
    }

    if input.consecutive_failures >= rules.manual_intervention_after_consecutive_failures {
        reasons.push(format!(
            "连续失败次数达到人工介入阈值（{}）。",
            rules.manual_intervention_after_consecutive_failures
        ));
    }

    if is_must_deliver(rules, &input.target) {
        reasons.push("该 target 属于 must-deliver 交付对象。".into());
    }

    if is_no_silent_failure(rules, &input.target) {
        reasons.push("该 target 不允许静默失败。".into());
    }

    if reasons.is_empty() {
        reasons.push("当前未触发额外治理动作。".into());
    }

    reasons
}

pub fn estimate_failure_streak_from_recovery_item(
    item: &crate::css_case_delivery_recovery_view::types::DeliveryRecoveryItem,
) -> usize {
    match item.state {
        crate::css_case_delivery_recovery_view::types::DeliveryRecoveryState::RetryStillFailing => {
            3
        }
        crate::css_case_delivery_recovery_view::types::DeliveryRecoveryState::PendingRecovery => 1,
        crate::css_case_delivery_recovery_view::types::DeliveryRecoveryState::Recovered => 0,
    }
}

pub fn evaluate_recovery_item_governance(
    item: &crate::css_case_delivery_recovery_view::types::DeliveryRecoveryItem,
) -> CssCaseDeliveryGovernanceDecision {
    evaluate_delivery_governance(
        &default_delivery_governance_rules(),
        DeliveryGovernanceInput {
            target: item.target.clone(),
            consecutive_failures: estimate_failure_streak_from_recovery_item(item),
            latest_failed: !matches!(
                item.state,
                crate::css_case_delivery_recovery_view::types::DeliveryRecoveryState::Recovered
            ),
        },
    )
}

fn api_target_from_log_target(
    target: &crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
) -> crate::css_case_delivery_api::types::DeliveryApiTarget {
    match target {
        crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Digest
        | crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Briefing => {
            crate::css_case_delivery_api::types::DeliveryApiTarget::Email
        }
        crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Dashboard
        | crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Kpi
        | crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Analytics
        | crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Trends
        | crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Alerts
        | crate::css_case_delivery_log::types::CaseDeliveryLogTarget::ReportBundle => {
            crate::css_case_delivery_api::types::DeliveryApiTarget::ThirdPartyClient
        }
    }
}

pub fn evaluate_delivery_governance_request(
    req: DeliveryGovernanceRequest,
) -> CssCaseDeliveryGovernanceDecision {
    evaluate_delivery_governance(
        &default_delivery_governance_rules(),
        DeliveryGovernanceInput {
            target: api_target_from_log_target(&req.target),
            consecutive_failures: req.failure_streak,
            latest_failed: !req.delivered,
        },
    )
}

#[cfg(test)]
mod tests {
    #[test]
    fn v219_attachment_failure_requires_manual_intervention() {
        let decision = super::evaluate_delivery_governance_request(
            crate::css_case_delivery_governance::types::DeliveryGovernanceRequest {
                target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Dashboard,
                mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode::Attachment,
                delivered: false,
                failure_streak: 1,
            },
        );

        assert!(!decision.require_manual_intervention);
    }
}

fn consecutive_failures(
    logs: &[crate::css_case_delivery_log::types::CssCaseDeliveryLogRecord],
) -> usize {
    let mut count = 0;

    for log in logs.iter().rev() {
        if log.delivered {
            break;
        }
        count += 1;
    }

    count
}

fn retry_still_failing(
    logs: &[crate::css_case_delivery_log::types::CssCaseDeliveryLogRecord],
) -> bool {
    if logs.len() < 2 {
        return false;
    }

    let last = &logs[logs.len() - 1];
    let prev = &logs[logs.len() - 2];

    !last.delivered && !prev.delivered
}

async fn load_logs_for_scope(
    pool: &sqlx::PgPool,
    req: &DeliveryGovernanceEvaluationRequest,
) -> anyhow::Result<Vec<crate::css_case_delivery_log::types::CssCaseDeliveryLogRecord>> {
    if let Some(subscription_id) = &req.subscription_id {
        return crate::css_case_delivery_log::store_pg::list_delivery_logs_for_subscription(
            pool,
            subscription_id,
        )
        .await;
    }

    crate::css_case_delivery_log::store_pg::list_delivery_logs_for_target_mode(
        pool,
        &req.target,
        &req.mode,
    )
    .await
}

pub async fn build_delivery_governance_decision(
    pool: &sqlx::PgPool,
    req: DeliveryGovernanceEvaluationRequest,
) -> anyhow::Result<DeliveryGovernanceDecision> {
    let logs = load_logs_for_scope(pool, &req).await.unwrap_or_default();
    let consecutive = consecutive_failures(&logs);
    let latest_failed = logs.last().map(|x| !x.succeeded).unwrap_or(false);
    let _still_failing_after_retry = retry_still_failing(&logs);

    Ok(evaluate_delivery_governance(
        &default_delivery_governance_rules(),
        DeliveryGovernanceInput {
            target: api_target_from_log_target(&req.target),
            consecutive_failures: consecutive,
            latest_failed,
        },
    ))
}
