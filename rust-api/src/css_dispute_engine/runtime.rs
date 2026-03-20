use crate::css_dispute_engine::types::{
    CssDisputeCase, DisputeDecision, DisputeKind, DisputeSeverity, DisputeStatus,
};

pub async fn open_dispute_case(
    pool: &sqlx::PgPool,
    kind: DisputeKind,
    severity: DisputeSeverity,
    catalog_id: Option<String>,
    ownership_id: Option<String>,
    deal_id: Option<String>,
    user_id: Option<String>,
    message: String,
) -> anyhow::Result<CssDisputeCase> {
    let case = CssDisputeCase {
        dispute_id: format!("disp_{}", uuid::Uuid::new_v4()),
        kind,
        severity,
        status: DisputeStatus::Open,
        catalog_id,
        ownership_id,
        deal_id,
        user_id,
        message,
        created_at: chrono::Utc::now().to_rfc3339(),
    };

    crate::css_dispute_engine::store_pg::insert_dispute_case(pool, &case).await?;
    let _ = crate::css_decision_graph::runtime::append_from_dispute(pool, &case, &case.created_at)
        .await;
    let snapshot_target = if let Some(catalog_id) = &case.catalog_id {
        Some((
            crate::css_signals_snapshot::types::SnapshotSubjectKind::Catalog,
            catalog_id.clone(),
        ))
    } else if let Some(deal_id) = &case.deal_id {
        Some((
            crate::css_signals_snapshot::types::SnapshotSubjectKind::Deal,
            deal_id.clone(),
        ))
    } else if let Some(ownership_id) = &case.ownership_id {
        Some((
            crate::css_signals_snapshot::types::SnapshotSubjectKind::Ownership,
            ownership_id.clone(),
        ))
    } else {
        case.user_id.as_ref().map(|user_id| {
            (
                crate::css_signals_snapshot::types::SnapshotSubjectKind::User,
                user_id.clone(),
            )
        })
    };
    if let Some((subject_kind, subject_id)) = snapshot_target {
        let _ = crate::css_signals_snapshot::runtime::create_snapshot(
            pool,
            crate::css_signals_snapshot::types::SnapshotCreateRequest {
                subject_kind,
                subject_id,
                purpose: crate::css_signals_snapshot::types::SnapshotPurpose::DisputeEvidence,
                related_audit_id: None,
                related_review_id: None,
                related_deal_id: case.deal_id.clone(),
                related_dispute_id: Some(case.dispute_id.clone()),
                source_system: "css_dispute".into(),
            },
            &case.created_at,
        )
        .await;
    }
    let _ = crate::css_signals_invalidation::runtime::invalidate_from_event(
        pool,
        crate::css_signals_invalidation::types::SignalsInvalidationEvent {
            event_id: format!("inv_{}", uuid::Uuid::new_v4()),
            event_kind:
                crate::css_signals_invalidation::types::InvalidationEventKind::DisputeOpened,
            user_id: case.user_id.clone(),
            catalog_id: case.catalog_id.clone(),
            deal_id: case.deal_id.clone(),
            ownership_id: case.ownership_id.clone(),
            source_system: Some("css_dispute".into()),
            created_at: case.created_at.clone(),
        },
    )
    .await;
    Ok(case)
}

pub async fn check_manual_bid_allowed(
    pool: &sqlx::PgPool,
    catalog_id: &str,
    bidder_user_id: &str,
) -> anyhow::Result<DisputeDecision> {
    let entry = crate::css_catalog_engine::store_pg::get_catalog_entry(pool, catalog_id).await?;
    let decision = crate::css_dispute_engine::policy::owner_cannot_bid_on_own_catalog(
        &entry.owner_user_id,
        bidder_user_id,
    );

    if !decision.allowed {
        let now = chrono::Utc::now().to_rfc3339();
        let dispute_case = open_dispute_case(
            pool,
            decision
                .dispute_kind
                .clone()
                .expect("dispute kind required when bid is denied"),
            decision
                .severity
                .clone()
                .expect("severity required when bid is denied"),
            Some(catalog_id.to_string()),
            None,
            None,
            Some(bidder_user_id.to_string()),
            decision.message.clone(),
        )
        .await
        .ok();
        let _ = crate::css_reputation_engine::runtime::apply_self_bidding_violation(
            pool,
            bidder_user_id,
            &now,
        )
        .await;
        if let Some(dispute_case) = dispute_case {
            let _ = crate::css_governance_timeline::runtime::apply_self_bidding_credit_penalty(
                pool,
                bidder_user_id,
                &dispute_case.dispute_id,
                &now,
            )
            .await;
        }
        let _ = crate::css_moderation_engine::runtime::open_self_bidding_moderation_case(
            pool,
            catalog_id,
            bidder_user_id,
            &now,
        )
        .await;
    }

    Ok(decision)
}

pub async fn check_auto_bid_allowed(
    pool: &sqlx::PgPool,
    catalog_id: &str,
    bidder_user_id: &str,
) -> anyhow::Result<DisputeDecision> {
    let entry = crate::css_catalog_engine::store_pg::get_catalog_entry(pool, catalog_id).await?;
    let decision = crate::css_dispute_engine::policy::owner_cannot_auto_bid_on_own_catalog(
        &entry.owner_user_id,
        bidder_user_id,
    );

    if !decision.allowed {
        let now = chrono::Utc::now().to_rfc3339();
        let dispute_case = open_dispute_case(
            pool,
            decision
                .dispute_kind
                .clone()
                .expect("dispute kind required when auto bid is denied"),
            decision
                .severity
                .clone()
                .expect("severity required when auto bid is denied"),
            Some(catalog_id.to_string()),
            None,
            None,
            Some(bidder_user_id.to_string()),
            decision.message.clone(),
        )
        .await
        .ok();
        let _ = crate::css_reputation_engine::runtime::apply_self_auto_bidding_violation(
            pool,
            bidder_user_id,
            &now,
        )
        .await;
        if let Some(dispute_case) = dispute_case {
            let _ =
                crate::css_governance_timeline::runtime::apply_self_auto_bidding_credit_penalty(
                    pool,
                    bidder_user_id,
                    &dispute_case.dispute_id,
                    &now,
                )
                .await;
        }
        let _ = crate::css_moderation_engine::runtime::open_self_bidding_moderation_case(
            pool,
            catalog_id,
            bidder_user_id,
            &now,
        )
        .await;
    }

    Ok(decision)
}
