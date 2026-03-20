use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DealIntentStatus {
    Pending,
    Selected,
    Rejected,
    Expired,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DealIntent {
    pub intent_id: String,
    pub ownership_id: String,
    pub seller_user_id: String,
    pub buyer_user_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offered_price_cents: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    pub status: DealIntentStatus,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DealStatus {
    PendingSelection,
    LockedForBuyer,
    AwaitingPayment,
    Paid,
    OwnershipTransferred,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CssDeal {
    pub deal_id: String,
    pub ownership_id: String,
    pub seller_user_id: String,
    pub buyer_user_id: String,
    pub intent_id: String,
    pub price_cents: i64,
    pub currency: String,
    pub status: DealStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payment_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SellerSelectionRequest {
    pub ownership_id: String,
    pub seller_user_id: String,
    pub selected_intent_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DealDecisionResult {
    pub allowed: bool,
    pub code: String,
    pub message: String,
}
