use crate::css_review_queue::types::{ReviewDecisionKind, ReviewPriority, ReviewStatus};

pub fn priority_from_ts(action: &str, amount_cents: Option<i64>) -> ReviewPriority {
    if amount_cents.unwrap_or(0) >= 100_000 {
        return ReviewPriority::High;
    }

    if action.contains("ownership") || action.contains("finalize_deal") {
        return ReviewPriority::High;
    }

    ReviewPriority::Normal
}

pub fn can_transition(from: &ReviewStatus, to: &ReviewStatus) -> bool {
    matches!(
        (from, to),
        (ReviewStatus::Open, ReviewStatus::Assigned)
            | (ReviewStatus::Assigned, ReviewStatus::InReview)
            | (ReviewStatus::InReview, ReviewStatus::Approved)
            | (ReviewStatus::InReview, ReviewStatus::Rejected)
            | (ReviewStatus::InReview, ReviewStatus::Escalated)
            | (ReviewStatus::Approved, ReviewStatus::Closed)
            | (ReviewStatus::Rejected, ReviewStatus::Closed)
            | (ReviewStatus::Escalated, ReviewStatus::Closed)
    )
}

pub fn status_from_decision(decision: &ReviewDecisionKind) -> ReviewStatus {
    match decision {
        ReviewDecisionKind::Approve => ReviewStatus::Approved,
        ReviewDecisionKind::Reject => ReviewStatus::Rejected,
        ReviewDecisionKind::Freeze | ReviewDecisionKind::Escalate => ReviewStatus::Escalated,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v168_high_value_and_deal_actions_get_high_priority() {
        assert_eq!(
            priority_from_ts("finalize_deal", Some(10)),
            ReviewPriority::High
        );
        assert_eq!(
            priority_from_ts("submit_bid", Some(100_000)),
            ReviewPriority::High
        );
        assert_eq!(
            priority_from_ts("submit_bid", Some(10)),
            ReviewPriority::Normal
        );
    }

    #[test]
    fn v168_review_status_transitions_are_constrained() {
        assert!(can_transition(&ReviewStatus::Open, &ReviewStatus::Assigned));
        assert!(can_transition(
            &ReviewStatus::InReview,
            &ReviewStatus::Escalated
        ));
        assert!(!can_transition(
            &ReviewStatus::Open,
            &ReviewStatus::Approved
        ));
        assert!(!can_transition(
            &ReviewStatus::Assigned,
            &ReviewStatus::Closed
        ));
    }

    #[test]
    fn v168_decisions_map_to_expected_terminal_states() {
        assert_eq!(
            status_from_decision(&ReviewDecisionKind::Approve),
            ReviewStatus::Approved
        );
        assert_eq!(
            status_from_decision(&ReviewDecisionKind::Reject),
            ReviewStatus::Rejected
        );
        assert_eq!(
            status_from_decision(&ReviewDecisionKind::Freeze),
            ReviewStatus::Escalated
        );
    }
}
