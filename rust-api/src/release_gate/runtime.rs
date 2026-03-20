pub fn run_release_gate(
    run_id: &str,
) -> anyhow::Result<crate::release_gate::types::ReleaseGateReport> {
    let qd = crate::quality_director::runtime::run_quality_director(run_id)?;
    Ok(crate::release_gate::policy::build_release_gate_report(
        &qd.readiness,
    ))
}

pub fn check_market_publish(
    req: crate::release_gate::types::MarketPublishRequest,
) -> anyhow::Result<crate::release_gate::types::GateResult> {
    let gates = run_release_gate(&req.run_id)?;
    Ok(gates.market_list)
}

pub fn check_pricing_enable(
    run_id: &str,
) -> anyhow::Result<crate::release_gate::types::GateResult> {
    let gates = run_release_gate(run_id)?;
    Ok(gates.pricing_enable)
}
