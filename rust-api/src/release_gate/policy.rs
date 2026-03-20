use crate::quality_director::types::ReleaseReadiness;
use crate::release_gate::types::{
    GateAction, GateDecision, GateReason, GateResult, ReleaseGateReport,
};

fn allow(action: GateAction) -> GateResult {
    GateResult {
        action,
        decision: GateDecision::Allow,
        reasons: vec![],
    }
}

fn deny(action: GateAction, code: &str, message: &str) -> GateResult {
    GateResult {
        action,
        decision: GateDecision::Deny,
        reasons: vec![GateReason {
            code: code.to_string(),
            message: message.to_string(),
        }],
    }
}

pub fn gate_internal_preview(readiness: &ReleaseReadiness) -> GateResult {
    match readiness {
        ReleaseReadiness::InternalOnly
        | ReleaseReadiness::PreviewReady
        | ReleaseReadiness::DemoReady
        | ReleaseReadiness::PromoReady
        | ReleaseReadiness::MarketReady => allow(GateAction::InternalPreview),
    }
}

pub fn gate_public_demo(readiness: &ReleaseReadiness) -> GateResult {
    match readiness {
        ReleaseReadiness::DemoReady
        | ReleaseReadiness::PromoReady
        | ReleaseReadiness::MarketReady => allow(GateAction::PublicDemo),
        _ => deny(
            GateAction::PublicDemo,
            "quality_below_demo",
            "当前质量等级未达到对外 Demo 要求。",
        ),
    }
}

pub fn gate_promo_publish(readiness: &ReleaseReadiness) -> GateResult {
    match readiness {
        ReleaseReadiness::PromoReady | ReleaseReadiness::MarketReady => {
            allow(GateAction::PromoPublish)
        }
        _ => deny(
            GateAction::PromoPublish,
            "quality_below_promo",
            "当前质量等级未达到宣发要求。",
        ),
    }
}

pub fn gate_market_list(readiness: &ReleaseReadiness) -> GateResult {
    match readiness {
        ReleaseReadiness::MarketReady => allow(GateAction::MarketList),
        _ => deny(
            GateAction::MarketList,
            "quality_below_market",
            "当前作品未达到 cssMARKET 上架要求。",
        ),
    }
}

pub fn gate_pricing_enable(readiness: &ReleaseReadiness) -> GateResult {
    match readiness {
        ReleaseReadiness::MarketReady => allow(GateAction::PricingEnable),
        _ => deny(
            GateAction::PricingEnable,
            "pricing_not_allowed",
            "当前作品尚未达到可定价要求。",
        ),
    }
}

pub fn gate_settlement_enable(readiness: &ReleaseReadiness) -> GateResult {
    match readiness {
        ReleaseReadiness::MarketReady => allow(GateAction::SettlementEnable),
        _ => deny(
            GateAction::SettlementEnable,
            "settlement_not_allowed",
            "当前作品尚未达到可结算要求。",
        ),
    }
}

pub fn build_release_gate_report(readiness: &ReleaseReadiness) -> ReleaseGateReport {
    ReleaseGateReport {
        internal_preview: gate_internal_preview(readiness),
        public_demo: gate_public_demo(readiness),
        promo_publish: gate_promo_publish(readiness),
        market_list: gate_market_list(readiness),
        pricing_enable: gate_pricing_enable(readiness),
        settlement_enable: gate_settlement_enable(readiness),
    }
}

#[cfg(test)]
mod tests {
    use crate::quality_director::types::ReleaseReadiness;
    use crate::release_gate::policy::build_release_gate_report;
    use crate::release_gate::types::GateDecision;

    #[test]
    fn v151_internal_only_denies_market_chain() {
        let report = build_release_gate_report(&ReleaseReadiness::InternalOnly);
        assert_eq!(report.internal_preview.decision, GateDecision::Allow);
        assert_eq!(report.public_demo.decision, GateDecision::Deny);
        assert_eq!(report.market_list.decision, GateDecision::Deny);
        assert_eq!(report.pricing_enable.decision, GateDecision::Deny);
        assert_eq!(report.settlement_enable.decision, GateDecision::Deny);
    }

    #[test]
    fn v151_demo_ready_allows_demo_but_not_market() {
        let report = build_release_gate_report(&ReleaseReadiness::DemoReady);
        assert_eq!(report.internal_preview.decision, GateDecision::Allow);
        assert_eq!(report.public_demo.decision, GateDecision::Allow);
        assert_eq!(report.promo_publish.decision, GateDecision::Deny);
        assert_eq!(report.market_list.decision, GateDecision::Deny);
    }

    #[test]
    fn v151_market_ready_allows_all_release_actions() {
        let report = build_release_gate_report(&ReleaseReadiness::MarketReady);
        assert_eq!(report.internal_preview.decision, GateDecision::Allow);
        assert_eq!(report.public_demo.decision, GateDecision::Allow);
        assert_eq!(report.promo_publish.decision, GateDecision::Allow);
        assert_eq!(report.market_list.decision, GateDecision::Allow);
        assert_eq!(report.pricing_enable.decision, GateDecision::Allow);
        assert_eq!(report.settlement_enable.decision, GateDecision::Allow);
    }
}
