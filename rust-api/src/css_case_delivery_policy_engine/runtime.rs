use crate::css_case_delivery_governance::types::{
    CssCaseDeliveryGovernanceDecision, CssCaseDeliveryGovernanceRules, DeliveryGovernanceAction,
    DeliveryGovernanceDecisionKind,
};
use crate::css_case_delivery_policy_engine::types::{
    CreateDeliveryPolicyRequest, CssCaseDeliveryPolicy, CssCaseDeliveryPolicyConfig,
    CssCaseDeliveryPolicyEvaluation, CssCaseDeliveryPolicyRecord, DeliveryFailureThresholdRule,
    DeliveryModePolicyRule, DeliveryPolicyAction, DeliveryPolicyEvaluation,
    DeliveryPolicyEvaluationRequest, DeliveryPolicyEvaluationResult, DeliveryPolicyGuaranteeClass,
    DeliveryPolicyRecord, DeliveryPolicyRuleSet, DeliveryTargetPolicyRule,
};

pub fn default_delivery_policy_config() -> CssCaseDeliveryPolicyConfig {
    use crate::css_case_delivery_api::types::DeliveryApiTarget;

    CssCaseDeliveryPolicyConfig {
        escalate_after_consecutive_failures: 2,
        manual_intervention_after_consecutive_failures: 3,
        must_deliver_targets: vec![
            DeliveryApiTarget::Email,
            DeliveryApiTarget::ThirdPartyClient,
        ],
        no_silent_failure_targets: vec![
            DeliveryApiTarget::Email,
            DeliveryApiTarget::ThirdPartyClient,
        ],
    }
}

pub fn governance_rules_from_policy_config(
    config: &CssCaseDeliveryPolicyConfig,
) -> CssCaseDeliveryGovernanceRules {
    CssCaseDeliveryGovernanceRules {
        escalate_after_consecutive_failures: config.escalate_after_consecutive_failures,
        must_deliver_targets: config.must_deliver_targets.clone(),
        no_silent_failure_targets: config.no_silent_failure_targets.clone(),
        manual_intervention_after_consecutive_failures: config
            .manual_intervention_after_consecutive_failures,
    }
}

pub fn build_delivery_policy_record(
    req: CreateDeliveryPolicyRequest,
    now_rfc3339: &str,
) -> CssCaseDeliveryPolicyRecord {
    CssCaseDeliveryPolicyRecord {
        policy_id: format!("cdpol_{}", uuid::Uuid::new_v4()),
        policy_name: req.policy_name,
        config: req.config,
        is_active: false,
        created_at: now_rfc3339.to_string(),
    }
}

