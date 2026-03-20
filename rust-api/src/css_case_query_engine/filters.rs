use crate::css_case_query_engine::types::{
    CaseQueryRiskLevel, CaseQueryRow, CaseQueryStatusKind, CaseQuerySubjectKind,
};

pub fn status_matches(row: &CaseQueryRow, status: &CaseQueryStatusKind) -> bool {
    &row.status == status
}

pub fn subject_kind_matches(row: &CaseQueryRow, kind: &CaseQuerySubjectKind) -> bool {
    &row.subject_kind == kind
}

pub fn risk_level_matches(row: &CaseQueryRow, level: &CaseQueryRiskLevel) -> bool {
    row.risk_level.as_ref() == Some(level)
}

pub fn bool_matches(actual: bool, expected: Option<bool>) -> bool {
    match expected {
        Some(value) => actual == value,
        None => true,
    }
}

pub fn actor_matches(row: &CaseQueryRow, actor_user_id: &str) -> bool {
    row.actor_user_id.as_deref() == Some(actor_user_id)
}
