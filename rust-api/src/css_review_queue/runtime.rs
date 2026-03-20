use crate::css_review_queue::types::{
    CssReviewItem, ReviewDecision, ReviewOpenRequest, ReviewStatus, ReviewSubjectKind,
};

pub async fn open_review(
    pool: &sqlx::PgPool,
    req: ReviewOpenRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssReviewItem> {
    let item = CssReviewItem {
        review_id: format!("rev_{}", uuid::Uuid::new_v4()),
        subject_kind: req.subject_kind,
        subject_id: req.subject_id,
        priority: req.priority,
        status: ReviewStatus::Open,
        source_action: req.source_action,
        source_code: req.source_code,
        reason: req.reason,
        actor_user_id: req.actor_user_id,
        assigned_reviewer_id: None,
        created_at: now_rfc3339.to_string(),
    };
    crate::css_review_queue::store_pg::insert_review_item(pool, &item).await?;
    let _ = crate::css_decision_graph::runtime::append_from_review(pool, &item, now_rfc3339).await;
    let snapshot_subject_kind = match item.subject_kind {
        ReviewSubjectKind::User => {
            Some(crate::css_signals_snapshot::types::SnapshotSubjectKind::User)
        }
        ReviewSubjectKind::Catalog | ReviewSubjectKind::Auction => {
            Some(crate::css_signals_snapshot::types::SnapshotSubjectKind::Catalog)
        }
        ReviewSubjectKind::Deal => {
            Some(crate::css_signals_snapshot::types::SnapshotSubjectKind::Deal)
        }
        ReviewSubjectKind::Ownership => {
            Some(crate::css_signals_snapshot::types::SnapshotSubjectKind::Ownership)
        }
    };
    if let Some(snapshot_subject_kind) = snapshot_subject_kind {
        let _ = crate::css_signals_snapshot::runtime::create_snapshot(
            pool,
            crate::css_signals_snapshot::types::SnapshotCreateRequest {
                subject_kind: snapshot_subject_kind,
                subject_id: item.subject_id.clone(),
                purpose: crate::css_signals_snapshot::types::SnapshotPurpose::ReviewOpen,
                related_audit_id: None,
                related_review_id: Some(item.review_id.clone()),
                related_deal_id: None,
                related_dispute_id: None,
                source_system: "css_review_queue".into(),
            },
            now_rfc3339,
        )
        .await;
    }
    Ok(item)
}

pub async fn open_review_from_ts(
    pool: &sqlx::PgPool,
    ts_req: &crate::css_ts_runtime::types::TsRuntimeRequest,
    ts_decision: &crate::css_ts_runtime::types::TsRuntimeDecision,
    now_rfc3339: &str,
) -> anyhow::Result<Option<CssReviewItem>> {
    if !matches!(
        ts_decision.decision,
        crate::css_ts_runtime::types::TsDecisionKind::ReviewRequired
    ) {
        return Ok(None);
    }

    let subject_kind = match ts_req
        .subject_kind
        .clone()
        .unwrap_or(crate::css_ts_runtime::types::TsSubjectKind::User)
    {
        crate::css_ts_runtime::types::TsSubjectKind::User => ReviewSubjectKind::User,
        crate::css_ts_runtime::types::TsSubjectKind::Catalog => ReviewSubjectKind::Catalog,
        crate::css_ts_runtime::types::TsSubjectKind::Auction => ReviewSubjectKind::Auction,
        crate::css_ts_runtime::types::TsSubjectKind::Deal => ReviewSubjectKind::Deal,
        crate::css_ts_runtime::types::TsSubjectKind::Ownership => ReviewSubjectKind::Ownership,
    };

    let subject_id = ts_req
        .subject_id
        .clone()
        .unwrap_or_else(|| "unknown".to_string());
    let action = format!("{:?}", ts_req.action).to_lowercase();

    let item = open_review(
        pool,
        ReviewOpenRequest {
            subject_kind,
            subject_id,
            source_action: action.clone(),
            source_code: ts_decision.code.clone(),
            reason: ts_decision.message.clone(),
            actor_user_id: Some(ts_req.actor_user_id.clone()),
            priority: crate::css_review_queue::policy::priority_from_ts(
                &action,
                ts_req.amount_cents,
            ),
        },
        now_rfc3339,
    )
    .await?;

    Ok(Some(item))
}

pub async fn assign_review(
    pool: &sqlx::PgPool,
    review_id: &str,
    reviewer_user_id: &str,
) -> anyhow::Result<()> {
    let item = crate::css_review_queue::store_pg::get_review_item(pool, review_id).await?;
    if !crate::css_review_queue::policy::can_transition(&item.status, &ReviewStatus::Assigned) {
        anyhow::bail!("invalid review status transition");
    }
    crate::css_review_queue::store_pg::assign_review_item(pool, review_id, reviewer_user_id)
        .await?;
    crate::css_review_queue::store_pg::update_review_status(
        pool,
        review_id,
        ReviewStatus::Assigned,
    )
    .await?;
    Ok(())
}

pub async fn submit_review_decision(
    pool: &sqlx::PgPool,
    decision: ReviewDecision,
) -> anyhow::Result<()> {
    let item =
        crate::css_review_queue::store_pg::get_review_item(pool, &decision.review_id).await?;
    let next_status = crate::css_review_queue::policy::status_from_decision(&decision.decision);
    if !crate::css_review_queue::policy::can_transition(&item.status, &next_status) {
        anyhow::bail!("invalid decision transition");
    }
    crate::css_review_queue::store_pg::insert_review_decision(pool, &decision).await?;
    crate::css_review_queue::store_pg::update_review_status(pool, &decision.review_id, next_status)
        .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::css_review_queue::types::ReviewPriority;

    #[test]
    fn v168_review_open_request_keeps_priority_and_reason() {
        let req = ReviewOpenRequest {
            subject_kind: ReviewSubjectKind::Deal,
            subject_id: "deal_1".into(),
            source_action: "finalize_deal".into(),
            source_code: "ts_review_high_value_trade".into(),
            reason: "manual review required".into(),
            actor_user_id: Some("user_1".into()),
            priority: ReviewPriority::High,
        };
        assert_eq!(req.priority, ReviewPriority::High);
        assert_eq!(req.reason, "manual review required");
    }
}