pub async fn create_delivery_policy(
    pool: &sqlx::PgPool,
    req: CreateDeliveryPolicyRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryPolicyRecord> {
    let record = build_delivery_policy_record(req, now_rfc3339);
    crate::css_case_delivery_policy_engine::store_pg::insert_delivery_policy(pool, &record).await?;
    Ok(record)
}

pub async fn get_or_create_active_delivery_policy(
    pool: &sqlx::PgPool,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryPolicyRecord> {
    let active = crate::css_case_delivery_policy_versioning::runtime::get_or_create_active_delivery_policy_version(
        pool,
        now_rfc3339,
    )
    .await?;

    Ok(CssCaseDeliveryPolicyRecord {
        policy_id: active.policy_version_id,
        policy_name: active.policy_name,
        config: active.config,
        is_active: active.is_active,
        created_at: active.created_at,
    })
}

pub async fn evaluate_delivery_policy(
    pool: &sqlx::PgPool,
    req: DeliveryPolicyEvaluationRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryPolicyEvaluation> {
    crate::css_case_delivery_policy_versioning::runtime::evaluate_delivery_policy_versioned(
        pool,
        req,
        now_rfc3339,
    )
    .await
}

// Legacy-kept compatibility helpers below.

fn log_target_from_api_target(
    target: &crate::css_case_delivery_api::types::DeliveryApiTarget,
) -> crate::css_case_delivery_log::types::CaseDeliveryLogTarget {
    match target {
        crate::css_case_delivery_api::types::DeliveryApiTarget::FrontendDownload => {
            crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Dashboard
        }
        crate::css_case_delivery_api::types::DeliveryApiTarget::Bot => {
            crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Alerts
        }
        crate::css_case_delivery_api::types::DeliveryApiTarget::Email => {
            crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Digest
        }
        crate::css_case_delivery_api::types::DeliveryApiTarget::ThirdPartyClient => {
            crate::css_case_delivery_log::types::CaseDeliveryLogTarget::ReportBundle
        }
    }
}

fn api_target_from_log_target(
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

pub fn policy_record_from_legacy(policy: &CssCaseDeliveryPolicy) -> CssCaseDeliveryPolicyRecord {
    let must_deliver_targets = policy
        .target_rules
        .iter()
        .filter(|rule| {
            matches!(
                rule.guarantee_class,
                DeliveryPolicyGuaranteeClass::MustDeliver
            )
        })
        .map(|rule| api_target_from_log_target(&rule.target))
        .collect::<Vec<_>>();

    let no_silent_failure_targets = policy
        .target_rules
        .iter()
        .filter(|rule| rule.silent_failure_not_allowed)
        .map(|rule| api_target_from_log_target(&rule.target))
        .collect::<Vec<_>>();

    CssCaseDeliveryPolicyRecord {
        policy_id: policy.policy_id.clone(),
        policy_name: policy
            .name
            .clone()
            .unwrap_or_else(|| "default_delivery_policy".into()),
        config: CssCaseDeliveryPolicyConfig {
            escalate_after_consecutive_failures: policy.failure_threshold_rule.critical_streak,
            manual_intervention_after_consecutive_failures: policy
                .failure_threshold_rule
                .warning_streak,
            must_deliver_targets,
            no_silent_failure_targets,
        },
        is_active: policy.is_active,
        created_at: policy.created_at.clone(),
    }
}

pub fn legacy_policy_from_record(record: CssCaseDeliveryPolicyRecord) -> CssCaseDeliveryPolicy {
    let mut target_rules = Vec::new();

    for target in &record.config.must_deliver_targets {
        let log_target = log_target_from_api_target(target);
        target_rules.push(DeliveryTargetPolicyRule {
            target: log_target.clone(),
            guarantee_class: DeliveryPolicyGuaranteeClass::MustDeliver,
            silent_failure_not_allowed: record.config.no_silent_failure_targets.contains(target),
        });
    }

    for target in &record.config.no_silent_failure_targets {
        let log_target = log_target_from_api_target(target);
        if target_rules.iter().any(|rule| rule.target == log_target) {
            continue;
        }

        target_rules.push(DeliveryTargetPolicyRule {
            target: log_target,
            guarantee_class: DeliveryPolicyGuaranteeClass::BestEffort,
            silent_failure_not_allowed: true,
        });
    }

    CssCaseDeliveryPolicy {
        policy_id: record.policy_id,
        version: 1,
        version_label: Some("v1".into()),
        name: Some(record.policy_name),
        is_active: record.is_active,
        failure_threshold_rule: DeliveryFailureThresholdRule {
            warning_streak: record.config.manual_intervention_after_consecutive_failures,
            critical_streak: record.config.escalate_after_consecutive_failures,
            warning_action: DeliveryPolicyAction::RaiseAlert,
            critical_action: DeliveryPolicyAction::EscalateOps,
        },
        target_rules,
        mode_rules: vec![
            DeliveryModePolicyRule {
                mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode::Attachment,
                manual_intervention_required_on_failure: true,
            },
            DeliveryModePolicyRule {
                mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode::ApiBundle,
                manual_intervention_required_on_failure: true,
            },
        ],
        created_at: record.created_at,
    }
}

pub fn default_delivery_policy(now_rfc3339: &str) -> CssCaseDeliveryPolicy {
    legacy_policy_from_record(CssCaseDeliveryPolicyRecord {
        policy_id: "delivery_policy_default".into(),
        policy_name: "default_delivery_policy".into(),
        config: default_delivery_policy_config(),
        is_active: true,
        created_at: now_rfc3339.to_string(),
    })
}

pub async fn load_active_policy(
    pool: &sqlx::PgPool,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryPolicy> {
    Ok(legacy_policy_from_record(
        get_or_create_active_delivery_policy(pool, now_rfc3339).await?,
    ))
}

pub async fn load_active_delivery_policy(
    pool: &sqlx::PgPool,
    now_rfc3339: &str,
) -> anyhow::Result<DeliveryPolicyRecord> {
    Ok(legacy_record_from_record(
        get_or_create_active_delivery_policy(pool, now_rfc3339).await?,
    ))
}

pub fn legacy_record_from_record(record: CssCaseDeliveryPolicyRecord) -> DeliveryPolicyRecord {
    DeliveryPolicyRecord {
        policy_id: record.policy_id,
        name: record.policy_name,
        active: record.is_active,
        rules: DeliveryPolicyRuleSet {
            escalation_failure_threshold: record.config.escalate_after_consecutive_failures,
            manual_intervention_failure_threshold: record
                .config
                .manual_intervention_after_consecutive_failures,
            must_deliver_targets: record
                .config
                .must_deliver_targets
                .iter()
                .map(log_target_from_api_target)
                .collect(),
            silent_failure_allowed_targets: vec![],
        },
    }
}

pub async fn evaluate_delivery_policy_rules(
    pool: &sqlx::PgPool,
    req: DeliveryPolicyEvaluationRequest,
    now_rfc3339: &str,
) -> anyhow::Result<DeliveryPolicyEvaluation> {
    let evaluation = evaluate_delivery_policy(pool, req, now_rfc3339).await?;
    let decision = evaluation.decision;

    Ok(DeliveryPolicyEvaluation {
        must_deliver: decision.must_deliver,
        silent_failure_allowed: !decision.no_silent_failure,
        require_manual_intervention: decision.require_manual_intervention,
        should_escalate: decision.escalate,
        reasons: decision.reasons,
    })
}

pub async fn evaluate_delivery_policy_legacy(
    pool: &sqlx::PgPool,
    req: DeliveryPolicyEvaluationRequest,
    now_rfc3339: &str,
) -> anyhow::Result<DeliveryPolicyEvaluationResult> {
    let evaluation = evaluate_delivery_policy(pool, req, now_rfc3339).await?;
    let legacy = load_active_policy(pool, now_rfc3339).await?;
    let decision = evaluation.decision;

    Ok(DeliveryPolicyEvaluationResult {
        policy_id: evaluation.policy_id,
        version: legacy.version,
        decision: decision_kind_from_governance(&decision),
        severity: decision.severity.clone(),
        action: action_from_governance(&decision),
        message: message_from_governance(&decision),
    })
}

fn decision_kind_from_governance(
    decision: &CssCaseDeliveryGovernanceDecision,
) -> DeliveryGovernanceDecisionKind {
    if decision.require_manual_intervention {
        DeliveryGovernanceDecisionKind::ManualInterventionRequired
    } else if decision.must_deliver {
        DeliveryGovernanceDecisionKind::MustDeliverTargetViolated
    } else if decision.escalate {
        DeliveryGovernanceDecisionKind::ConsecutiveFailureEscalated
    } else if decision.no_silent_failure {
        DeliveryGovernanceDecisionKind::SilentFailureNotAllowed
    } else {
        DeliveryGovernanceDecisionKind::Healthy
    }
}

fn action_from_governance(
    decision: &CssCaseDeliveryGovernanceDecision,
) -> DeliveryGovernanceAction {
    if decision.require_manual_intervention {
        DeliveryGovernanceAction::RequireManualIntervention
    } else if decision.escalate {
        DeliveryGovernanceAction::EscalateOps
    } else if decision.no_silent_failure {
        DeliveryGovernanceAction::RaiseAlert
    } else {
        DeliveryGovernanceAction::None
    }
}

fn message_from_governance(decision: &CssCaseDeliveryGovernanceDecision) -> String {
    if decision.require_manual_intervention {
        "manual intervention is required under active delivery policy".into()
    } else if decision.must_deliver {
        "must-deliver target failure matched active delivery policy".into()
    } else if decision.escalate {
        "failure streak reached active delivery policy escalation threshold".into()
    } else if decision.no_silent_failure {
        "silent failure is not allowed under active delivery policy".into()
    } else {
        "no policy escalation required".into()
    }
}
