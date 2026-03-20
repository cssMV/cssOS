use crate::css_case_timeline_explain::types::{
    CaseTimelineExplainRequest, CaseTimelineExplainSubjectKind, CssCaseTimelineExplainView,
};

fn to_merge_subject_kind(
    kind: &CaseTimelineExplainSubjectKind,
) -> crate::css_case_timeline_merge::types::CaseTimelineSubjectKind {
    match kind {
        CaseTimelineExplainSubjectKind::User => {
            crate::css_case_timeline_merge::types::CaseTimelineSubjectKind::User
        }
        CaseTimelineExplainSubjectKind::Catalog => {
            crate::css_case_timeline_merge::types::CaseTimelineSubjectKind::Catalog
        }
        CaseTimelineExplainSubjectKind::Deal => {
            crate::css_case_timeline_merge::types::CaseTimelineSubjectKind::Deal
        }
        CaseTimelineExplainSubjectKind::Ownership => {
            crate::css_case_timeline_merge::types::CaseTimelineSubjectKind::Ownership
        }
    }
}

pub async fn build_case_timeline_explain(
    pool: &sqlx::PgPool,
    req: CaseTimelineExplainRequest,
) -> anyhow::Result<CssCaseTimelineExplainView> {
    let timeline = crate::css_case_timeline_merge::runtime::build_case_timeline(
        pool,
        crate::css_case_timeline_merge::types::CaseTimelineRequest {
            case_id: req.case_id.clone(),
            subject_kind: to_merge_subject_kind(&req.subject_kind),
            subject_id: req.subject_id.clone(),
        },
    )
    .await?;

    Ok(crate::css_case_timeline_explain::composer::build_view(
        &timeline,
        req.subject_kind,
    ))
}

#[cfg(test)]
mod tests {
    #[test]
    fn v194_maps_ownership_subject_kind_to_merge_subject_kind() {
        let got = super::to_merge_subject_kind(
            &crate::css_case_timeline_explain::types::CaseTimelineExplainSubjectKind::Ownership,
        );
        assert_eq!(
            got,
            crate::css_case_timeline_merge::types::CaseTimelineSubjectKind::Ownership
        );
    }
}
