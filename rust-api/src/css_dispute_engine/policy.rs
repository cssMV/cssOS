use crate::css_dispute_engine::types::{DisputeDecision, DisputeKind, DisputeSeverity};

pub fn owner_cannot_bid_on_own_catalog(
    owner_user_id: &str,
    bidder_user_id: &str,
) -> DisputeDecision {
    if owner_user_id == bidder_user_id {
        return DisputeDecision {
            allowed: false,
            code: "self_bidding_forbidden".into(),
            message: "版权持有者禁止参与自己作品的竞拍。".into(),
            dispute_kind: Some(DisputeKind::SelfBidding),
            severity: Some(DisputeSeverity::Critical),
        };
    }

    DisputeDecision {
        allowed: true,
        code: "bidder_allowed".into(),
        message: "允许参与竞拍。".into(),
        dispute_kind: None,
        severity: None,
    }
}

pub fn owner_cannot_auto_bid_on_own_catalog(
    owner_user_id: &str,
    bidder_user_id: &str,
) -> DisputeDecision {
    if owner_user_id == bidder_user_id {
        return DisputeDecision {
            allowed: false,
            code: "self_auto_bid_forbidden".into(),
            message: "版权持有者禁止对自己作品启用自动代拍。".into(),
            dispute_kind: Some(DisputeKind::SelfAutoBidding),
            severity: Some(DisputeSeverity::Critical),
        };
    }

    DisputeDecision {
        allowed: true,
        code: "auto_bidder_allowed".into(),
        message: "允许启用自动代拍。".into(),
        dispute_kind: None,
        severity: None,
    }
}

pub fn critical_dispute_should_freeze() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use crate::css_dispute_engine::policy::{
        critical_dispute_should_freeze, owner_cannot_auto_bid_on_own_catalog,
        owner_cannot_bid_on_own_catalog,
    };
    use crate::css_dispute_engine::types::{DisputeKind, DisputeSeverity};

    #[test]
    fn v164_owner_is_forbidden_from_manual_bidding_on_own_catalog() {
        let decision = owner_cannot_bid_on_own_catalog("owner_a", "owner_a");
        assert!(!decision.allowed);
        assert_eq!(decision.dispute_kind, Some(DisputeKind::SelfBidding));
        assert_eq!(decision.severity, Some(DisputeSeverity::Critical));
    }

    #[test]
    fn v164_owner_is_forbidden_from_auto_bidding_on_own_catalog() {
        let decision = owner_cannot_auto_bid_on_own_catalog("owner_a", "owner_a");
        assert!(!decision.allowed);
        assert_eq!(decision.dispute_kind, Some(DisputeKind::SelfAutoBidding));
        assert_eq!(decision.severity, Some(DisputeSeverity::Critical));
        assert!(critical_dispute_should_freeze());
    }
}
