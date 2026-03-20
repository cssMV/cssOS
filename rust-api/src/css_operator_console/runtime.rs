use crate::css_operator_console::types::{
    ConsoleAuctionSummary, ConsoleCaseView, ConsoleDealSummary, ConsoleOwnershipSummary,
    ConsoleQueueItem,
};

pub async fn list_open_queue(pool: &sqlx::PgPool) -> anyhow::Result<Vec<ConsoleQueueItem>> {
    let items = crate::css_review_queue::store_pg::list_open_reviews(pool).await?;
    Ok(items
        .iter()
        .map(crate::css_operator_console::composer::compose_queue_item)
        .collect())
}

pub async fn load_case_view(
    pool: &sqlx::PgPool,
    review_id: &str,
) -> anyhow::Result<ConsoleCaseView> {
    let review = crate::css_review_queue::store_pg::get_review_item(pool, review_id).await?;
    let review_view = crate::css_operator_console::composer::compose_queue_item(&review);
    let workspace = load_case_workspace(pool, &review).await.ok();
    let inspector = load_case_inspector(pool, &review).await.ok();

    let reputation = if let Some(user_id) = &review.actor_user_id {
        let profile =
            crate::css_reputation_engine::store_pg::get_or_create_profile(pool, user_id).await?;
        Some(crate::css_operator_console::composer::compose_reputation(
            &profile,
        ))
    } else {
        None
    };

    let disputes = if let Some(user_id) = &review.actor_user_id {
        crate::css_dispute_engine::store_pg::list_open_disputes_for_user(pool, user_id)
            .await
            .unwrap_or_default()
            .iter()
            .map(crate::css_operator_console::composer::compose_dispute)
            .collect()
    } else {
        Vec::new()
    };

    let moderation_cases = if let Some(user_id) = &review.actor_user_id {
        crate::css_moderation_engine::store_pg::list_cases_for_subject(
            pool,
            crate::css_moderation_engine::types::ModerationSubjectKind::User,
            user_id,
        )
        .await
        .unwrap_or_default()
        .iter()
        .map(crate::css_operator_console::composer::compose_moderation)
        .collect()
    } else {
        Vec::new()
    };

    let auction = load_auction_summary(pool, &review).await.ok().flatten();
    let deal = load_deal_summary(pool, &review).await.ok().flatten();
    let ownership = load_ownership_summary(pool, &review).await.ok().flatten();
    let bid_ledger = load_bid_ledger_view(pool, &review).await.ok().flatten();
    let decision_graph = load_decision_graph(pool, &review).await.ok().flatten();
    let operator_reasoning = load_operator_reasoning(pool, &review).await.ok().flatten();
    let signals_replay = load_signals_replay(pool, &review).await.ok().flatten();
    let signals_narrative = load_signals_narrative(pool, &review).await.ok().flatten();
    let signals_storyboard = load_signals_storyboard(pool, &review).await.ok().flatten();
    let timeline_ui_model = load_timeline_ui_model(pool, &review).await.ok().flatten();
    let case_timeline = workspace.as_ref().and_then(|w| w.case_timeline.clone());
    let timeline_explain = workspace.as_ref().and_then(|w| w.timeline_explain.clone());
    let case_status = workspace.as_ref().and_then(|w| w.status_view.clone());
    let lifecycle_view = workspace.as_ref().and_then(|w| w.lifecycle_view.clone());
    let summary_view = workspace.as_ref().and_then(|w| w.summary_view.clone());

    Ok(ConsoleCaseView {
        review: review_view,
        workspace,
        inspector,
        reputation,
        disputes,
        moderation_cases,
        auction,
        deal,
        ownership,
        bid_ledger,
        decision_graph,
        operator_reasoning,
        signals_replay,
        signals_narrative,
        signals_storyboard,
        timeline_ui_model,
        case_timeline,
        timeline_explain,
        case_status,
        lifecycle_view,
        summary_view,
    })
}

