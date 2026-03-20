pub fn run_quality_director(
    run_id: &str,
) -> anyhow::Result<crate::quality_director::types::QualityDirectorReport> {
    let narrative = crate::narrative_qa::runtime::run_narrative_qa(
        crate::narrative_qa::types::NarrativeQaRequest {
            run_id: run_id.to_string(),
        },
    )
    .ok();
    let continuity = crate::continuity_engine::runtime::run_continuity_check(
        crate::continuity_engine::types::ContinuityRequest {
            run_id: run_id.to_string(),
        },
    )
    .ok();

    let mut blockers = Vec::new();
    if let Some(ref report) = narrative {
        blockers.extend(crate::quality_director::policy::from_narrative_qa(report));
    }
    if let Some(ref report) = continuity {
        blockers.extend(crate::quality_director::policy::from_continuity_qa(report));
    }
    let blocker_level = crate::quality_director::policy::overall_blocker_level(&blockers);
    let readiness = crate::quality_director::policy::readiness_from_blockers(blocker_level.clone());
    let score =
        crate::quality_director::scoring::compute_score(narrative.as_ref(), continuity.as_ref());
    let headline = crate::quality_director::scoring::headline(&readiness, &blockers);
    Ok(crate::quality_director::types::QualityDirectorReport {
        readiness,
        blocker_level,
        blockers,
        score,
        headline: Some(headline),
    })
}
