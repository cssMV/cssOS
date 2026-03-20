use crate::css_resolution_engine::types::{ResolutionDecisionKind, ResolutionStatus};

pub fn decision_to_status(decision: &ResolutionDecisionKind) -> ResolutionStatus {
    match decision {
        ResolutionDecisionKind::Resolve => ResolutionStatus::Resolved,
        ResolutionDecisionKind::Dismiss => ResolutionStatus::Dismissed,
        ResolutionDecisionKind::Release => ResolutionStatus::Released,
        ResolutionDecisionKind::EscalateToManual => ResolutionStatus::EscalatedToManual,
        ResolutionDecisionKind::FreezeUntilReview => ResolutionStatus::FrozenUntilReview,
    }
}

pub fn is_closed_like(status: &ResolutionStatus) -> bool {
    matches!(
        status,
        ResolutionStatus::Resolved | ResolutionStatus::Dismissed | ResolutionStatus::Released
    )
}

pub fn default_message(status: &ResolutionStatus) -> String {
    match status {
        ResolutionStatus::Open => "案件仍处理中。".into(),
        ResolutionStatus::Resolved => "案件已正式解决。".into(),
        ResolutionStatus::Dismissed => "案件已驳回。".into(),
        ResolutionStatus::Released => "案件相关限制已释放。".into(),
        ResolutionStatus::EscalatedToManual => "案件已升级至人工处理流程。".into(),
        ResolutionStatus::FrozenUntilReview => "案件已冻结，等待后续复核。".into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v195_escalated_and_frozen_are_not_closed_like() {
        assert!(!is_closed_like(&ResolutionStatus::EscalatedToManual));
        assert!(!is_closed_like(&ResolutionStatus::FrozenUntilReview));
    }
}
