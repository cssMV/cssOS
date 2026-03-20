use crate::css_case_delivery_decision_trace::types::{
    CssCaseDeliveryDecisionTrace, DeliveryDecisionDerived, DeliveryDecisionTraceConclusion,
    DeliveryDecisionTraceHit, DeliveryDecisionTraceInput, DeliveryDecisionTraceRequest,
};
use crate::css_case_delivery_governance::types::{
    CssCaseDeliveryGovernanceDecision, DeliveryGovernanceAction, DeliveryGovernanceDecisionKind,
    DeliveryGovernanceSeverity,
};

fn trace_hit(key: &str, label: &str, matched: bool, detail: String) -> DeliveryDecisionTraceHit {
    DeliveryDecisionTraceHit {
        key: key.to_string(),
        label: label.to_string(),
        matched,
        detail: detail.clone(),
        rule_key: key.to_string(),
        explanation: detail,
    }
}

pub fn api_target_from_log_target(
    target: &crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
) -> crate::css_case_delivery_api::types::DeliveryApiTarget {
    match target {
        crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Digest
        | crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Briefing => {
            crate::css_case_delivery_api::types::DeliveryApiTarget::Email
        }
        crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Dashboard => {
            crate::css_case_delivery_api::types::DeliveryApiTarget::FrontendDownload
        }
        crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Alerts => {
            crate::css_case_delivery_api::types::DeliveryApiTarget::Bot
        }
        crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Kpi
        | crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Analytics
        | crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Trends
        | crate::css_case_delivery_log::types::CaseDeliveryLogTarget::ReportBundle => {
            crate::css_case_delivery_api::types::DeliveryApiTarget::ThirdPartyClient
        }
    }
}

fn legacy_evaluation_from_decision(
    decision: &CssCaseDeliveryGovernanceDecision,
) -> crate::css_case_delivery_policy_engine::types::DeliveryPolicyEvaluation {
    crate::css_case_delivery_policy_engine::types::DeliveryPolicyEvaluation {
        must_deliver: decision.must_deliver,
        silent_failure_allowed: !decision.no_silent_failure,
        require_manual_intervention: decision.require_manual_intervention,
        should_escalate: decision.escalate,
        reasons: decision.reasons.clone(),
    }
}

fn conclusion_from_decision(
    decision: &CssCaseDeliveryGovernanceDecision,
    latest_failed: bool,
) -> DeliveryDecisionTraceConclusion {
    if !latest_failed {
        return DeliveryDecisionTraceConclusion {
            decision: DeliveryGovernanceDecisionKind::Healthy,
            severity: DeliveryGovernanceSeverity::Normal,
            action: DeliveryGovernanceAction::None,
            message: "delivery is currently not in a failed state".into(),
        };
    }

    if decision.require_manual_intervention {
        return DeliveryDecisionTraceConclusion {
            decision: DeliveryGovernanceDecisionKind::ManualInterventionRequired,
            severity: DeliveryGovernanceSeverity::Critical,
            action: DeliveryGovernanceAction::RequireManualIntervention,
            message: "manual intervention is required under the active policy version".into(),
        };
    }

    if decision.must_deliver && decision.no_silent_failure {
        return DeliveryDecisionTraceConclusion {
            decision: DeliveryGovernanceDecisionKind::MustDeliverTargetViolated,
            severity: decision.severity.clone(),
            action: if decision.escalate {
                DeliveryGovernanceAction::EscalateOps
            } else {
                DeliveryGovernanceAction::RaiseAlert
            },
            message: "must-deliver target failed and cannot be treated as silent failure".into(),
        };
    }

    if decision.escalate {
        return DeliveryDecisionTraceConclusion {
            decision: DeliveryGovernanceDecisionKind::ConsecutiveFailureEscalated,
            severity: decision.severity.clone(),
            action: DeliveryGovernanceAction::EscalateOps,
            message: "failure streak reached the escalation threshold".into(),
        };
    }

    if decision.no_silent_failure {
        return DeliveryDecisionTraceConclusion {
            decision: DeliveryGovernanceDecisionKind::SilentFailureNotAllowed,
            severity: DeliveryGovernanceSeverity::Elevated,
            action: DeliveryGovernanceAction::RaiseAlert,
            message: "silent failure is not allowed for this delivery target".into(),
        };
    }

    DeliveryDecisionTraceConclusion {
        decision: DeliveryGovernanceDecisionKind::Healthy,
        severity: decision.severity.clone(),
        action: DeliveryGovernanceAction::None,
        message: "no additional governance action is required".into(),
    }
}

fn hit_escalate_threshold(
    config: &crate::css_case_delivery_policy_engine::types::CssCaseDeliveryPolicyConfig,
    input: &DeliveryDecisionTraceInput,
) -> DeliveryDecisionTraceHit {
    let matched = input.consecutive_failures >= config.escalate_after_consecutive_failures;

    trace_hit(
        "escalate_after_consecutive_failures",
        "升级阈值",
        matched,
        format!(
            "当前连续失败 {}，升级阈值 {}。",
            input.consecutive_failures, config.escalate_after_consecutive_failures
        ),
    )
}

