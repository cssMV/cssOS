pub fn build_css_commerce_manifest_for_run(
    run_id: &str,
    title: String,
) -> anyhow::Result<crate::css_commerce_manifest::types::CssCommerceManifest> {
    let gates = crate::release_gate::runtime::run_release_gate(run_id)?;
    if matches!(
        gates.market_list.decision,
        crate::release_gate::types::GateDecision::Deny
    ) {
        anyhow::bail!("cssMARKET listing denied by release gate");
    }

    let pkg = crate::market_package::runtime::build_market_package_for_run(run_id, title.clone())?;
    Ok(
        crate::css_commerce_manifest::builder::build_css_commerce_manifest(
            crate::css_commerce_manifest::builder::CssCommerceBuildInput {
                run_id: run_id.to_string(),
                title,
                engine_name: "cssmv".into(),
                engine_version: "v3.0".into(),
                market_package: pkg,
                allow_pricing: matches!(
                    gates.pricing_enable.decision,
                    crate::release_gate::types::GateDecision::Allow
                ),
                allow_settlement: matches!(
                    gates.settlement_enable.decision,
                    crate::release_gate::types::GateDecision::Allow
                ),
            },
        ),
    )
}

pub fn validate_css_commerce_manifest_for_run(
    run_id: &str,
    title: String,
) -> anyhow::Result<crate::css_commerce_manifest::validator::CommerceValidationResult> {
    let manifest = build_css_commerce_manifest_for_run(run_id, title)?;
    Ok(crate::css_commerce_manifest::validator::validate_css_commerce_manifest(&manifest))
}
