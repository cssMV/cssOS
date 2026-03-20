use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TrustSubjectKind {
    User,
    Catalog,
    Deal,
    Ownership,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TrustRiskLevel {
    Normal,
    LowCreditWarning,
    HighRisk,
    Restricted,
    Frozen,
    ReviewRequired,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrustPenaltyView {
    pub kind: String,
    pub reason: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ends_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserTrustView {
    pub user_id: String,
    pub credit_score: i32,

    #[serde(default)]
    pub low_credit_warning: bool,

    #[serde(default)]
    pub high_risk: bool,

    #[serde(default)]
    pub review_required: bool,

    #[serde(default)]
    pub restricted: bool,

    #[serde(default)]
    pub frozen: bool,

    #[serde(default)]
    pub active_penalties: Vec<TrustPenaltyView>,

    #[serde(default)]
    pub open_dispute_count: i32,

    pub risk_level: TrustRiskLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatalogTrustView {
    pub catalog_id: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_user_id: Option<String>,

    #[serde(default)]
    pub owner_low_credit_warning: bool,

    #[serde(default)]
    pub owner_high_risk: bool,

    #[serde(default)]
    pub review_required: bool,

    #[serde(default)]
    pub frozen: bool,

    pub risk_level: TrustRiskLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DealTrustView {
    pub deal_id: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub buyer_user_id: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub seller_user_id: Option<String>,

    #[serde(default)]
    pub review_required: bool,

    #[serde(default)]
    pub high_risk: bool,

    #[serde(default)]
    pub frozen: bool,

    pub risk_level: TrustRiskLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OwnershipTrustView {
    pub ownership_id: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_user_id: Option<String>,

    #[serde(default)]
    pub owner_low_credit_warning: bool,

    #[serde(default)]
    pub owner_high_risk: bool,

    #[serde(default)]
    pub restricted: bool,

    pub risk_level: TrustRiskLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrustResponse<T> {
    pub subject_kind: TrustSubjectKind,
    pub data: T,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetUserTrustRequest {
    pub user_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCatalogTrustRequest {
    pub catalog_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetDealTrustRequest {
    pub deal_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetOwnershipTrustRequest {
    pub ownership_id: String,
}
