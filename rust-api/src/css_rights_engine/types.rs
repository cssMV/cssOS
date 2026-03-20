use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RightsWorkStructure {
    Single,
    Trilogy,
    Opera,
    Anthology,
    Series,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RightsUnit {
    WholeWork,
    Part,
    Act,
    Scene,
    VersionBundle,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RightsGrantKind {
    Listen,
    Preview,
    Stream,
    Purchase,
    Buyout,
    License,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RightsLanguageScope {
    pub lang: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RightsTarget {
    pub work_structure: RightsWorkStructure,
    pub unit: RightsUnit,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unit_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lang: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RightsGrant {
    pub grant_id: String,
    pub kind: RightsGrantKind,
    pub target: RightsTarget,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RightsDecision {
    Allow,
    Deny,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RightsDecisionResult {
    pub decision: RightsDecision,
    pub code: String,
    pub message: String,
}
