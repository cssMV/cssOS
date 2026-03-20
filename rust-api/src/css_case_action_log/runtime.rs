use crate::css_case_action_log::types::{
    CaseActionLogKind, CaseActionLogSubjectKind, CssCaseActionLogRecord,
};

pub fn build_log_record(
    req: &crate::css_case_actions_engine::types::CaseActionRequest,
    result: &crate::css_case_actions_engine::types::CaseActionResult,
    now_rfc3339: &str,
) -> CssCaseActionLogRecord {
    CssCaseActionLogRecord {
        log_id: format!("cal_{}", uuid::Uuid::new_v4()),
        case_id: req.case_id.clone(),
        subject_kind: match req.subject_kind {
            crate::css_case_actions_engine::types::CaseActionSubjectKind::User => {
                CaseActionLogSubjectKind::User
            }
            crate::css_case_actions_engine::types::CaseActionSubjectKind::Catalog => {
                CaseActionLogSubjectKind::Catalog
            }
            crate::css_case_actions_engine::types::CaseActionSubjectKind::Deal => {
                CaseActionLogSubjectKind::Deal
            }
            crate::css_case_actions_engine::types::CaseActionSubjectKind::Ownership => {
                CaseActionLogSubjectKind::Ownership
            }
        },
        subject_id: req.subject_id.clone(),
        action: match req.action {
            crate::css_case_actions_engine::types::CaseActionKind::Approve => {
                CaseActionLogKind::Approve
            }
            crate::css_case_actions_engine::types::CaseActionKind::Reject => {
                CaseActionLogKind::Reject
            }
            crate::css_case_actions_engine::types::CaseActionKind::Freeze => {
                CaseActionLogKind::Freeze
            }
            crate::css_case_actions_engine::types::CaseActionKind::Escalate => {
                CaseActionLogKind::Escalate
            }
            crate::css_case_actions_engine::types::CaseActionKind::Release => {
                CaseActionLogKind::Release
            }
            crate::css_case_actions_engine::types::CaseActionKind::RequireReview => {
                CaseActionLogKind::RequireReview
            }
        },
        actor_user_id: req.actor_user_id.clone(),
        reason: req.reason.clone(),
        accepted: result.accepted,
        result_message: result.message.clone(),
        review_id: req.review_id.clone(),
        created_at: now_rfc3339.to_string(),
    }
}

pub async fn write_action_log(
    pool: &sqlx::PgPool,
    req: &crate::css_case_actions_engine::types::CaseActionRequest,
    result: &crate::css_case_actions_engine::types::CaseActionResult,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseActionLogRecord> {
    let record = build_log_record(req, result, now_rfc3339);
    crate::css_case_action_log::store_pg::insert_action_log(pool, &record).await?;
    Ok(record)
}

pub async fn list_case_logs(
    pool: &sqlx::PgPool,
    case_id: &str,
) -> anyhow::Result<Vec<CssCaseActionLogRecord>> {
    crate::css_case_action_log::store_pg::list_action_logs_for_case(pool, case_id).await
}

#[cfg(test)]
mod tests {
    use crate::css_case_actions_engine::types::{
        CaseActionKind, CaseActionRequest, CaseActionResult, CaseActionSubjectKind,
    };

    #[test]
    fn v192_build_log_record_keeps_review_and_result_fields() {
        let req = CaseActionRequest {
            case_id: "case:deal:deal_1".into(),
            subject_kind: CaseActionSubjectKind::Deal,
            subject_id: "deal_1".into(),
            action: CaseActionKind::Approve,
            actor_user_id: "operator_1".into(),
            reason: "all checks passed".into(),
            review_id: Some("rev_1".into()),
        };
        let result = CaseActionResult {
            case_id: req.case_id.clone(),
            subject_kind: req.subject_kind.clone(),
            subject_id: req.subject_id.clone(),
            action: req.action.clone(),
            accepted: true,
            message: "案件已通过。".into(),
        };

        let record = super::build_log_record(&req, &result, "2026-03-13T00:00:00Z");
        assert_eq!(record.case_id, "case:deal:deal_1");
        assert_eq!(record.subject_id, "deal_1");
        assert_eq!(record.review_id.as_deref(), Some("rev_1"));
        assert!(record.accepted);
        assert_eq!(record.result_message, "案件已通过。");
    }
}
