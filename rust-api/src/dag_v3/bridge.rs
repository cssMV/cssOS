pub fn build_execution_plan_from_commands(
    st: &crate::run_state::RunState,
) -> anyhow::Result<crate::dag_v3::plan::DagExecutionPlan> {
    let engine = st.commands.get("engine").cloned().unwrap_or_default();
    let matrix = st.commands.get("matrix").cloned().unwrap_or_default();
    let creative = st.commands.get("creative").cloned().unwrap_or_default();
    let input = st.commands.get("input").cloned().unwrap_or_default();

    let req = crate::orchestrator::request::CreateMvApiRequest {
        engine: serde_json::from_value(engine)?,
        input: serde_json::from_value(input)?,
        creative: serde_json::from_value(creative).unwrap_or_default(),
        versions: serde_json::from_value(matrix).unwrap_or_default(),
    };

    let (_, _, plan) = crate::orchestrator::build::build_execution_plan_from_api(&req)?;
    Ok(plan)
}
