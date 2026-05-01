use anyhow::Result;
use ndarray::{Array2, Axis};

pub fn cross_attention(
    video_tokens: &Array2<f32>,
    cond_tokens: &Array2<f32>,
) -> Result<Array2<f32>> {
    let dk = (video_tokens.shape()[1] as f32).sqrt();
    let scores = video_tokens.dot(&cond_tokens.t()) / dk;
    let weights = softmax(scores);
    Ok(weights.dot(cond_tokens))
}

fn softmax(mut x: Array2<f32>) -> Array2<f32> {
    for mut row in x.axis_iter_mut(Axis(0)) {
        let max = row.iter().cloned().fold(f32::MIN, f32::max);
        let mut sum = 0.0;
        for value in &mut row {
            *value = (*value - max).exp();
            sum += *value;
        }
        let denom = if sum > 0.0 { sum } else { 1.0 };
        for value in &mut row {
            *value /= denom;
        }
    }
    x
}
