use crate::css_moderation_engine::types::{
    ModerationAction, ModerationContext, ModerationDecision, ModerationLevel,
};

pub fn derive_level(ctx: &ModerationContext) -> ModerationLevel {
    if ctx.open_dispute_count >= 3 || ctx.reputation_score < 20 {
        return ModerationLevel::Frozen;
    }
    if ctx.has_active_penalty || ctx.reputation_score < 50 {
        return ModerationLevel::Restricted;
    }
    if ctx.open_dispute_count > 0 || ctx.reputation_violation_count > 0 || ctx.reputation_score < 70
    {
        return ModerationLevel::Observe;
    }
    ModerationLevel::Clean
}

pub fn action_for_user_level(level: &ModerationLevel) -> ModerationAction {
    match level {
        ModerationLevel::Clean => ModerationAction::None,
        ModerationLevel::Observe => ModerationAction::ObserveOnly,
        ModerationLevel::Restricted => ModerationAction::RestrictAuctionParticipation,
        ModerationLevel::Frozen => ModerationAction::RequireManualReview,
        ModerationLevel::ReviewRequired => ModerationAction::RequireManualReview,
    }
}

pub fn action_for_catalog_level(level: &ModerationLevel) -> ModerationAction {
    match level {
        ModerationLevel::Clean => ModerationAction::None,
        ModerationLevel::Observe => ModerationAction::ObserveOnly,
        ModerationLevel::Restricted => ModerationAction::RequireManualReview,
        ModerationLevel::Frozen => ModerationAction::FreezeAuction,
        ModerationLevel::ReviewRequired => ModerationAction::RequireManualReview,
    }
}

pub fn moderation_for_self_bidding_owner() -> ModerationDecision {
    ModerationDecision {
        allowed: false,
        level: ModerationLevel::Restricted,
        action: ModerationAction::RestrictAuctionCreation,
        code: "owner_self_bidding_violation".into(),
        message: "当前 owner 参与自己作品竞拍，属违规；拍卖可继续，但 owner 将被限制并记录在案。"
            .into(),
    }
}

#[cfg(test)]
mod tests {
    use crate::css_moderation_engine::policy::{
        action_for_catalog_level, action_for_user_level, derive_level,
        moderation_for_self_bidding_owner,
    };
    use crate::css_moderation_engine::types::{
        ModerationAction, ModerationContext, ModerationLevel,
    };

    #[test]
    fn v166_context_escalates_to_frozen_for_heavy_risk() {
        let ctx = ModerationContext {
            open_dispute_count: 3,
            reputation_score: 15,
            reputation_violation_count: 4,
            has_active_penalty: true,
        };
        assert_eq!(derive_level(&ctx), ModerationLevel::Frozen);
    }

    #[test]
    fn v166_user_and_catalog_actions_follow_level() {
        assert_eq!(
            action_for_user_level(&ModerationLevel::Restricted),
            ModerationAction::RestrictAuctionParticipation
        );
        assert_eq!(
            action_for_catalog_level(&ModerationLevel::Frozen),
            ModerationAction::FreezeAuction
        );
    }

    #[test]
    fn v166_self_bidding_owner_maps_to_restricted_creation_block() {
        let decision = moderation_for_self_bidding_owner();
        assert!(!decision.allowed);
        assert_eq!(decision.level, ModerationLevel::Restricted);
        assert_eq!(decision.action, ModerationAction::RestrictAuctionCreation);
    }
}
