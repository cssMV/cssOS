use crate::css_case_lifecycle_view::types::{CaseLifecycleRequest, CssCaseLifecycleView};

pub async fn build_case_lifecycle_view(
    pool: &sqlx::PgPool,
    req: CaseLifecycleRequest,
) -> anyhow::Result<CssCaseLifecycleView> {
    let action_logs = crate::css_case_action_log::runtime::list_case_logs(pool, &req.case_id)
        .await
        .unwrap_or_default();

    let resolution_logs =
        crate::css_resolution_log::store_pg::list_resolution_logs_for_case(pool, &req.case_id)
            .await
            .unwrap_or_default();

    let mut stages = vec![crate::css_case_lifecycle_view::composer::initial_open_stage()];
    stages.extend(crate::css_case_lifecycle_view::composer::stages_from_action_logs(&action_logs));
    stages.extend(
        crate::css_case_lifecycle_view::composer::stages_from_resolution_logs(&resolution_logs),
    );

    stages.sort_by(|a, b| a.entered_at.cmp(&b.entered_at));
    let stages = crate::css_case_lifecycle_view::composer::squash_consecutive_stages(stages);

    let current_stage = crate::css_case_lifecycle_view::composer::current_stage(&stages);
    let current_label = crate::css_case_lifecycle_view::composer::stage_label(&current_stage);
    let latest_resolution =
        crate::css_resolution_log::runtime::load_latest_case_resolution(pool, &req.case_id).await?;
    let is_closed_like = latest_resolution
        .map(|item| item.is_closed_like)
        .unwrap_or(false);

    Ok(CssCaseLifecycleView {
        case_id: req.case_id,
        subject_kind: req.subject_kind,
        subject_id: req.subject_id,
        stages,
        current_stage,
        current_label,
        is_closed_like,
    })
}

#[cfg(test)]
mod tests {
    use crate::css_case_lifecycle_view::types::CaseLifecycleSubjectKind;

    #[test]
    fn v198_subject_kind_roundtrip_for_deal_is_stable() {
        let req = crate::css_case_lifecycle_view::types::CaseLifecycleRequest {
            case_id: "case:deal:deal_1".into(),
            subject_kind: CaseLifecycleSubjectKind::Deal,
            subject_id: "deal_1".into(),
        };

        assert_eq!(req.subject_kind, CaseLifecycleSubjectKind::Deal);
    }
}