async fn load_case_workspace(
    pool: &sqlx::PgPool,
    review: &crate::css_review_queue::types::CssReviewItem,
) -> anyhow::Result<crate::css_case_workspace::types::CssCaseWorkspace> {
    let subject_kind = match review.subject_kind {
        crate::css_review_queue::types::ReviewSubjectKind::User => {
            crate::css_case_workspace::types::CaseWorkspaceSubjectKind::User
        }
        crate::css_review_queue::types::ReviewSubjectKind::Catalog
        | crate::css_review_queue::types::ReviewSubjectKind::Auction => {
            crate::css_case_workspace::types::CaseWorkspaceSubjectKind::Catalog
        }
        crate::css_review_queue::types::ReviewSubjectKind::Deal => {
            crate::css_case_workspace::types::CaseWorkspaceSubjectKind::Deal
        }
        crate::css_review_queue::types::ReviewSubjectKind::Ownership => {
            crate::css_case_workspace::types::CaseWorkspaceSubjectKind::Ownership
        }
    };

    let audits = crate::css_rule_audit::store_pg::list_rule_audits_for_subject(
        pool,
        &format!("{:?}", review.subject_kind).to_lowercase(),
        &review.subject_id,
    )
    .await
    .unwrap_or_default();

    crate::css_case_workspace::runtime::build_case_workspace(
        pool,
        crate::css_case_workspace::types::CaseWorkspaceRequest {
            subject_kind,
            subject_id: review.subject_id.clone(),
            review_id: Some(review.review_id.clone()),
            audit_id: audits.first().map(|a| a.audit_id.clone()),
            dispute_id: None,
        },
    )
    .await
}

async fn load_case_inspector(
    pool: &sqlx::PgPool,
    review: &crate::css_review_queue::types::CssReviewItem,
) -> anyhow::Result<crate::css_inspector_view::types::CssInspectorView> {
    let audits = crate::css_rule_audit::store_pg::list_rule_audits_for_subject(
        pool,
        &format!("{:?}", review.subject_kind).to_lowercase(),
        &review.subject_id,
    )
    .await
    .unwrap_or_default();

    if let Some(audit) = audits.first() {
        return crate::css_inspector_view::runtime::build_inspector_view(
            pool,
            crate::css_inspector_view::types::InspectorRequest {
                target_kind: crate::css_inspector_view::types::InspectorTargetKind::RuleAudit,
                source_system: "css_rule_audit".into(),
                source_id: audit.audit_id.clone(),
            },
        )
        .await;
    }

    crate::css_inspector_view::runtime::build_inspector_view(
        pool,
        crate::css_inspector_view::types::InspectorRequest {
            target_kind: crate::css_inspector_view::types::InspectorTargetKind::TimelineUiItem,
            source_system: "css_review_queue".into(),
            source_id: review.review_id.clone(),
        },
    )
    .await
}

pub async fn assign_case_to_reviewer(
    pool: &sqlx::PgPool,
    review_id: &str,
    reviewer_user_id: &str,
) -> anyhow::Result<()> {
    crate::css_review_queue::runtime::assign_review(pool, review_id, reviewer_user_id).await
}

pub async fn submit_case_decision(
    pool: &sqlx::PgPool,
    review_id: &str,
    reviewer_user_id: &str,
    decision: crate::css_review_queue::types::ReviewDecisionKind,
    comment: &str,
) -> anyhow::Result<()> {
    let review = crate::css_review_queue::store_pg::get_review_item(pool, review_id).await?;
    let subject_kind = match review.subject_kind {
        crate::css_review_queue::types::ReviewSubjectKind::User => {
            crate::css_case_actions_engine::types::CaseActionSubjectKind::User
        }
        crate::css_review_queue::types::ReviewSubjectKind::Catalog
        | crate::css_review_queue::types::ReviewSubjectKind::Auction => {
            crate::css_case_actions_engine::types::CaseActionSubjectKind::Catalog
        }
        crate::css_review_queue::types::ReviewSubjectKind::Deal => {
            crate::css_case_actions_engine::types::CaseActionSubjectKind::Deal
        }
        crate::css_review_queue::types::ReviewSubjectKind::Ownership => {
            crate::css_case_actions_engine::types::CaseActionSubjectKind::Ownership
        }
    };

    let action = match decision {
        crate::css_review_queue::types::ReviewDecisionKind::Approve => {
            crate::css_case_actions_engine::types::CaseActionKind::Approve
        }
        crate::css_review_queue::types::ReviewDecisionKind::Reject => {
            crate::css_case_actions_engine::types::CaseActionKind::Reject
        }
        crate::css_review_queue::types::ReviewDecisionKind::Freeze => {
            crate::css_case_actions_engine::types::CaseActionKind::Freeze
        }
        crate::css_review_queue::types::ReviewDecisionKind::Escalate => {
            crate::css_case_actions_engine::types::CaseActionKind::Escalate
        }
    };

    crate::css_case_actions_engine::runtime::execute_case_action(
        pool,
        crate::css_case_actions_engine::types::CaseActionRequest {
            case_id: format!(
                "case:{}:{}",
                format!("{:?}", subject_kind).to_lowercase(),
                review.subject_id
            ),
            subject_kind,
            subject_id: review.subject_id,
            action,
            actor_user_id: reviewer_user_id.to_string(),
            reason: comment.to_string(),
            review_id: Some(review_id.to_string()),
        },
        &chrono::Utc::now().to_rfc3339(),
    )
    .await?;

    Ok(())
}

