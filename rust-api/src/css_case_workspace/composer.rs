use crate::css_case_workspace::types::{
    CaseBasicInfo, CaseWorkspaceRequest, CaseWorkspaceSubjectKind,
};

pub fn to_trust_subject_kind(
    kind: &CaseWorkspaceSubjectKind,
) -> crate::css_trust_api::types::TrustSubjectKind {
    match kind {
        CaseWorkspaceSubjectKind::User => crate::css_trust_api::types::TrustSubjectKind::User,
        CaseWorkspaceSubjectKind::Catalog => crate::css_trust_api::types::TrustSubjectKind::Catalog,
        CaseWorkspaceSubjectKind::Deal => crate::css_trust_api::types::TrustSubjectKind::Deal,
        CaseWorkspaceSubjectKind::Ownership => {
            crate::css_trust_api::types::TrustSubjectKind::Ownership
        }
    }
}

pub fn build_basic_info(req: &CaseWorkspaceRequest) -> CaseBasicInfo {
    CaseBasicInfo {
        case_id: format!(
            "case:{}:{}",
            format!("{:?}", req.subject_kind).to_lowercase(),
            req.subject_id
        ),
        subject_kind: req.subject_kind.clone(),
        subject_id: req.subject_id.clone(),
        title: format!(
            "{} case: {}",
            format!("{:?}", req.subject_kind).to_lowercase(),
            req.subject_id
        ),
        summary: "案件工作区聚合视图".into(),
        review_id: req.review_id.clone(),
        audit_id: req.audit_id.clone(),
        dispute_id: req.dispute_id.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v189_basic_info_includes_subject_identity() {
        let basic = build_basic_info(&CaseWorkspaceRequest {
            subject_kind: CaseWorkspaceSubjectKind::Deal,
            subject_id: "deal_001".into(),
            review_id: Some("rev_001".into()),
            audit_id: None,
            dispute_id: None,
        });

        assert_eq!(basic.case_id, "case:deal:deal_001");
        assert_eq!(basic.title, "deal case: deal_001");
        assert_eq!(basic.review_id.as_deref(), Some("rev_001"));
    }
}
