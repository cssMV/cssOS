pub mod evaluator;
pub mod prompt_adjuster;
pub mod retry;
pub mod scorer;

use anyhow::Result;
use serde::{Deserialize, Serialize};

pub use evaluator::evaluate_batch;
pub use prompt_adjuster::adjust_prompt;
pub use retry::{render_with_feedback, FeedbackRenderResult};
pub use scorer::{score_image, RenderScore};

use crate::video::consistency::{CharacterProfile, StyleProfile};
use crate::video::types::SceneInput;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneDirection {
    pub emotion: String,
    pub visual_focus: String,
    pub camera_hint: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderContext {
    pub scene_id: u32,
    pub visual_script: String,
    pub prompt: String,
    pub output_dir: String,
    pub image_count: usize,
    pub character_profiles: Vec<CharacterProfile>,
    pub style_profile: StyleProfile,
    pub scene_direction: SceneDirection,
}

pub fn render_scene_with_feedback(
    scene: &SceneInput,
    context: &RenderContext,
) -> Result<FeedbackRenderResult> {
    let _ = scene;
    render_with_feedback(&context.prompt, context, 3)
}

pub fn quick_score(path: &str) -> f32 {
    std::fs::metadata(path)
        .map(|meta| ((meta.len() as f32) / 1_000_000.0).min(1.0))
        .unwrap_or(0.0)
}
