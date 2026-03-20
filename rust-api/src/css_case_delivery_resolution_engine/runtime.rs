use crate::css_case_delivery_action_log::types::DeliveryActionLogRecord;
use crate::css_case_delivery_actions_engine::types::DeliveryActionKind;
use crate::css_case_delivery_resolution_engine::types::{
    CssCaseDeliveryResolution, DeliveryResolutionRequest, DeliveryResolutionState,
};

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

async fn load_recent_action_logs(
    pool: &sqlx::PgPool,
    subject_key: &str,
) -> anyhow::Result<Vec<DeliveryActionLogRecord>> {
    Ok(
        crate::css_case_delivery_action_log::store_pg::list_delivery_action_logs_for_subject(
            pool,
            subject_key,
        )
        .await
        .unwrap_or_default(),
    )
}

fn has_recent_escalate_action(logs: &[DeliveryActionLogRecord]) -> bool {
    logs.iter()
        .rev()
        .any(|log| log.success && matches!(log.action, DeliveryActionKind::EscalateOps))
}

fn has_recent_manual_intervention_action(logs: &[DeliveryActionLogRecord]) -> bool {
    logs.iter().rev().any(|log| {
        log.success && matches!(log.action, DeliveryActionKind::RequireManualIntervention)
    })
}

pub async fn resolve_delivery_state(
    pool: &sqlx::PgPool,
    req: DeliveryResolutionRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryResolution> {
    let trust =
        crate::css_case_delivery_trust_view::runtime::build_delivery_trust_view_from_legacy(
            pool,
            crate::css_case_delivery_trust_view::types::DeliveryTrustRequest {
                target: req.target.clone(),
                mode: req.mode.clone(),
                delivered: req.delivered,
                failure_streak: req.failure_streak,
                consecutive_failures: None,
                retry_still_failing: false,
            },
            now_rfc3339,
        )
        .await?;

    let risk = crate::css_case_delivery_risk_view::runtime::build_delivery_risk_view_from_legacy(
        pool,
        crate::css_case_delivery_risk_view::types::DeliveryRiskRequest {
            target: req.target.clone(),
            mode: req.mode.clone(),
            delivered: req.delivered,
            failure_streak: req.failure_streak,
            consecutive_failures: None,
            retry_still_failing: false,
        },
        now_rfc3339,
    )
    .await?;

    let assurance =
        crate::css_case_delivery_assurance_view::runtime::build_delivery_assurance_view_from_legacy(
            pool,
            crate::css_case_delivery_assurance_view::types::DeliveryAssuranceRequest {
                target: req.target.clone(),
                mode: req.mode.clone(),
                delivered: req.delivered,
                failure_streak: req.failure_streak,
                consecutive_failures: None,
                retry_still_failing: false,
            },
            now_rfc3339,
        )
        .await?;

    let _timeline =
        crate::css_case_delivery_timeline_merge::runtime::build_delivery_timeline_merge_from_legacy(
            pool,
            crate::css_case_delivery_timeline_merge::types::DeliveryTimelineMergeRequest {
                target: req.target.clone(),
                mode: req.mode.clone(),
            },
        )
        .await?;

    let _timeline_explain =
        crate::css_case_delivery_timeline_explain::runtime::build_delivery_timeline_explain_from_legacy(
            pool,
            crate::css_case_delivery_timeline_explain::types::DeliveryTimelineExplainRequest {
                target: req.target.clone(),
                mode: req.mode.clone(),
            },
        )
        .await?;

    let subject_key =
        crate::css_case_delivery_actions_engine::policy::subject_key(&req.target, &req.mode);
    let logs = load_recent_action_logs(pool, &subject_key).await?;

    let mut reasons = Vec::new();

    let state = if trust.requires_manual_intervention
        || assurance.requires_manual_intervention
        || has_recent_manual_intervention_action(&logs)
    {
        reasons.push("manual intervention is active".into());
        DeliveryResolutionState::UnderManualIntervention
    } else if has_recent_escalate_action(&logs)
        || matches!(
            trust.governance_grade,
            crate::css_case_delivery_trust_view::types::DeliveryGovernanceGrade::Critical
        )
        || matches!(
            risk.risk_level,
            crate::css_case_delivery_risk_view::types::DeliveryRiskLevel::Critical
        )
    {
        reasons.push("object has been escalated to ops or is in critical governance state".into());
        DeliveryResolutionState::Escalated
    } else if assurance.is_under_watch || assurance.is_in_mandatory_recovery_queue {
        reasons.push("object remains under watch or recovery queue".into());
        DeliveryResolutionState::MonitoringOnly
    } else if matches!(
        trust.trust_level,
        crate::css_case_delivery_trust_view::types::DeliveryTrustLevel::Guarded
    ) || matches!(
        risk.risk_level,
        crate::css_case_delivery_risk_view::types::DeliveryRiskLevel::Medium
            | crate::css_case_delivery_risk_view::types::DeliveryRiskLevel::High
    ) {
        reasons.push("object is no longer critical but still stabilized under observation".into());
        DeliveryResolutionState::Stabilized
    } else {
        reasons.push("object is healthy with no active intervention path".into());
        DeliveryResolutionState::Resolved
    };

    Ok(CssCaseDeliveryResolution {
        resolution_state: state.clone(),
        summary: crate::css_case_delivery_resolution_engine::policy::resolution_summary(&state),
        state,
        reasons,
    })
}

pub async fn build_delivery_resolution(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_resolution_engine::types::DeliveryResolutionViewRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryResolution> {
    let log_target = log_target_from_api_target(&req.target);

    resolve_delivery_state(
        pool,
        DeliveryResolutionRequest {
            target: log_target,
            mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode::Attachment,
            delivered: !req.latest_failed,
            failure_streak: req.consecutive_failures,
        },
        now_rfc3339,
    )
    .await
}
