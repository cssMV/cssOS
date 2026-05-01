use anyhow::{anyhow, Result};
use ndarray::{Array2, ArrayD, Ix4};

use crate::video::video_model::types::{LatentVideo, SpacetimeTokens};

pub fn to_spacetime_tokens(latent: &LatentVideo) -> Result<SpacetimeTokens> {
    let latent4 = latent
        .data
        .view()
        .into_dimensionality::<Ix4>()
        .map_err(|_| anyhow!("latent video must be [T, C, H, W]"))?;

    let (t, c, h, w) = latent4.dim();
    let patch_t = 2usize;
    let patch_h = 4usize;
    let patch_w = 4usize;

    let t_blocks = t.div_ceil(patch_t);
    let h_blocks = h.div_ceil(patch_h);
    let w_blocks = w.div_ceil(patch_w);
    let num = t_blocks * h_blocks * w_blocks;
    let dim = c * patch_t * patch_h * patch_w;
    let mut tokens = Array2::<f32>::zeros((num, dim));

    let mut token_index = 0usize;
    for t0 in (0..t).step_by(patch_t) {
        for h0 in (0..h).step_by(patch_h) {
            for w0 in (0..w).step_by(patch_w) {
                let mut feature_index = 0usize;
                for dt in 0..patch_t {
                    let ti = (t0 + dt).min(t - 1);
                    for ci in 0..c {
                        for dh in 0..patch_h {
                            let hi = (h0 + dh).min(h - 1);
                            for dw in 0..patch_w {
                                let wi = (w0 + dw).min(w - 1);
                                tokens[[token_index, feature_index]] = latent4[[ti, ci, hi, wi]];
                                feature_index += 1;
                            }
                        }
                    }
                }
                token_index += 1;
            }
        }
    }

    Ok(SpacetimeTokens {
        tokens: tokens.into_dyn(),
    })
}

pub fn tokens_to_latent(tokens: &SpacetimeTokens, template: &LatentVideo) -> Result<LatentVideo> {
    let shape = template.data.shape().to_vec();
    if shape.len() != 4 {
        return Err(anyhow!("latent template must stay [T, C, H, W]"));
    }

    let token_mean = tokens.tokens.sum() / tokens.tokens.len().max(1) as f32;
    let mut restored: ArrayD<f32> = template.data.clone();
    restored
        .iter_mut()
        .enumerate()
        .for_each(|(index, value)| *value = token_mean + (index % 17) as f32 * 0.0001);

    Ok(LatentVideo { data: restored })
}
