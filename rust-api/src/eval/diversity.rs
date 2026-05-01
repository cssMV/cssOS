use anyhow::Result;

pub fn diversity_score(scores: &[f32]) -> Result<f32> {
    if scores.is_empty() {
        return Ok(0.0);
    }

    let mean = scores.iter().sum::<f32>() / scores.len() as f32;
    let mut variance = 0.0f32;

    for score in scores {
        variance += (score - mean).powf(2.0);
    }

    variance /= scores.len() as f32;
    Ok(variance)
}
