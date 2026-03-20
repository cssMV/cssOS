use crate::css_case_status_view::types::{
    CaseStatusKind, CaseStatusRequest, CaseStatusSubjectKind, CssCaseStatusView,
};
use crate::css_resolution_log::types::{ResolutionLogStatus, ResolutionLogSubjectKind};

fn from_resolution_log_status(status: &ResolutionLogStatus) -> CaseStatusKind {
    match status {
        ResolutionLogStatus::Open => CaseStatusKind::Open,
        ResolutionLogStatus::Resolved => CaseStatusKind::Resolved,
        ResolutionLogStatus::Dismissed => CaseStatusKind::Dismissed,
        ResolutionLogStatus::Released => CaseStatusKind::Released,
        ResolutionLogStatus::EscalatedToManual => CaseStatusKind::EscalatedToManual,
        ResolutionLogStatus::FrozenUntilReview => CaseStatusKind::FrozenUntilReview,
    }
}

fn from_resolution_log_subject_kind(kind: &ResolutionLogSubjectKind) -> CaseStatusSubjectKind {
    match kind {
        ResolutionLogSubjectKind::User => CaseStatusSubjectKind::User,
        ResolutionLogSubjectKind::Catalog => CaseStatusSubjectKind::Catalog,
        ResolutionLogSubjectKind::Deal => CaseStatusSubjectKind::Deal,
        ResolutionLogSubjectKind::Ownership => CaseStatusSubjectKind::Ownership,
    }
}

fn status_label(status: &CaseStatusKind) -> String {
    match status {
        CaseStatusKind::Open => "处理中".into(),
        CaseStatusKind::Resolved => "已解决".into(),
        CaseStatusKind::Dismissed => "已驳回".into(),
        CaseStatusKind::Released => "已释放".into(),
        CaseStatusKind::EscalatedToManual => "已升级人工处理".into(),
        CaseStatusKind::FrozenUntilReview => "冻结待复核".into(),
    }
}

fn open_fallback(req: &CaseStatusRequest) -> CssCaseStatusView {
    let status = CaseStatusKind::Open;

    CssCaseStatusView {
        case_id: req.case_id.clone(),
        subject_kind: req.subject_kind.clone(),
        subject_id: req.subject_id.clone(),
        status: status.clone(),
        label: status_label(&status),
        is_closed_like: false,
        actor_user_id: None,
        reason: None,
        updated_at: None,
    }
}

pub async fn load_case_status(
    pool: &sqlx::PgPool,
    req: CaseStatusRequest,
) -> anyhow::Result<CssCaseStatusView> {
    let latest =
        crate::css_resolution_log::runtime::load_latest_case_resolution(pool, &req.case_id).await?;

    let Some(log) = latest else {
        return Ok(open_fallback(&req));
    };

    let status = from_resolution_log_status(&log.status);

    Ok(CssCaseStatusView {
        case_id: log.case_id,
        subject_kind: from_resolution_log_subject_kind(&log.subject_kind),
        subject_id: log.subject_id,
        status: status.clone(),
        label: status_label(&status),
        is_closed_like: log.is_closed_like,
        actor_user_id: Some(log.actor_user_id),
        reason: Some(log.reason),
        updated_at: Some(log.created_at),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v197_open_fallback_returns_open_status() {
        let view = open_fallback(&CaseStatusRequest {
            case_id: "case:deal:deal_1".into(),
            subject_kind: CaseStatusSubjectKind::Deal,
            subject_id: "deal_1".into(),
        });

        assert_eq!(view.status, CaseStatusKind::Open);
        assert_eq!(view.label, "处理中");
        assert!(!view.is_closed_like);
    }
}
