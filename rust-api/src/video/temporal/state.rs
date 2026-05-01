#[derive(Debug, Clone)]
pub struct TemporalState {
    pub character_identity: String,
    pub environment: String,
    pub style: String,
}

pub fn init_state(base_prompt: &str) -> TemporalState {
    TemporalState {
        character_identity: base_prompt.to_string(),
        environment: base_prompt.to_string(),
        style: "cinematic, realistic, consistent lighting".to_string(),
    }
}
