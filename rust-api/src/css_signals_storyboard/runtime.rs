fn to_replay_subject_kind(
    kind: &crate::css_signals_storyboard::types::StoryboardSubjectKind,
) -> crate::css_signals_replay::types::ReplaySubjectKind {
    match kind {
        crate::css_signals_storyboard::types::StoryboardSubjectKind::User => {
            crate::css_signals_replay::types::ReplaySubjectKind::User
        }
        crate::css_signals_storyboard::types::StoryboardSubjectKind::Catalog => {
            crate::css_signals_replay::types::ReplaySubjectKind::Catalog
        }
        crate::css_signals_storyboard::types::StoryboardSubjectKind::Deal => {
            crate::css_signals_replay::types::ReplaySubjectKind::Deal
        }
        crate::css_signals_storyboard::types::StoryboardSubjectKind::Ownership => {
            crate::css_signals_replay::types::ReplaySubjectKind::Ownership
        }
    }
}

fn to_narrative_subject_kind(
    kind: &crate::css_signals_storyboard::types::StoryboardSubjectKind,
) -> crate::css_signals_narrative::types::NarrativeSubjectKind {
    match kind {
        crate::css_signals_storyboard::types::StoryboardSubjectKind::User => {
            crate::css_signals_narrative::types::NarrativeSubjectKind::User
        }
        crate::css_signals_storyboard::types::StoryboardSubjectKind::Catalog => {
            crate::css_signals_narrative::types::NarrativeSubjectKind::Catalog
        }
        crate::css_signals_storyboard::types::StoryboardSubjectKind::Deal => {
            crate::css_signals_narrative::types::NarrativeSubjectKind::Deal
        }
        crate::css_signals_storyboard::types::StoryboardSubjectKind::Ownership => {
            crate::css_signals_narrative::types::NarrativeSubjectKind::Ownership
        }
    }
}

pub async fn build_storyboard(
    pool: &sqlx::PgPool,
    req: crate::css_signals_storyboard::types::StoryboardRequest,
) -> anyhow::Result<crate::css_signals_storyboard::types::CssSignalsStoryboard> {
    let replay = crate::css_signals_replay::runtime::build_replay(
        pool,
        crate::css_signals_replay::types::ReplayRequest {
            subject_kind: to_replay_subject_kind(&req.subject_kind),
            subject_id: req.subject_id.clone(),
        },
    )
    .await?;

    let narrative = crate::css_signals_narrative::runtime::build_narrative(
        pool,
        crate::css_signals_narrative::types::NarrativeRequest {
            subject_kind: to_narrative_subject_kind(&req.subject_kind),
            subject_id: req.subject_id.clone(),
        },
    )
    .await?;

    let mut cards = Vec::new();

    if let Some(first) = replay.frames.first() {
        cards.push(crate::css_signals_storyboard::composer::initial_card(first));
    }

    for milestone in &narrative.milestones {
        cards.push(crate::css_signals_storyboard::composer::card_from_milestone(milestone));
    }

    cards.push(crate::css_signals_storyboard::composer::current_state_card(
        &narrative.current_assessment,
    ));

    Ok(crate::css_signals_storyboard::types::CssSignalsStoryboard {
        subject_kind: req.subject_kind,
        subject_id: req.subject_id,
        cards,
    })
}

#[cfg(test)]
mod tests {
    #[test]
    fn v187_maps_catalog_storyboard_subject_to_replay_subject() {
        let got = super::to_replay_subject_kind(
            &crate::css_signals_storyboard::types::StoryboardSubjectKind::Catalog,
        );
        assert_eq!(
            got,
            crate::css_signals_replay::types::ReplaySubjectKind::Catalog
        );
    }
}
