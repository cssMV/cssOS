use anyhow::{anyhow, Result};

use crate::video::openai_client::generate_image;

use super::frame_scorer::score_frame;

pub fn generate_best_frame(
    api_key: &str,
    prompt: &str,
    output_stem: &str,
    expected_keywords: &[&str],
    max_retry: u32,
) -> Result<String> {
    let retries = max_retry.clamp(1, 5);
    let mut best_path = None::<String>;
    let mut best_score = 0.0_f32;

    for index in 0..retries {
        let path = format!("{output_stem}_retry_{index}.png");
        generate_image(api_key, prompt, &path)?;
        let score = score_frame(&path, expected_keywords);
        if score.overall > best_score {
            best_score = score.overall;
            best_path = Some(path.clone());
        }
        if score.overall >= 0.55 {
            return Ok(path);
        }
    }

    best_path.ok_or_else(|| anyhow!("no valid frame generated for {output_stem}"))
}
