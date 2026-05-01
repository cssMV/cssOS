use serde::{Deserialize, Serialize};

use super::types::RenderAdapterInput;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompositionRenderHints {
    pub target_duration_secs: f32,
    pub expected_scene_count: usize,
    pub transition_hints: Vec<TransitionEdgeHint>,
    pub timing_policy: String,
    pub audio_sync_policy: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransitionEdgeHint {
    pub from_scene_id: u32,
    pub to_scene_id: u32,
    pub transition: String,
}

pub fn build_composition_hints(input: &RenderAdapterInput) -> CompositionRenderHints {
    CompositionRenderHints {
        target_duration_secs: input.music.duration_secs,
        expected_scene_count: input.scenes.len(),
        transition_hints: input
            .director_plan
            .transition_plan
            .iter()
            .map(|edge| TransitionEdgeHint {
                from_scene_id: edge.from_scene_id,
                to_scene_id: edge.to_scene_id,
                transition: edge.transition.clone(),
            })
            .collect(),
        timing_policy:
            "scene durations are authoritative; final composition must align with music duration"
                .to_string(),
        audio_sync_policy:
            "match final MV to audio length; allow only minor composition-level adjustment"
                .to_string(),
    }
}
