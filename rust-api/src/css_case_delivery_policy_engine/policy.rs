use crate::css_case_delivery_policy_engine::types::{
    DeliveryPolicyEvaluation, DeliveryPolicyEvaluationRequest, DeliveryPolicyRecord,
};

pub fn default_policy() -> DeliveryPolicyRecord {
    crate::css_case_delivery_policy_engine::runtime::legacy_record_from_record(
        crate::css_case_delivery_policy_engine::types::CssCaseDeliveryPolicyRecord {
            policy_id: "delivery_policy_default".into(),
            policy_name: "default_delivery_policy".into(),
            config: crate::css_case_delivery_policy_engine::runtime::default_delivery_policy_config(
            ),
            is_active: true,
            created_at: crate::timeutil::now_rfc3339(),
        },
    )
}

pub fn is_must_deliver(
    policy: &DeliveryPolicyRecord,
    target: &crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
) -> bool {
    policy.rules.must_deliver_targets.contains(target)
}

pub fn is_silent_failure_allowed(
    policy: &DeliveryPolicyRecord,
    target: &crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
) -> bool {
    !policy.rules.must_deliver_targets.contains(target)
        && !matches!(
            target,
            crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Digest
                | crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Briefing
                | crate::css_case_delivery_log::types::CaseDeliveryLogTarget::ReportBundle
        )
}

pub fn evaluate_policy(
    policy: &DeliveryPolicyRecord,
    req: &DeliveryPolicyEvaluationRequest,
) -> DeliveryPolicyEvaluation {
    let target = crate::css_case_delivery_policy_engine::runtime::legacy_record_from_record(
        crate::css_case_delivery_policy_engine::types::CssCaseDeliveryPolicyRecord {
            policy_id: policy.policy_id.clone(),
            policy_name: policy.name.clone(),
            config: crate::css_case_delivery_policy_engine::types::CssCaseDeliveryPolicyConfig {
                escalate_after_consecutive_failures: policy.rules.escalation_failure_threshold,
                manual_intervention_after_consecutive_failures: policy
                    .rules
                    .manual_intervention_failure_threshold,
                must_deliver_targets: policy
                    .rules
                    .must_deliver_targets
                    .iter()
                    .map(|target| match target {
                        crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Digest
                        | crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Briefing => {
                            crate::css_case_delivery_api::types::DeliveryApiTarget::Email
                        }
                        crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Alerts => {
                            crate::css_case_delivery_api::types::DeliveryApiTarget::Bot
                        }
                        crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Dashboard => {
                            crate::css_case_delivery_api::types::DeliveryApiTarget::FrontendDownload
                        }
                        _ => {
                            crate::css_case_delivery_api::types::DeliveryApiTarget::ThirdPartyClient
                        }
                    })
                    .collect(),
                no_silent_failure_targets: vec![],
            },
            is_active: policy.active,
            created_at: crate::timeutil::now_rfc3339(),
        },
    );
    let _ = target;

    let must_deliver = matches!(
        req.target,
        crate::css_case_delivery_api::types::DeliveryApiTarget::Email
            | crate::css_case_delivery_api::types::DeliveryApiTarget::ThirdPartyClient
    );
    let silent_failure_allowed = !must_deliver;
    let should_escalate = req.consecutive_failures >= policy.rules.escalation_failure_threshold;
    let require_manual_intervention =
        req.consecutive_failures >= policy.rules.manual_intervention_failure_threshold;

    let mut reasons = Vec::new();
    if must_deliver {
        reasons.push("target is must-deliver under active policy".into());
    }
    if silent_failure_allowed {
        reasons.push("silent failure is allowed under active policy".into());
    } else {
        reasons.push("silent failure is not allowed under active policy".into());
    }
    if should_escalate {
        reasons.push(format!(
            "consecutive failures reached escalation threshold ({})",
            policy.rules.escalation_failure_threshold
        ));
    }
    if require_manual_intervention {
        reasons.push("manual intervention rule matched".into());
    }

    DeliveryPolicyEvaluation {
        must_deliver,
        silent_failure_allowed,
        require_manual_intervention,
        should_escalate,
        reasons,
    }
}
