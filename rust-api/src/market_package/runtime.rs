pub fn build_market_package_for_run(
    run_id: &str,
    title: String,
) -> anyhow::Result<crate::market_package::types::MarketPackage> {
    let gate = crate::release_gate::runtime::check_market_publish(
        crate::release_gate::types::MarketPublishRequest {
            run_id: run_id.to_string(),
            title: Some(title.clone()),
            price_cents: None,
        },
    )?;
    if matches!(
        gate.decision,
        crate::release_gate::types::GateDecision::Deny
    ) {
        anyhow::bail!("market package build denied by release gate");
    }

    let paths = crate::run_store::list_run_files(run_id).unwrap_or_default();
    let assets = crate::market_package::builder::infer_assets_from_paths(&paths);
    Ok(crate::market_package::builder::build_market_package(
        crate::market_package::builder::MarketPackageBuildInput {
            run_id: run_id.to_string(),
            title,
            assets,
            engine_name: "cssmv".into(),
            engine_version: "v3.0".into(),
        },
    ))
}

pub fn validate_market_package_for_run(
    run_id: &str,
    title: String,
) -> anyhow::Result<crate::market_package::validator::PackageValidationResult> {
    let pkg = build_market_package_for_run(run_id, title)?;
    Ok(crate::market_package::validator::validate_package(&pkg))
}
