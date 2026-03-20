fn to_timeline_subject_kind(
    kind: &crate::css_timeline_ui_model::types::TimelineUiSubjectKind,
) -> crate::css_governance_timeline::types::TimelineSubjectKind {
    match kind {
        crate::css_timeline_ui_model::types::TimelineUiSubjectKind::User => {
            crate::css_governance_timeline::types::TimelineSubjectKind::User
        }
        crate::css_timeline_ui_model::types::TimelineUiSubjectKind::Catalog => {
            crate::css_governance_timeline::types::TimelineSubjectKind::Catalog
        }
        crate::css_timeline_ui_model::types::TimelineUiSubjectKind::Deal => {
            crate::css_governance_timeline::types::TimelineSubjectKind::Deal
        }
        crate::css_timeline_ui_model::types::TimelineUiSubjectKind::Ownership => {
            crate::css_governance_timeline::types::TimelineSubjectKind::Ownership
        }
    }
}

fn to_replay_subject_kind(
    kind: &crate::css_timeline_ui_model::types::TimelineUiSubjectKind,
) -> crate::css_signals_replay::types::ReplaySubjectKind {
    match kind {
        crate::css_timeline_ui_model::types::TimelineUiSubjectKind::User => {
            crate::css_signals_replay::types::ReplaySubjectKind::User
        }
        crate::css_timeline_ui_model::types::TimelineUiSubjectKind::Catalog => {
            crate::css_signals_replay::types::ReplaySubjectKind::Catalog
        }
        crate::css_timeline_ui_model::types::TimelineUiSubjectKind::Deal => {
            crate::css_signals_replay::types::ReplaySubjectKind::Deal
        }
        crate::css_timeline_ui_model::types::TimelineUiSubjectKind::Ownership => {
            crate::css_signals_replay::types::ReplaySubjectKind::Ownership
        }
    }
}

fn to_storyboard_subject_kind(
    kind: &crate::css_timeline_ui_model::types::TimelineUiSubjectKind,
) -> crate::css_signals_storyboard::types::StoryboardSubjectKind {
    match kind {
        crate::css_timeline_ui_model::types::TimelineUiSubjectKind::User => {
            crate::css_signals_storyboard::types::StoryboardSubjectKind::User
        }
        crate::css_timeline_ui_model::types::TimelineUiSubjectKind::Catalog => {
            crate::css_signals_storyboard::types::StoryboardSubjectKind::Catalog
        }
        crate::css_timeline_ui_model::types::TimelineUiSubjectKind::Deal => {
            crate::css_signals_storyboard::types::StoryboardSubjectKind::Deal
        }
        crate::css_timeline_ui_model::types::TimelineUiSubjectKind::Ownership => {
            crate::css_signals_storyboard::types::StoryboardSubjectKind::Ownership
        }
    }
}

pub async fn build_timeline_ui_model(
    pool: &sqlx::PgPool,
    req: crate::css_timeline_ui_model::types::TimelineUiRequest,
) -> anyhow::Result<crate::css_timeline_ui_model::types::CssTimelineUiModel> {
    let timeline = crate::css_governance_timeline::store_pg::list_timeline_for_subject(
        pool,
        to_timeline_subject_kind(&req.subject_kind),
        &req.subject_id,
    )
    .await?;

    let replay = crate::css_signals_replay::runtime::build_replay(
        pool,
        crate::css_signals_replay::types::ReplayRequest {
            subject_kind: to_replay_subject_kind(&req.subject_kind),
            subject_id: req.subject_id.clone(),
        },
    )
    .await?;

    let storyboard = crate::css_signals_storyboard::runtime::build_storyboard(
        pool,
        crate::css_signals_storyboard::types::StoryboardRequest {
            subject_kind: to_storyboard_subject_kind(&req.subject_kind),
            subject_id: req.subject_id.clone(),
        },
    )
    .await?;

    let mut items = Vec::new();

    for entry in &timeline {
        items.push(crate::css_timeline_ui_model::composer::governance_entry_to_item(entry));
    }

    for frame in &replay.frames {
        items.push(crate::css_timeline_ui_model::composer::replay_frame_to_item(frame));
    }

    for card in &storyboard.cards {
        items.push(crate::css_timeline_ui_model::composer::storyboard_card_to_item(card));
    }

    Ok(crate::css_timeline_ui_model::types::CssTimelineUiModel {
        subject_kind: req.subject_kind,
        subject_id: req.subject_id,
        items: crate::css_timeline_ui_model::composer::sort_items(items),
    })
}

#[cfg(test)]
mod tests {
    #[test]
    fn v188_maps_deal_ui_subject_to_storyboard_subject() {
        let got = super::to_storyboard_subject_kind(
            &crate::css_timeline_ui_model::types::TimelineUiSubjectKind::Deal,
        );
        assert_eq!(
            got,
            crate::css_signals_storyboard::types::StoryboardSubjectKind::Deal
        );
    }
}
