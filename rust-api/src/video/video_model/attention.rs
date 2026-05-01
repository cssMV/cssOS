use anyhow::Result;
use ndarray::{Array2, Axis};

pub fn self_attention(q: &Array2<f32>, k: &Array2<f32>, v: &Array2<f32>) -> Result<Array2<f32>> {
    let dk = (q.shape()[1] as f32).sqrt();
    let scores = q.dot(&k.t()) / dk;
    let weights = softmax(scores);
    Ok(weights.dot(v))
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
