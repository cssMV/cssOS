use crate::css_resolution_engine::types::{
    CssResolutionRecord, ResolutionDecisionKind, ResolutionStatus, ResolutionSubjectKind,
};
use crate::css_resolution_log::types::{
    CssResolutionLogRecord, ResolutionLogDecisionKind, ResolutionLogStatus,
    ResolutionLogSubjectKind,
};

fn from_resolution_subject_kind(kind: &ResolutionSubjectKind) -> ResolutionLogSubjectKind {
    match kind {
        ResolutionSubjectKind::User => ResolutionLogSubjectKind::User,
        ResolutionSubjectKind::Catalog => ResolutionLogSubjectKind::Catalog,
        ResolutionSubjectKind::Deal => ResolutionLogSubjectKind::Deal,
        ResolutionSubjectKind::Ownership => ResolutionLogSubjectKind::Ownership,
    }
}

fn from_resolution_decision(kind: &ResolutionDecisionKind) -> ResolutionLogDecisionKind {
    match kind {
        ResolutionDecisionKind::Resolve => ResolutionLogDecisionKind::Resolve,
        ResolutionDecisionKind::Dismiss => ResolutionLogDecisionKind::Dismiss,
        ResolutionDecisionKind::Release => ResolutionLogDecisionKind::Release,
        ResolutionDecisionKind::EscalateToManual => ResolutionLogDecisionKind::EscalateToManual,
        ResolutionDecisionKind::FreezeUntilReview => ResolutionLogDecisionKind::FreezeUntilReview,
    }
}

fn from_resolution_status(status: &ResolutionStatus) -> ResolutionLogStatus {
    match status {
        ResolutionStatus::Open => ResolutionLogStatus::Open,
        ResolutionStatus::Resolved => ResolutionLogStatus::Resolved,
        ResolutionStatus::Dismissed => ResolutionLogStatus::Dismissed,
        ResolutionStatus::Released => ResolutionLogStatus::Released,
        ResolutionStatus::EscalatedToManual => ResolutionLogStatus::EscalatedToManual,
        ResolutionStatus::FrozenUntilReview => ResolutionLogStatus::FrozenUntilReview,
    }
}

pub fn build_resolution_log_record(record: &CssResolutionRecord) -> CssResolutionLogRecord {
    CssResolutionLogRecord {
        log_id: format!("rlog_{}", uuid::Uuid::new_v4()),
        resolution_id: record.resolution_id.clone(),
        case_id: record.case_id.clone(),
        subject_kind: from_resolution_subject_kind(&record.subject_kind),
        subject_id: record.subject_id.clone(),
        decision: from_resolution_decision(&record.decision),
        status: from_resolution_status(&record.status),
        actor_user_id: record.actor_user_id.clone(),
        reason: record.reason.clone(),
        is_closed_like: crate::css_resolution_engine::policy::is_closed_like(&record.status),
        review_id: record.review_id.clone(),
        created_at: record.created_at.clone(),
    }
}

pub async fn write_resolution_log(
    pool: &sqlx::PgPool,
    record: &CssResolutionRecord,
) -> anyhow::Result<CssResolutionLogRecord> {
    let log = build_resolution_log_record(record);
    crate::css_resolution_log::store_pg::insert_resolution_log(pool, &log).await?;
    Ok(log)
}

pub async fn load_latest_case_resolution(
    pool: &sqlx::PgPool,
    case_id: &str,
) -> anyhow::Result<Option<CssResolutionLogRecord>> {
    crate::css_resolution_log::store_pg::get_latest_resolution_for_case(pool, case_id).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v196_log_record_marks_resolved_as_closed_like() {
        let record = CssResolutionRecord {
            resolution_id: "res_1".into(),
            case_id: "case:deal:deal_1".into(),
            subject_kind: ResolutionSubjectKind::Deal,
            subject_id: "deal_1".into(),
            decision: ResolutionDecisionKind::Resolve,
            status: ResolutionStatus::Resolved,
            actor_user_id: "operator_1".into(),
            reason: "all clear".into(),
            review_id: Some("rev_1".into()),
            created_at: "2026-03-13T00:00:00Z".into(),
        };

        let log = build_resolution_log_record(&record);
        assert!(log.is_closed_like);
        assert_eq!(log.status, ResolutionLogStatus::Resolved);
    }
}
