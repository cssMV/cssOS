use super::state::TemporalState;

pub fn build_consistent_prompt(
    prev_prompt: &str,
    current_action: &str,
    state: &TemporalState,
) -> String {
    format!(
        "SAME CHARACTER as previous frame, SAME FACE, SAME CLOTHING, SAME IDENTITY: {identity}, SAME ENVIRONMENT: {env}, CONTINUOUS ACTION: {action}, PREVIOUS FRAME CONTEXT: {prev}, STYLE LOCK: {style}, cinematic, realistic, no scene change, no character change, no camera jump",
        identity = state.character_identity,
        env = state.environment,
        action = current_action,
        prev = prev_prompt,
        style = state.style,
    )
}
