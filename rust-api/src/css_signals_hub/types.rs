use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SignalSubjectKind {
    User,
    Catalog,
    Deal,
    Ownership,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum SignalSeverity {
    Info,
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum SignalKind {
    CreditLow,
    CreditHighRisk,
    CreditRestricted,
    ActivePenalty,
    OpenDisputes,
    ReviewRequired,
    Frozen,
    Restricted,
    OwnerBehaviorAnomaly,
    SelfBiddingViolation,
    SelfAutoBidViolation,
    SuspiciousPriceManipulation,
    HighValueDeal,
    RuleMatched,
    TimelineRiskEvent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssSignal {
    pub signal_kind: SignalKind,
    pub severity: SignalSeverity,
    pub title: String,
    pub description: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_system: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignalsBundle {
    pub subject_kind: SignalSubjectKind,
    pub subject_id: String,

    #[serde(default)]
    pub signals: Vec<CssSignal>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetSignalsRequest {
    pub subject_kind: SignalSubjectKind,
    pub subject_id: String,
}