async fn load_auction_summary(
    pool: &sqlx::PgPool,
    review: &crate::css_review_queue::types::CssReviewItem,
) -> anyhow::Result<Option<ConsoleAuctionSummary>> {
    let catalog_id = match review.subject_kind {
        crate::css_review_queue::types::ReviewSubjectKind::Catalog
        | crate::css_review_queue::types::ReviewSubjectKind::Auction => review.subject_id.clone(),
        _ => return Ok(None),
    };

    let ledger = crate::css_bid_ledger::runtime::build_snapshot(pool, &catalog_id).await?;
    Ok(Some(ConsoleAuctionSummary {
        catalog_id: Some(catalog_id),
        current_leader_user_id: ledger.current_leader_user_id,
        current_price_cents: ledger.current_price_cents,
        bid_count: ledger.total_entries,
        finalized: ledger.finalized,
    }))
}

async fn load_deal_summary(
    pool: &sqlx::PgPool,
    review: &crate::css_review_queue::types::CssReviewItem,
) -> anyhow::Result<Option<ConsoleDealSummary>> {
    if !matches!(
        review.subject_kind,
        crate::css_review_queue::types::ReviewSubjectKind::Deal
    ) {
        return Ok(None);
    }

    let deal = crate::css_deal_engine::store_pg::get_deal(pool, &review.subject_id).await?;
    Ok(Some(ConsoleDealSummary {
        deal_id: Some(deal.deal_id),
        seller_user_id: Some(deal.seller_user_id),
        buyer_user_id: Some(deal.buyer_user_id),
        status: Some(format!("{:?}", deal.status).to_lowercase()),
        price_cents: Some(deal.price_cents),
    }))
}

async fn load_ownership_summary(
    pool: &sqlx::PgPool,
    review: &crate::css_review_queue::types::CssReviewItem,
) -> anyhow::Result<Option<ConsoleOwnershipSummary>> {
    if !matches!(
        review.subject_kind,
        crate::css_review_queue::types::ReviewSubjectKind::Ownership
    ) {
        return Ok(None);
    }

    let ownership =
        crate::css_ownership_engine::store_pg::get_ownership(pool, &review.subject_id).await?;
    Ok(Some(ConsoleOwnershipSummary {
        ownership_id: Some(ownership.ownership_id),
        owner_user_id: Some(ownership.owner_user_id),
        priceless: ownership.priceless,
        resale_enabled: ownership.resale_enabled,
    }))
}

async fn load_bid_ledger_view(
    pool: &sqlx::PgPool,
    review: &crate::css_review_queue::types::CssReviewItem,
) -> anyhow::Result<Option<crate::css_operator_console::types::ConsoleBidLedgerView>> {
    let catalog_id = match review.subject_kind {
        crate::css_review_queue::types::ReviewSubjectKind::Catalog
        | crate::css_review_queue::types::ReviewSubjectKind::Auction => review.subject_id.clone(),
        _ => return Ok(None),
    };
    let ledger = crate::css_bid_ledger::runtime::build_snapshot(pool, &catalog_id).await?;
    Ok(Some(
        crate::css_operator_console::composer::compose_bid_ledger(&ledger),
    ))
}

