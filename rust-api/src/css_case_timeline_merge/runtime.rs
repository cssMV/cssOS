use crate::css_case_timeline_merge::types::{
    CaseTimelineRequest, CaseTimelineSubjectKind, CssCaseTimelineView,
};

fn to_timeline_ui_subject_kind(
    kind: &CaseTimelineSubjectKind,
) -> crate::css_timeline_ui_model::types::TimelineUiSubjectKind {
    match kind {
        CaseTimelineSubjectKind::User => {
            crate::css_timeline_ui_model::types::TimelineUiSubjectKind::User
        }
        CaseTimelineSubjectKind::Catalog => {
            crate::css_timeline_ui_model::types::TimelineUiSubjectKind::Catalog
        }
        CaseTimelineSubjectKind::Deal => {
            crate::css_timeline_ui_model::types::TimelineUiSubjectKind::Deal
        }
        CaseTimelineSubjectKind::Ownership => {
            crate::css_timeline_ui_model::types::TimelineUiSubjectKind::Ownership
        }
    }
}

pub async fn build_case_timeline(
    pool: &sqlx::PgPool,
    req: CaseTimelineRequest,
) -> anyhow::Result<CssCaseTimelineView> {
    let timeline_ui = crate::css_timeline_ui_model::runtime::build_timeline_ui_model(
        pool,
        crate::css_timeline_ui_model::types::TimelineUiRequest {
            subject_kind: to_timeline_ui_subject_kind(&req.subject_kind),
            subject_id: req.subject_id.clone(),
        },
    )
    .await?;

    let action_logs = crate::css_case_action_log::runtime::list_case_logs(pool, &req.case_id)
        .await
        .unwrap_or_default();

    let mut items = Vec::new();

    for item in &timeline_ui.items {
        items.push(crate::css_case_timeline_merge::composer::from_timeline_ui_item(item));
    }

    for log in &action_logs {
        items.push(crate::css_case_timeline_merge::composer::from_case_action_log(log));
    }

    Ok(CssCaseTimelineView {
        subject_kind: req.subject_kind,
        subject_id: req.subject_id,
        items: crate::css_case_timeline_merge::composer::sort_items(items),
    })
}

#[cfg(test)]
mod tests {
    #[test]
    fn v193_maps_catalog_subject_kind_to_timeline_ui_kind() {
        let got = super::to_timeline_ui_subject_kind(
            &crate::css_case_timeline_merge::types::CaseTimelineSubjectKind::Catalog,
        );
        assert_eq!(
            got,
            crate::css_timeline_ui_model::types::TimelineUiSubjectKind::Catalog
        );
    }
}
