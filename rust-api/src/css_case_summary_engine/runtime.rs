use crate::css_case_summary_engine::types::{
    CaseSummaryRequest, CaseSummarySubjectKind, CssCaseSummaryView,
};

fn to_status_subject_kind(
    kind: &CaseSummarySubjectKind,
) -> crate::css_case_status_view::types::CaseStatusSubjectKind {
    match kind {
        CaseSummarySubjectKind::User => {
            crate::css_case_status_view::types::CaseStatusSubjectKind::User
        }
        CaseSummarySubjectKind::Catalog => {
            crate::css_case_status_view::types::CaseStatusSubjectKind::Catalog
        }
        CaseSummarySubjectKind::Deal => {
            crate::css_case_status_view::types::CaseStatusSubjectKind::Deal
        }
        CaseSummarySubjectKind::Ownership => {
            crate::css_case_status_view::types::CaseStatusSubjectKind::Ownership
        }
    }
}

fn to_lifecycle_subject_kind(
    kind: &CaseSummarySubjectKind,
) -> crate::css_case_lifecycle_view::types::CaseLifecycleSubjectKind {
    match kind {
        CaseSummarySubjectKind::User => {
            crate::css_case_lifecycle_view::types::CaseLifecycleSubjectKind::User
        }
        CaseSummarySubjectKind::Catalog => {
            crate::css_case_lifecycle_view::types::CaseLifecycleSubjectKind::Catalog
        }
        CaseSummarySubjectKind::Deal => {
            crate::css_case_lifecycle_view::types::CaseLifecycleSubjectKind::Deal
        }
        CaseSummarySubjectKind::Ownership => {
            crate::css_case_lifecycle_view::types::CaseLifecycleSubjectKind::Ownership
        }
    }
}

fn to_timeline_explain_subject_kind(
    kind: &CaseSummarySubjectKind,
) -> crate::css_case_timeline_explain::types::CaseTimelineExplainSubjectKind {
    match kind {
        CaseSummarySubjectKind::User => {
            crate::css_case_timeline_explain::types::CaseTimelineExplainSubjectKind::User
        }
        CaseSummarySubjectKind::Catalog => {
            crate::css_case_timeline_explain::types::CaseTimelineExplainSubjectKind::Catalog
        }
        CaseSummarySubjectKind::Deal => {
            crate::css_case_timeline_explain::types::CaseTimelineExplainSubjectKind::Deal
        }
        CaseSummarySubjectKind::Ownership => {
            crate::css_case_timeline_explain::types::CaseTimelineExplainSubjectKind::Ownership
        }
    }
}

pub async fn build_case_summary(
    pool: &sqlx::PgPool,
    req: CaseSummaryRequest,
) -> anyhow::Result<CssCaseSummaryView> {
    let status = crate::css_case_status_view::runtime::load_case_status(
        pool,
        crate::css_case_status_view::types::CaseStatusRequest {
            case_id: req.case_id.clone(),
            subject_kind: to_status_subject_kind(&req.subject_kind),
            subject_id: req.subject_id.clone(),
        },
    )
    .await?;

    let lifecycle = crate::css_case_lifecycle_view::runtime::build_case_lifecycle_view(
        pool,
        crate::css_case_lifecycle_view::types::CaseLifecycleRequest {
            case_id: req.case_id.clone(),
            subject_kind: to_lifecycle_subject_kind(&req.subject_kind),
            subject_id: req.subject_id.clone(),
        },
    )
    .await?;

    let timeline_explain = crate::css_case_timeline_explain::runtime::build_case_timeline_explain(
        pool,
        crate::css_case_timeline_explain::types::CaseTimelineExplainRequest {
            case_id: req.case_id.clone(),
            subject_kind: to_timeline_explain_subject_kind(&req.subject_kind),
            subject_id: req.subject_id.clone(),
        },
    )
    .await?;

    let timeline_summary =
        crate::css_case_summary_engine::composer::timeline_summary(&timeline_explain);
    let one_line = crate::css_case_summary_engine::composer::build_one_line(
        &req.subject_kind,
        &req.subject_id,
        &status.label,
        &timeline_summary,
    );
    let three_lines = crate::css_case_summary_engine::composer::build_three_lines(
        &status.label,
        &crate::css_case_summary_engine::composer::lifecycle_current_label(&lifecycle),
        &timeline_summary,
    );

    Ok(CssCaseSummaryView {
        case_id: req.case_id,
        subject_kind: req.subject_kind,
        subject_id: req.subject_id,
        one_line,
        three_lines,
    })
}
