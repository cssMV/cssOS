use crate::css_case_actions_engine::types::{CaseActionKind, CaseActionRequest, CaseActionResult};

fn build_action_record(
    req: &CaseActionRequest,
    accepted: bool,
    message: &str,
    now_rfc3339: &str,
) -> crate::css_case_actions_engine::types::CaseActionRecord {
    crate::css_case_actions_engine::types::CaseActionRecord {
        action_id: format!("ca_{}", uuid::Uuid::new_v4()),
        case_id: req.case_id.clone(),
        subject_kind: req.subject_kind.clone(),
        subject_id: req.subject_id.clone(),
        action: req.action.clone(),
        actor_user_id: req.actor_user_id.clone(),
        reason: req.reason.clone(),
        accepted,
        message: message.to_string(),
        created_at: now_rfc3339.to_string(),
    }
}

pub async fn execute_approve(
    pool: &sqlx::PgPool,
    req: &CaseActionRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CaseActionResult> {
    if let Some(review_id) = &req.review_id {
        crate::css_review_queue::runtime::submit_review_decision(
            pool,
            crate::css_review_queue::types::ReviewDecision {
                review_id: review_id.clone(),
                decision: crate::css_review_queue::types::ReviewDecisionKind::Approve,
                comment: req.reason.clone(),
                reviewer_user_id: req.actor_user_id.clone(),
                decided_at: now_rfc3339.to_string(),
            },
        )
        .await?;
    }

    Ok(CaseActionResult {
        case_id: req.case_id.clone(),
        subject_kind: req.subject_kind.clone(),
        subject_id: req.subject_id.clone(),
        action: req.action.clone(),
        accepted: true,
        message: "案件已通过。".into(),
    })
}

pub async fn execute_reject(
    pool: &sqlx::PgPool,
    req: &CaseActionRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CaseActionResult> {
    if let Some(review_id) = &req.review_id {
        crate::css_review_queue::runtime::submit_review_decision(
            pool,
            crate::css_review_queue::types::ReviewDecision {
                review_id: review_id.clone(),
                decision: crate::css_review_queue::types::ReviewDecisionKind::Reject,
                comment: req.reason.clone(),
                reviewer_user_id: req.actor_user_id.clone(),
                decided_at: now_rfc3339.to_string(),
            },
        )
        .await?;
    }

    Ok(CaseActionResult {
        case_id: req.case_id.clone(),
        subject_kind: req.subject_kind.clone(),
        subject_id: req.subject_id.clone(),
        action: req.action.clone(),
        accepted: true,
        message: "案件已拒绝。".into(),
    })
}

pub async fn execute_freeze(
    _pool: &sqlx::PgPool,
    req: &CaseActionRequest,
) -> anyhow::Result<CaseActionResult> {
    if !crate::css_case_actions_engine::policy::can_freeze() {
        return Ok(CaseActionResult {
            case_id: req.case_id.clone(),
            subject_kind: req.subject_kind.clone(),
            subject_id: req.subject_id.clone(),
            action: req.action.clone(),
            accepted: false,
            message: "当前不允许执行 freeze。".into(),
        });
    }

    Ok(CaseActionResult {
        case_id: req.case_id.clone(),
        subject_kind: req.subject_kind.clone(),
        subject_id: req.subject_id.clone(),
        action: req.action.clone(),
        accepted: true,
        message: "冻结动作已接受，后续可接入 moderation/freeze runtime。".into(),
    })
}

pub async fn execute_escalate(
    _pool: &sqlx::PgPool,
    req: &CaseActionRequest,
) -> anyhow::Result<CaseActionResult> {
    if !crate::css_case_actions_engine::policy::can_escalate() {
        return Ok(CaseActionResult {
            case_id: req.case_id.clone(),
            subject_kind: req.subject_kind.clone(),
            subject_id: req.subject_id.clone(),
            action: req.action.clone(),
            accepted: false,
            message: "当前不允许执行 escalate。".into(),
        });
    }

    Ok(CaseActionResult {
        case_id: req.case_id.clone(),
        subject_kind: req.subject_kind.clone(),
        subject_id: req.subject_id.clone(),
        action: req.action.clone(),
        accepted: true,
        message: "案件已升级处理。".into(),
    })
}

pub async fn execute_release(
    _pool: &sqlx::PgPool,
    req: &CaseActionRequest,
) -> anyhow::Result<CaseActionResult> {
    if !crate::css_case_actions_engine::policy::can_release() {
        return Ok(CaseActionResult {
            case_id: req.case_id.clone(),
            subject_kind: req.subject_kind.clone(),
            subject_id: req.subject_id.clone(),
            action: req.action.clone(),
            accepted: false,
            message: "当前不允许执行 release。".into(),
        });
    }

    Ok(CaseActionResult {
        case_id: req.case_id.clone(),
        subject_kind: req.subject_kind.clone(),
        subject_id: req.subject_id.clone(),
        action: req.action.clone(),
        accepted: true,
        message: "释放动作已接受，后续可接入 unfreeze/release runtime。".into(),
    })
}

pub async fn execute_require_review(
    _pool: &sqlx::PgPool,
    req: &CaseActionRequest,
) -> anyhow::Result<CaseActionResult> {
    if !crate::css_case_actions_engine::policy::can_require_review() {
        return Ok(CaseActionResult {
            case_id: req.case_id.clone(),
            subject_kind: req.subject_kind.clone(),
            subject_id: req.subject_id.clone(),
            action: req.action.clone(),
            accepted: false,
            message: "当前不允许执行 require_review。".into(),
        });
    }

    Ok(CaseActionResult {
        case_id: req.case_id.clone(),
        subject_kind: req.subject_kind.clone(),
        subject_id: req.subject_id.clone(),
        action: req.action.clone(),
        accepted: true,
        message: "案件已标记为需要人工复核。".into(),
    })
}

pub async fn execute_case_action(
    pool: &sqlx::PgPool,
    req: CaseActionRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CaseActionResult> {
    let result = match req.action {
        CaseActionKind::Approve => execute_approve(pool, &req, now_rfc3339).await?,
        CaseActionKind::Reject => execute_reject(pool, &req, now_rfc3339).await?,
        CaseActionKind::Freeze => execute_freeze(pool, &req).await?,
        CaseActionKind::Escalate => execute_escalate(pool, &req).await?,
        CaseActionKind::Release => execute_release(pool, &req).await?,
        CaseActionKind::RequireReview => execute_require_review(pool, &req).await?,
    };

    let _record = build_action_record(&req, result.accepted, &result.message, now_rfc3339);
    let _log =
        crate::css_case_action_log::runtime::write_action_log(pool, &req, &result, now_rfc3339)
            .await?;
    if result.accepted {
        if let Some(resolution_req) =
            crate::css_resolution_engine::runtime::build_resolution_request_from_case_action(&req)
        {
            let _ = crate::css_resolution_engine::runtime::resolve_case(
                pool,
                resolution_req,
                now_rfc3339,
            )
            .await?;
        }
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use crate::css_case_actions_engine::types::{
        CaseActionKind, CaseActionRequest, CaseActionSubjectKind,
    };

    #[test]
    fn v191_action_record_builder_keeps_core_fields() {
        let req = CaseActionRequest {
            case_id: "case:deal:deal_1".into(),
            subject_kind: CaseActionSubjectKind::Deal,
            subject_id: "deal_1".into(),
            action: CaseActionKind::Freeze,
            actor_user_id: "operator_1".into(),
            reason: "risk spike".into(),
            review_id: None,
        };

        let record = super::build_action_record(&req, true, "ok", "2026-03-13T00:00:00Z");
        assert_eq!(record.case_id, req.case_id);
        assert_eq!(record.subject_id, "deal_1");
        assert_eq!(record.message, "ok");
        assert!(record.accepted);
    }
}
