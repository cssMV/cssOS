use crate::css_operator_console::types::{
    ConsoleBidLedgerView, ConsoleDisputeView, ConsoleModerationView, ConsoleQueueItem,
    ConsoleReputationView,
};

pub fn compose_queue_item(
    item: &crate::css_review_queue::types::CssReviewItem,
) -> ConsoleQueueItem {
    ConsoleQueueItem {
        review_id: item.review_id.clone(),
        subject_kind: format!("{:?}", item.subject_kind).to_lowercase(),
        subject_id: item.subject_id.clone(),
        priority: format!("{:?}", item.priority).to_lowercase(),
        status: format!("{:?}", item.status).to_lowercase(),
        source_action: item.source_action.clone(),
        source_code: item.source_code.clone(),
        reason: item.reason.clone(),
        actor_user_id: item.actor_user_id.clone(),
        assigned_reviewer_id: item.assigned_reviewer_id.clone(),
        created_at: item.created_at.clone(),
    }
}

pub fn compose_reputation(
    profile: &crate::css_reputation_engine::types::CssReputationProfile,
) -> ConsoleReputationView {
    ConsoleReputationView {
        user_id: profile.user_id.clone(),
        score: profile.score,
        level: format!("{:?}", profile.level).to_lowercase(),
        violation_count: profile.violation_count,
        active_penalties: profile
            .penalties
            .iter()
            .map(|penalty| format!("{:?}", penalty.kind).to_lowercase())
            .collect(),
    }
}

pub fn compose_dispute(
    dispute: &crate::css_dispute_engine::types::CssDisputeCase,
) -> ConsoleDisputeView {
    ConsoleDisputeView {
        dispute_id: dispute.dispute_id.clone(),
        kind: format!("{:?}", dispute.kind).to_lowercase(),
        severity: format!("{:?}", dispute.severity).to_lowercase(),
        status: format!("{:?}", dispute.status).to_lowercase(),
        message: dispute.message.clone(),
        created_at: dispute.created_at.clone(),
    }
}

pub fn compose_moderation(
    moderation: &crate::css_moderation_engine::types::CssModerationCase,
) -> ConsoleModerationView {
    ConsoleModerationView {
        moderation_id: moderation.moderation_id.clone(),
        subject_kind: format!("{:?}", moderation.subject_kind).to_lowercase(),
        subject_id: moderation.subject_id.clone(),
        level: format!("{:?}", moderation.level).to_lowercase(),
        action: format!("{:?}", moderation.action).to_lowercase(),
        reason: moderation.reason.clone(),
        created_at: moderation.created_at.clone(),
    }
}

pub fn compose_bid_ledger(
    ledger: &crate::css_bid_ledger::types::LedgerSnapshot,
) -> ConsoleBidLedgerView {
    ConsoleBidLedgerView {
        total_entries: ledger.total_entries,
        current_leader_user_id: ledger.current_leader_user_id.clone(),
        current_price_cents: ledger.current_price_cents,
        finalized: ledger.finalized,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v169_queue_item_composer_flattens_review_item() {
        let item = crate::css_review_queue::types::CssReviewItem {
            review_id: "rev_1".into(),
            subject_kind: crate::css_review_queue::types::ReviewSubjectKind::Deal,
            subject_id: "deal_1".into(),
            priority: crate::css_review_queue::types::ReviewPriority::High,
            status: crate::css_review_queue::types::ReviewStatus::Open,
            source_action: "finalize_deal".into(),
            source_code: "ts_review_high_value_trade".into(),
            reason: "manual review".into(),
            actor_user_id: Some("user_1".into()),
            assigned_reviewer_id: None,
            created_at: "2026-03-12T00:00:00Z".into(),
        };
        let view = compose_queue_item(&item);
        assert_eq!(view.review_id, "rev_1");
        assert_eq!(view.subject_kind, "deal");
        assert_eq!(view.priority, "high");
    }
}
