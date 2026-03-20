use crate::css_reputation_engine::types::{
    CssReputationProfile, ReputationDecision, ReputationLevel, ReputationPenalty,
    ReputationPenaltyKind, ReputationViolationKind,
};

pub const DEFAULT_REPUTATION_SCORE: i32 = 100;

pub fn violation_score_delta(kind: &ReputationViolationKind) -> i32 {
    match kind {
        ReputationViolationKind::SelfBidding => -20,
        ReputationViolationKind::SelfAutoBidding => -25,
        ReputationViolationKind::SuspiciousPriceManipulation => -30,
        ReputationViolationKind::AuctionDisruption => -15,
        ReputationViolationKind::OwnershipAbuse => -20,
    }
}

pub fn level_from_score(score: i32) -> ReputationLevel {
    if score >= 90 {
        ReputationLevel::Trusted
    } else if score >= 70 {
        ReputationLevel::Normal
    } else if score >= 50 {
        ReputationLevel::Watchlisted
    } else if score >= 20 {
        ReputationLevel::Restricted
    } else {
        ReputationLevel::Suspended
    }
}

fn ends_at_after_days(now_rfc3339: &str, days: i64) -> Option<String> {
    chrono::DateTime::parse_from_rfc3339(now_rfc3339)
        .ok()
        .map(|dt| (dt + chrono::Duration::days(days)).to_rfc3339())
}

pub fn penalties_for_self_bidding(
    violation_count: i32,
    now_rfc3339: &str,
) -> Vec<ReputationPenalty> {
    if violation_count <= 1 {
        return vec![
            ReputationPenalty {
                kind: ReputationPenaltyKind::WarningOnly,
                starts_at: Some(now_rfc3339.to_string()),
                ends_at: None,
                reason: "禁止参与自己作品竞拍，已记录警告。".into(),
            },
            ReputationPenalty {
                kind: ReputationPenaltyKind::DisableOwnAuctionCreation,
                starts_at: Some(now_rfc3339.to_string()),
                ends_at: ends_at_after_days(now_rfc3339, 7),
                reason: "一段时间内禁止拍卖自己的作品。".into(),
            },
        ];
    }

    if violation_count == 2 {
        return vec![
            ReputationPenalty {
                kind: ReputationPenaltyKind::DisableOwnAuctionCreation,
                starts_at: Some(now_rfc3339.to_string()),
                ends_at: ends_at_after_days(now_rfc3339, 14),
                reason: "重复违规：两周内禁止拍卖自己的作品。".into(),
            },
            ReputationPenalty {
                kind: ReputationPenaltyKind::DisableAuctionParticipation,
                starts_at: Some(now_rfc3339.to_string()),
                ends_at: ends_at_after_days(now_rfc3339, 14),
                reason: "重复违规：两周内禁止参与任何竞拍。".into(),
            },
        ];
    }

    vec![
        ReputationPenalty {
            kind: ReputationPenaltyKind::DisableOwnAuctionCreation,
            starts_at: Some(now_rfc3339.to_string()),
            ends_at: ends_at_after_days(now_rfc3339, 30),
            reason: "多次违规：30天内禁止拍卖自己的作品。".into(),
        },
        ReputationPenalty {
            kind: ReputationPenaltyKind::DisableAuctionParticipation,
            starts_at: Some(now_rfc3339.to_string()),
            ends_at: ends_at_after_days(now_rfc3339, 30),
            reason: "多次违规：30天内禁止参与任何竞拍。".into(),
        },
        ReputationPenalty {
            kind: ReputationPenaltyKind::DisableAutoBid,
            starts_at: Some(now_rfc3339.to_string()),
            ends_at: ends_at_after_days(now_rfc3339, 30),
            reason: "多次违规：30天内禁止使用自动代拍。".into(),
        },
    ]
}

