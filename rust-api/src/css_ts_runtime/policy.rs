use crate::css_ts_runtime::types::{
    TsActionKind, TsDecisionKind, TsRuntimeContext, TsRuntimeDecision,
};

pub fn is_high_value_trade(amount_cents: Option<i64>) -> bool {
    amount_cents.unwrap_or(0) >= crate::css_policy_engine::runtime::high_value_trade_cents()
}

pub fn derive_decision(
    action: &TsActionKind,
    ctx: &TsRuntimeContext,
    amount_cents: Option<i64>,
) -> TsRuntimeDecision {
    let mut reasons = Vec::new();

    if ctx.has_active_penalty {
        reasons.push("用户存在生效中的处罚。".into());
    }
    if ctx.open_dispute_count > 0 {
        reasons.push(format!(
            "用户当前存在 {} 个未关闭争议。",
            ctx.open_dispute_count
        ));
    }

    if ctx.reputation_score < 20 {
        reasons.push("用户信誉分极低。".into());
        return TsRuntimeDecision {
            decision: TsDecisionKind::Freeze,
            code: "ts_frozen_low_reputation".into(),
            message: "当前动作已被冻结，需人工处理。".into(),
            reasons,
        };
    }

    if ctx.has_active_penalty {
        match action {
            TsActionKind::CreateAuction
            | TsActionKind::ParticipateAuction
            | TsActionKind::EnableAutoBid
            | TsActionKind::SubmitBid => {
                return TsRuntimeDecision {
                    decision: TsDecisionKind::Restrict,
                    code: "ts_restricted_active_penalty".into(),
                    message: "当前动作受限。".into(),
                    reasons,
                };
            }
            _ => {}
        }
    }

    if is_high_value_trade(amount_cents) {
        reasons.push("命中高额交易阈值。".into());
        return TsRuntimeDecision {
            decision: TsDecisionKind::ReviewRequired,
            code: "ts_review_high_value_trade".into(),
            message: "该动作需人工复核后继续。".into(),
            reasons,
        };
    }

    if ctx.open_dispute_count >= 3 || ctx.violation_count >= 3 {
        reasons.push("争议/违规累计偏高。".into());
        return TsRuntimeDecision {
            decision: TsDecisionKind::ReviewRequired,
            code: "ts_review_risk_accumulated".into(),
            message: "当前动作需进一步复核。".into(),
            reasons,
        };
    }

    TsRuntimeDecision {
        decision: TsDecisionKind::Allow,
        code: "ts_allow".into(),
        message: "当前动作可继续。".into(),
        reasons,
    }
}

pub fn direct_block_self_bidding() -> TsRuntimeDecision {
    TsRuntimeDecision {
        decision: TsDecisionKind::Restrict,
        code: "ts_block_self_bidding".into(),
        message: "当前 owner 禁止参与自己作品竞拍。".into(),
        reasons: vec!["命中平台反操纵规则：禁止自卖自买。".into()],
    }
}

#[cfg(test)]
mod tests {
    use crate::css_ts_runtime::policy::{
        derive_decision, direct_block_self_bidding, is_high_value_trade,
    };
    use crate::css_ts_runtime::types::{TsActionKind, TsDecisionKind, TsRuntimeContext};

    #[test]
    fn v167_high_value_trade_requires_review() {
        let decision = derive_decision(
            &TsActionKind::FinalizeDeal,
            &TsRuntimeContext {
                reputation_score: 100,
                ..Default::default()
            },
            Some(150_000),
        );
        assert_eq!(decision.decision, TsDecisionKind::ReviewRequired);
    }

    #[test]
    fn v167_active_penalty_restricts_live_auction_actions() {
        let decision = derive_decision(
            &TsActionKind::SubmitBid,
            &TsRuntimeContext {
                reputation_score: 100,
                has_active_penalty: true,
                ..Default::default()
            },
            Some(500),
        );
        assert_eq!(decision.decision, TsDecisionKind::Restrict);
    }

    #[test]
    fn v167_self_bidding_is_directly_blocked() {
        assert!(is_high_value_trade(Some(100_000)));
        let decision = direct_block_self_bidding();
        assert_eq!(decision.decision, TsDecisionKind::Restrict);
    }
}
