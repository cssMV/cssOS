use std::fs;
use std::path::PathBuf;

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};

use super::{adjust_prompt, evaluate_batch, RenderContext, RenderScore};
use crate::video::renderer::generate_image_with_openai;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeedbackRenderResult {
    pub best_output: String,
    pub scores: Vec<RenderScore>,
    pub attempts: u32,
    pub improved: bool,
}

pub fn render_with_feedback(
    initial_prompt: &str,
    context: &RenderContext,
    max_attempts: u32,
) -> Result<FeedbackRenderResult> {
    let attempts = max_attempts.clamp(1, 5);
    let output_dir = PathBuf::from(&context.output_dir);
    fs::create_dir_all(&output_dir)?;
    let mut prompt = initial_prompt.to_string();
    let mut best_output = None::<String>;
    let mut best_score = None::<RenderScore>;
    let mut all_scores = Vec::new();

    for attempt in 0..attempts {
        let output_path = output_dir.join(format!(
            "scene_{:03}_feedback_attempt_{:02}.jpg",
            context.scene_id, attempt
        ));
        generate_image_with_openai(&prompt, &output_path)?;
        let mut attempt_context = context.clone();
        attempt_context.prompt = prompt.clone();
        let evaluated = evaluate_batch(
            &[output_path.to_string_lossy().to_string()],
            &attempt_context,
        );
        let (_, score) = evaluated
            .into_iter()
            .next()
            .ok_or_else(|| anyhow!("feedback evaluation produced no result"))?;
        let current_output = output_path.to_string_lossy().to_string();
        let should_replace = best_score
            .as_ref()
            .map(|best| score.overall > best.overall)
            .unwrap_or(true);
        if should_replace {
            best_output = Some(current_output);
            best_score = Some(score.clone());
        }
        all_scores.push(score.clone());
        if score.overall >= 0.82 {
            return Ok(FeedbackRenderResult {
                best_output: best_output.expect("best output must exist"),
                scores: all_scores,
                attempts: attempt + 1,
                improved: attempt > 0,
            });
        }
        prompt = adjust_prompt(&prompt, &score);
    }

    Ok(FeedbackRenderResult {
        best_output: best_output.ok_or_else(|| anyhow!("feedback engine produced no image"))?,
        scores: all_scores,
        attempts,
        improved: attempts > 1,
    })
}
