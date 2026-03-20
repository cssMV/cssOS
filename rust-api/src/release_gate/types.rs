use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GateAction {
    InternalPreview,
    PublicDemo,
    PromoPublish,
    MarketList,
    PricingEnable,
    SettlementEnable,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GateDecision {
    Allow,
    Deny,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GateReason {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GateResult {
    pub action: GateAction,
    pub decision: GateDecision,
    #[serde(default)]
    pub reasons: Vec<GateReason>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ReleaseGateReport {
    pub internal_preview: GateResult,
    pub public_demo: GateResult,
    pub promo_publish: GateResult,
    pub market_list: GateResult,
    pub pricing_enable: GateResult,
    pub settlement_enable: GateResult,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MarketPublishRequest {
    pub run_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub price_cents: Option<i64>,
}