async fn load_decision_graph(
    pool: &sqlx::PgPool,
    review: &crate::css_review_queue::types::CssReviewItem,
) -> anyhow::Result<Option<crate::css_decision_graph::types::DecisionGraphView>> {
    let subject_kind = match review.subject_kind {
        crate::css_review_queue::types::ReviewSubjectKind::User => "user",
        crate::css_review_queue::types::ReviewSubjectKind::Catalog => "catalog",
        crate::css_review_queue::types::ReviewSubjectKind::Auction => "auction",
        crate::css_review_queue::types::ReviewSubjectKind::Deal => "deal",
        crate::css_review_queue::types::ReviewSubjectKind::Ownership => "ownership",
    };

    let graph = crate::css_decision_graph::runtime::load_subject_graph(
        pool,
        subject_kind,
        &review.subject_id,
    )
    .await?;

    if graph.nodes.is_empty() && graph.edges.is_empty() {
        return Ok(None);
    }

    Ok(Some(graph))
}

async fn load_operator_reasoning(
    pool: &sqlx::PgPool,
    review: &crate::css_review_queue::types::CssReviewItem,
) -> anyhow::Result<Option<crate::css_reasoning_view::types::CssReasoningView>> {
    let subject_kind = match review.subject_kind {
        crate::css_review_queue::types::ReviewSubjectKind::User => {
            crate::css_governance_timeline::types::TimelineSubjectKind::User
        }
        crate::css_review_queue::types::ReviewSubjectKind::Catalog => {
            crate::css_governance_timeline::types::TimelineSubjectKind::Catalog
        }
        crate::css_review_queue::types::ReviewSubjectKind::Auction => {
            crate::css_governance_timeline::types::TimelineSubjectKind::Auction
        }
        crate::css_review_queue::types::ReviewSubjectKind::Deal => {
            crate::css_governance_timeline::types::TimelineSubjectKind::Deal
        }
        crate::css_review_queue::types::ReviewSubjectKind::Ownership => {
            crate::css_governance_timeline::types::TimelineSubjectKind::Ownership
        }
    };

    let audits = crate::css_rule_audit::store_pg::list_rule_audits_for_subject(
        pool,
        &format!("{:?}", review.subject_kind).to_lowercase(),
        &review.subject_id,
    )
    .await?;
    let Some(audit) = audits.first() else {
        return Ok(None);
    };

    let reasoning = crate::css_reasoning_view::runtime::build_operator_reasoning(
        pool,
        &audit.audit_id,
        subject_kind,
        &review.subject_id,
    )
    .await?;

    Ok(Some(reasoning))
}

async fn load_signals_replay(
    pool: &sqlx::PgPool,
    review: &crate::css_review_queue::types::CssReviewItem,
) -> anyhow::Result<Option<crate::css_signals_replay::types::SignalsReplayView>> {
    let subject_kind = match review.subject_kind {
        crate::css_review_queue::types::ReviewSubjectKind::User => {
            crate::css_signals_replay::types::ReplaySubjectKind::User
        }
        crate::css_review_queue::types::ReviewSubjectKind::Catalog
        | crate::css_review_queue::types::ReviewSubjectKind::Auction => {
            crate::css_signals_replay::types::ReplaySubjectKind::Catalog
        }
        crate::css_review_queue::types::ReviewSubjectKind::Deal => {
            crate::css_signals_replay::types::ReplaySubjectKind::Deal
        }
        crate::css_review_queue::types::ReviewSubjectKind::Ownership => {
            crate::css_signals_replay::types::ReplaySubjectKind::Ownership
        }
    };

    let replay = crate::css_signals_replay::runtime::build_replay(
        pool,
        crate::css_signals_replay::types::ReplayRequest {
            subject_kind,
            subject_id: review.subject_id.clone(),
        },
    )
    .await?;

    if replay.frames.is_empty() {
        return Ok(None);
    }

    Ok(Some(replay))
}

async fn load_signals_narrative(
    pool: &sqlx::PgPool,
    review: &crate::css_review_queue::types::CssReviewItem,
) -> anyhow::Result<Option<crate::css_signals_narrative::types::CssSignalsNarrative>> {
    let subject_kind = match review.subject_kind {
        crate::css_review_queue::types::ReviewSubjectKind::User => {
            crate::css_signals_narrative::types::NarrativeSubjectKind::User
        }
        crate::css_review_queue::types::ReviewSubjectKind::Catalog
        | crate::css_review_queue::types::ReviewSubjectKind::Auction => {
            crate::css_signals_narrative::types::NarrativeSubjectKind::Catalog
        }
        crate::css_review_queue::types::ReviewSubjectKind::Deal => {
            crate::css_signals_narrative::types::NarrativeSubjectKind::Deal
        }
        crate::css_review_queue::types::ReviewSubjectKind::Ownership => {
            crate::css_signals_narrative::types::NarrativeSubjectKind::Ownership
        }
    };

    let narrative = crate::css_signals_narrative::runtime::build_narrative(
        pool,
        crate::css_signals_narrative::types::NarrativeRequest {
            subject_kind,
            subject_id: review.subject_id.clone(),
        },
    )
    .await?;

    if narrative.summary.is_empty() && narrative.milestones.is_empty() {
        return Ok(None);
    }

    Ok(Some(narrative))
}