fn hit_manual_intervention_threshold(
    config: &crate::css_case_delivery_policy_engine::types::CssCaseDeliveryPolicyConfig,
    input: &DeliveryDecisionTraceInput,
) -> DeliveryDecisionTraceHit {
    let matched =
        input.consecutive_failures >= config.manual_intervention_after_consecutive_failures;

    trace_hit(
        "manual_intervention_after_consecutive_failures",
        "人工介入阈值",
        matched,
        format!(
            "当前连续失败 {}，人工介入阈值 {}。",
            input.consecutive_failures, config.manual_intervention_after_consecutive_failures
        ),
    )
}

fn hit_must_deliver(
    config: &crate::css_case_delivery_policy_engine::types::CssCaseDeliveryPolicyConfig,
    input: &DeliveryDecisionTraceInput,
) -> DeliveryDecisionTraceHit {
    let matched = config
        .must_deliver_targets
        .iter()
        .any(|x| x == &input.target);

    trace_hit(
        "must_deliver_targets",
        "必须送达目标",
        matched,
        format!("当前 target={:?}。", input.target),
    )
}

fn hit_no_silent_failure(
    config: &crate::css_case_delivery_policy_engine::types::CssCaseDeliveryPolicyConfig,
    input: &DeliveryDecisionTraceInput,
) -> DeliveryDecisionTraceHit {
    let matched = config
        .no_silent_failure_targets
        .iter()
        .any(|x| x == &input.target);

    trace_hit(
        "no_silent_failure_targets",
        "不允许静默失败目标",
        matched,
        format!("当前 target={:?}。", input.target),
    )
}

fn hit_latest_failed(input: &DeliveryDecisionTraceInput) -> DeliveryDecisionTraceHit {
    trace_hit(
        "latest_failed",
        "当前处于失败后判定",
        input.latest_failed,
        format!("latest_failed={}", input.latest_failed),
    )
}

fn hit_governance_severity(
    decision: &CssCaseDeliveryGovernanceDecision,
) -> DeliveryDecisionTraceHit {
    trace_hit(
        "governance_severity",
        "治理严重度",
        true,
        format!("severity={:?}", decision.severity),
    )
}

pub async fn build_delivery_decision_trace(
    pool: &sqlx::PgPool,
    req: DeliveryDecisionTraceRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryDecisionTrace> {
    let active =
        crate::css_case_delivery_policy_versioning::runtime::get_or_create_active_delivery_policy_version(
            pool,
            now_rfc3339,
        )
        .await?;

    let input = DeliveryDecisionTraceInput {
        target: req.target,
        consecutive_failures: req.consecutive_failures,
        latest_failed: req.latest_failed,
        source_target: req.source_target,
        source_mode: req.source_mode,
        retry_still_failing: req.retry_still_failing,
        delivered: req.delivered,
        failure_streak: req.failure_streak.or(Some(req.consecutive_failures)),
    };

    let decision_eval =
        crate::css_case_delivery_policy_versioning::runtime::evaluate_delivery_policy_versioned(
            pool,
            crate::css_case_delivery_policy_engine::types::DeliveryPolicyEvaluationRequest {
                target: input.target.clone(),
                consecutive_failures: input.consecutive_failures,
                latest_failed: input.latest_failed,
            },
            now_rfc3339,
        )
        .await?;

    let mut hits = vec![
        hit_escalate_threshold(&active.config, &input),
        hit_manual_intervention_threshold(&active.config, &input),
        hit_must_deliver(&active.config, &input),
        hit_no_silent_failure(&active.config, &input),
        hit_latest_failed(&input),
    ];
    hits.push(hit_governance_severity(&decision_eval.decision));

    let derived = DeliveryDecisionDerived {
        escalate: decision_eval.decision.escalate,
        require_manual_intervention: decision_eval.decision.require_manual_intervention,
        must_deliver: decision_eval.decision.must_deliver,
        no_silent_failure: decision_eval.decision.no_silent_failure,
    };

    let evaluation = legacy_evaluation_from_decision(&decision_eval.decision);
    let conclusion = conclusion_from_decision(&decision_eval.decision, input.latest_failed);

    Ok(CssCaseDeliveryDecisionTrace {
        policy_version_id: active.policy_version_id.clone(),
        policy_version_name: format!("{}@v{}", active.policy_name, active.version),
        policy_version_label: format!("{}@v{}", active.policy_name, active.version),
        input,
        hits: hits.clone(),
        rule_hits: hits,
        derived,
        decision: decision_eval.decision,
        policy_version: Some(format!("v{}", active.version)),
        policy_id: active.policy_version_id.clone(),
        version: active.version as i32,
        evaluation,
        conclusion,
    })
}

#[cfg(test)]
mod tests {
    #[test]
    fn v316_trace_hit_sets_legacy_and_new_fields() {
        let hit = super::trace_hit("must_deliver_targets", "必须送达目标", true, "ok".into());
        assert_eq!(hit.key, "must_deliver_targets");
        assert_eq!(hit.rule_key, "must_deliver_targets");
        assert!(hit.matched);
    }
}
