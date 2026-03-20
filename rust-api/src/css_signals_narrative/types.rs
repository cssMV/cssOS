use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NarrativeSubjectKind {
    User,
    Catalog,
    Deal,
    Ownership,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NarrativePhase {
    Initial,
    Escalating,
    Restricted,
    Frozen,
    Recovering,
    Stable,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NarrativeMilestone {
    pub created_at: String,
    pub title: String,
    pub description: String,
    pub phase: NarrativePhase,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssSignalsNarrative {
    pub subject_kind: NarrativeSubjectKind,
    pub subject_id: String,
    pub summary: String,
    #[serde(default)]
    pub milestones: Vec<NarrativeMilestone>,
    pub current_assessment: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NarrativeRequest {
    pub subject_kind: NarrativeSubjectKind,
    pub subject_id: String,
}
