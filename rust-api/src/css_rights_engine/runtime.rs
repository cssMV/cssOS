use crate::css_rights_engine::types::{RightsDecisionResult, RightsGrant, RightsWorkStructure};
use crate::css_rights_engine::validator::RightsValidationResult;

pub fn validate_rights_for_run(
    run_id: &str,
    title: String,
    work_structure: RightsWorkStructure,
) -> anyhow::Result<RightsValidationResult> {
    let manifest =
        crate::css_commerce_manifest::runtime::build_css_commerce_manifest_for_run(run_id, title)?;
    Ok(
        crate::css_rights_engine::validator::validate_commerce_manifest_rights(
            &manifest,
            work_structure,
        ),
    )
}

pub fn evaluate_grant(grant: RightsGrant) -> RightsDecisionResult {
    crate::css_rights_engine::policy::evaluate_rights_grant(&grant)
}

pub fn parse_work_structure(value: Option<&str>) -> RightsWorkStructure {
    match value.unwrap_or("single") {
        "trilogy" => RightsWorkStructure::Trilogy,
        "opera" => RightsWorkStructure::Opera,
        "anthology" => RightsWorkStructure::Anthology,
        "series" => RightsWorkStructure::Series,
        _ => RightsWorkStructure::Single,
    }
}
