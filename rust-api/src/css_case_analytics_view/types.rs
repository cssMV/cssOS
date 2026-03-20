use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum AnalyticsSubjectKind {
    User,
    Catalog,
    Deal,
    Ownership,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum AnalyticsResolutionKind {
    Resolved,
    Dismissed,
    Released,
    EscalatedToManual,
    FrozenUntilReview,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum AnalyticsRiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyticsBucket {
    pub key: String,
    pub label: String,
    pub count: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ratio: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub avg_seconds: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseAnalyticsView {
    #[serde(default)]
    pub most_frozen_subjects: Vec<AnalyticsBucket>,
    #[serde(default)]
    pub most_escalated_subjects: Vec<AnalyticsBucket>,
    #[serde(default)]
    pub longest_resolution_subjects: Vec<AnalyticsBucket>,
    #[serde(default)]
    pub risk_to_resolution_outcomes: Vec<AnalyticsBucket>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CaseAnalyticsRequest {}
