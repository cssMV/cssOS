use crate::css_case_actions_engine::types::{
    CaseActionKind, CaseActionRequest, CaseActionSubjectKind,
};
use crate::css_resolution_engine::types::{
    CssResolutionRecord, ResolutionDecisionKind, ResolutionRequest, ResolutionResult,
    ResolutionStatus, ResolutionSubjectKind,
};

fn to_resolution_subject_kind(kind: &CaseActionSubjectKind) -> ResolutionSubjectKind {
    match kind {
        CaseActionSubjectKind::User => ResolutionSubjectKind::User,
        CaseActionSubjectKind::Catalog => ResolutionSubjectKind::Catalog,
        CaseActionSubjectKind::Deal => ResolutionSubjectKind::Deal,
        CaseActionSubjectKind::Ownership => ResolutionSubjectKind::Ownership,
    }
}

pub fn build_resolution_record(
    req: &ResolutionRequest,
    status: ResolutionStatus,
    now_rfc3339: &str,
) -> CssResolutionRecord {
    CssResolutionRecord {
        resolution_id: format!("res_{}", uuid::Uuid::new_v4()),
        case_id: req.case_id.clone(),
        subject_kind: req.subject_kind.clone(),
        subject_id: req.subject_id.clone(),
        decision: req.decision.clone(),
        status,
        actor_user_id: req.actor_user_id.clone(),
        reason: req.reason.clone(),
        review_id: req.review_id.clone(),
        created_at: now_rfc3339.to_string(),
    }
}

pub fn resolution_from_case_action(req: &CaseActionRequest) -> Option<ResolutionDecisionKind> {
    match req.action {
        CaseActionKind::Approve => Some(ResolutionDecisionKind::Resolve),
        CaseActionKind::Reject => Some(ResolutionDecisionKind::Dismiss),
        CaseActionKind::Release => Some(ResolutionDecisionKind::Release),
        CaseActionKind::Escalate => Some(ResolutionDecisionKind::EscalateToManual),
        CaseActionKind::Freeze => Some(ResolutionDecisionKind::FreezeUntilReview),
        CaseActionKind::RequireReview => Some(ResolutionDecisionKind::EscalateToManual),
    }
}

pub fn build_resolution_request_from_case_action(
    req: &CaseActionRequest,
) -> Option<ResolutionRequest> {
    let decision = resolution_from_case_action(req)?;

    Some(ResolutionRequest {
        case_id: req.case_id.clone(),
        subject_kind: to_resolution_subject_kind(&req.subject_kind),
        subject_id: req.subject_id.clone(),
        decision,
        actor_user_id: req.actor_user_id.clone(),
        reason: req.reason.clone(),
        review_id: req.review_id.clone(),
    })
}

pub async fn resolve_case(
    pool: &sqlx::PgPool,
    req: ResolutionRequest,
    now_rfc3339: &str,
) -> anyhow::Result<ResolutionResult> {
    let status = crate::css_resolution_engine::policy::decision_to_status(&req.decision);
    let record = build_resolution_record(&req, status.clone(), now_rfc3339);
    let _ = crate::css_resolution_log::runtime::write_resolution_log(pool, &record).await?;

    Ok(ResolutionResult {
        case_id: req.case_id,
        status: status.clone(),
        accepted: true,
        message: crate::css_resolution_engine::policy::default_message(&status),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v195_require_review_maps_to_escalated_to_manual() {
        let request = CaseActionRequest {
            case_id: "case:deal:deal_1".into(),
            subject_kind: CaseActionSubjectKind::Deal,
            subject_id: "deal_1".into(),
            action: CaseActionKind::RequireReview,
            actor_user_id: "operator_1".into(),
            reason: "needs escalation".into(),
            review_id: Some("rev_1".into()),
        };

        let resolution = build_resolution_request_from_case_action(&request).expect("resolution");
        assert_eq!(
            resolution.decision,
            ResolutionDecisionKind::EscalateToManual
        );
        assert_eq!(resolution.subject_kind, ResolutionSubjectKind::Deal);
    }
}
