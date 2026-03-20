use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RiskSubjectKind {
    User,
    Catalog,
    Deal,
    Ownership,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum RiskSeverity {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RiskSourceKind {
    LowCredit,
    ActivePenalty,
    TooManyOpenDisputes,
    ReviewRequired,
    HighValueDeal,
    OwnerBehaviorAnomaly,
    SelfBiddingAttempt,
    SelfAutoBidAttempt,
    SuspiciousPriceManipulation,
    RestrictedByModeration,
    FrozenByGovernance,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskFactorItem {
    pub source_kind: RiskSourceKind,
    pub severity: RiskSeverity,
    pub title: String,
    pub explanation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserRiskView {
    pub user_id: String,

    #[serde(default)]
    pub overall_high_risk: bool,

    #[serde(default)]
    pub overall_review_required: bool,

    #[serde(default)]
    pub factors: Vec<RiskFactorItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatalogRiskView {
    pub catalog_id: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_user_id: Option<String>,

    #[serde(default)]
    pub overall_high_risk: bool,

    #[serde(default)]
    pub overall_review_required: bool,

    #[serde(default)]
    pub factors: Vec<RiskFactorItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DealRiskView {
    pub deal_id: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub buyer_user_id: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub seller_user_id: Option<String>,

    #[serde(default)]
    pub overall_high_risk: bool,

    #[serde(default)]
    pub overall_review_required: bool,

    #[serde(default)]
    pub factors: Vec<RiskFactorItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OwnershipRiskView {
    pub ownership_id: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_user_id: Option<String>,

    #[serde(default)]
    pub overall_high_risk: bool,

    #[serde(default)]
    pub overall_review_required: bool,

    #[serde(default)]
    pub factors: Vec<RiskFactorItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskResponse<T> {
    pub subject_kind: RiskSubjectKind,
    pub data: T,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetUserRiskRequest {
    pub user_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCatalogRiskRequest {
    pub catalog_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetDealRiskRequest {
    pub deal_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetOwnershipRiskRequest {
    pub ownership_id: String,
}
