fn to_replay_subject_kind(
    kind: &crate::css_signals_narrative::types::NarrativeSubjectKind,
) -> crate::css_signals_replay::types::ReplaySubjectKind {
    match kind {
        crate::css_signals_narrative::types::NarrativeSubjectKind::User => {
            crate::css_signals_replay::types::ReplaySubjectKind::User
        }
        crate::css_signals_narrative::types::NarrativeSubjectKind::Catalog => {
            crate::css_signals_replay::types::ReplaySubjectKind::Catalog
        }
        crate::css_signals_narrative::types::NarrativeSubjectKind::Deal => {
            crate::css_signals_replay::types::ReplaySubjectKind::Deal
        }
        crate::css_signals_narrative::types::NarrativeSubjectKind::Ownership => {
            crate::css_signals_replay::types::ReplaySubjectKind::Ownership
        }
    }
}

pub async fn build_narrative(
    pool: &sqlx::PgPool,
    req: crate::css_signals_narrative::types::NarrativeRequest,
) -> anyhow::Result<crate::css_signals_narrative::types::CssSignalsNarrative> {
    let replay = crate::css_signals_replay::runtime::build_replay(
        pool,
        crate::css_signals_replay::types::ReplayRequest {
            subject_kind: to_replay_subject_kind(&req.subject_kind),
            subject_id: req.subject_id.clone(),
        },
    )
    .await?;

    Ok(crate::css_signals_narrative::types::CssSignalsNarrative {
        subject_kind: req.subject_kind,
        subject_id: req.subject_id,
        summary: crate::css_signals_narrative::composer::build_summary(&replay),
        milestones: crate::css_signals_narrative::composer::extract_milestones(&replay),
        current_assessment: crate::css_signals_narrative::composer::build_current_assessment(
            &replay,
        ),
    })
}

#[cfg(test)]
mod tests {
    #[test]
    fn v186_maps_deal_narrative_subject_to_replay_subject() {
        let got = super::to_replay_subject_kind(
            &crate::css_signals_narrative::types::NarrativeSubjectKind::Deal,
        );
        assert_eq!(
            got,
            crate::css_signals_replay::types::ReplaySubjectKind::Deal
        );
    }
}