pub fn can_create_auction(profile: &CssReputationProfile) -> ReputationDecision {
    let blocked = profile
        .penalties
        .iter()
        .any(|p| matches!(p.kind, ReputationPenaltyKind::DisableOwnAuctionCreation));

    if blocked {
        return ReputationDecision {
            allowed: false,
            code: "auction_creation_restricted".into(),
            message: "当前用户处于拍卖创建限制期，不能拍卖自己的作品。".into(),
            level: Some(profile.level.clone()),
        };
    }

    ReputationDecision {
        allowed: true,
        code: "auction_creation_allowed".into(),
        message: "允许创建拍卖。".into(),
        level: Some(profile.level.clone()),
    }
}

pub fn can_participate_in_auction(profile: &CssReputationProfile) -> ReputationDecision {
    let blocked = profile
        .penalties
        .iter()
        .any(|p| matches!(p.kind, ReputationPenaltyKind::DisableAuctionParticipation));

    if blocked {
        return ReputationDecision {
            allowed: false,
            code: "auction_participation_restricted".into(),
            message: "当前用户处于竞拍参与限制期，不能参与他人作品竞拍。".into(),
            level: Some(profile.level.clone()),
        };
    }

    ReputationDecision {
        allowed: true,
        code: "auction_participation_allowed".into(),
        message: "允许参与竞拍。".into(),
        level: Some(profile.level.clone()),
    }
}

pub fn can_use_auto_bid(profile: &CssReputationProfile) -> ReputationDecision {
    let blocked = profile
        .penalties
        .iter()
        .any(|p| matches!(p.kind, ReputationPenaltyKind::DisableAutoBid));

    if blocked {
        return ReputationDecision {
            allowed: false,
            code: "auto_bid_restricted".into(),
            message: "当前用户处于自动代拍限制期，不能启用自动代拍。".into(),
            level: Some(profile.level.clone()),
        };
    }

    ReputationDecision {
        allowed: true,
        code: "auto_bid_allowed".into(),
        message: "允许启用自动代拍。".into(),
        level: Some(profile.level.clone()),
    }
}

#[cfg(test)]
mod tests {
    use crate::css_reputation_engine::policy::{
        can_create_auction, can_use_auto_bid, level_from_score, penalties_for_self_bidding,
        violation_score_delta,
    };
    use crate::css_reputation_engine::types::{
        CssReputationProfile, ReputationLevel, ReputationPenalty, ReputationPenaltyKind,
        ReputationViolationKind,
    };

    #[test]
    fn v165_self_bidding_penalties_escalate() {
        let first = penalties_for_self_bidding(1, "2026-03-12T00:00:00Z");
        assert!(first
            .iter()
            .any(|p| matches!(p.kind, ReputationPenaltyKind::WarningOnly)));
        let third = penalties_for_self_bidding(3, "2026-03-12T00:00:00Z");
        assert!(third
            .iter()
            .any(|p| matches!(p.kind, ReputationPenaltyKind::DisableAutoBid)));
    }

    #[test]
    fn v165_score_maps_to_reputation_levels() {
        assert_eq!(
            violation_score_delta(&ReputationViolationKind::SelfBidding),
            -20
        );
        assert_eq!(level_from_score(95), ReputationLevel::Trusted);
        assert_eq!(level_from_score(45), ReputationLevel::Restricted);
    }

    #[test]
    fn v165_penalties_gate_auction_and_auto_bid_actions() {
        let profile = CssReputationProfile {
            user_id: "owner".into(),
            score: 40,
            level: ReputationLevel::Restricted,
            penalties: vec![
                ReputationPenalty {
                    kind: ReputationPenaltyKind::DisableOwnAuctionCreation,
                    starts_at: Some("2026-03-12T00:00:00Z".into()),
                    ends_at: Some("2026-03-19T00:00:00Z".into()),
                    reason: "cooldown".into(),
                },
                ReputationPenalty {
                    kind: ReputationPenaltyKind::DisableAutoBid,
                    starts_at: Some("2026-03-12T00:00:00Z".into()),
                    ends_at: Some("2026-03-19T00:00:00Z".into()),
                    reason: "cooldown".into(),
                },
            ],
            violation_count: 2,
            updated_at: "2026-03-12T00:00:00Z".into(),
        };

        assert!(!can_create_auction(&profile).allowed);
        assert!(!can_use_auto_bid(&profile).allowed);
    }
}
