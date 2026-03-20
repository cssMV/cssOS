use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseSummarySubjectKind {
    User,
    Catalog,
    Deal,
    Ownership,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseSummaryView {
    pub case_id: String,
    pub subject_kind: CaseSummarySubjectKind,
    pub subject_id: String,
    pub one_line: String,
    #[serde(default)]
    pub three_lines: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseSummaryRequest {
    pub case_id: String,
    pub subject_kind: CaseSummarySubjectKind,
    pub subject_id: String,
}