async fn load_signals_storyboard(
    pool: &sqlx::PgPool,
    review: &crate::css_review_queue::types::CssReviewItem,
) -> anyhow::Result<Option<crate::css_signals_storyboard::types::CssSignalsStoryboard>> {
    let subject_kind = match review.subject_kind {
        crate::css_review_queue::types::ReviewSubjectKind::User => {
            crate::css_signals_storyboard::types::StoryboardSubjectKind::User
        }
        crate::css_review_queue::types::ReviewSubjectKind::Catalog
        | crate::css_review_queue::types::ReviewSubjectKind::Auction => {
            crate::css_signals_storyboard::types::StoryboardSubjectKind::Catalog
        }
        crate::css_review_queue::types::ReviewSubjectKind::Deal => {
            crate::css_signals_storyboard::types::StoryboardSubjectKind::Deal
        }
        crate::css_review_queue::types::ReviewSubjectKind::Ownership => {
            crate::css_signals_storyboard::types::StoryboardSubjectKind::Ownership
        }
    };

    let storyboard = crate::css_signals_storyboard::runtime::build_storyboard(
        pool,
        crate::css_signals_storyboard::types::StoryboardRequest {
            subject_kind,
            subject_id: review.subject_id.clone(),
        },
    )
    .await?;

    if storyboard.cards.is_empty() {
        return Ok(None);
    }

    Ok(Some(storyboard))
}

async fn load_timeline_ui_model(
    pool: &sqlx::PgPool,
    review: &crate::css_review_queue::types::CssReviewItem,
) -> anyhow::Result<Option<crate::css_timeline_ui_model::types::CssTimelineUiModel>> {
    let subject_kind = match review.subject_kind {
        crate::css_review_queue::types::ReviewSubjectKind::User => {
            crate::css_timeline_ui_model::types::TimelineUiSubjectKind::User
        }
        crate::css_review_queue::types::ReviewSubjectKind::Catalog
        | crate::css_review_queue::types::ReviewSubjectKind::Auction => {
            crate::css_timeline_ui_model::types::TimelineUiSubjectKind::Catalog
        }
        crate::css_review_queue::types::ReviewSubjectKind::Deal => {
            crate::css_timeline_ui_model::types::TimelineUiSubjectKind::Deal
        }
        crate::css_review_queue::types::ReviewSubjectKind::Ownership => {
            crate::css_timeline_ui_model::types::TimelineUiSubjectKind::Ownership
        }
    };

    let model = crate::css_timeline_ui_model::runtime::build_timeline_ui_model(
        pool,
        crate::css_timeline_ui_model::types::TimelineUiRequest {
            subject_kind,
            subject_id: review.subject_id.clone(),
        },
    )
    .await?;

    if model.items.is_empty() {
        return Ok(None);
    }

    Ok(Some(model))
}

#[cfg(test)]
mod tests {
    use crate::css_operator_console::composer;

    #[test]
    fn v169_case_console_composers_keep_risk_context_readable() {
        let profile = crate::css_reputation_engine::types::CssReputationProfile {
            user_id: "user_1".into(),
            score: 55,
            level: crate::css_reputation_engine::types::ReputationLevel::Watchlisted,
            penalties: vec![crate::css_reputation_engine::types::ReputationPenalty {
                kind: crate::css_reputation_engine::types::ReputationPenaltyKind::DisableAutoBid,
                starts_at: None,
                ends_at: None,
                reason: "risk".into(),
            }],
            violation_count: 2,
            updated_at: "2026-03-12T00:00:00Z".into(),
        };
        let view = composer::compose_reputation(&profile);
        assert_eq!(view.level, "watchlisted");
        assert_eq!(view.active_penalties, vec!["disableautobid"]);
    }
}
