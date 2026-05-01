use anyhow::Result;
use ndarray::Ix2;

use crate::video::video_model::attention::self_attention;
use crate::video::video_model::consistency::ConsistencyField;
use crate::video::video_model::cross_attention::cross_attention;
use crate::video::video_model::fusion::MultiModalTokens;
use crate::video::video_model::pos_encoding::build_positional_encoding;
use crate::video::video_model::trajectory::MotionField;
use crate::video::video_model::types::SpacetimeTokens;

pub struct DiffusionTransformer {
    pub dim: usize,
}

impl DiffusionTransformer {
    pub fn new(dim: usize) -> Self {
        Self { dim }
    }

    pub fn forward(
        &self,
        tokens: &SpacetimeTokens,
        multimodal: &MultiModalTokens,
        motion: &MotionField,
        consistency: &ConsistencyField,
        timestep: f32,
    ) -> Result<SpacetimeTokens> {
        let x = tokens.tokens.clone().into_dimensionality::<Ix2>()?;
        let cond_x = multimodal.tokens.clone().into_dimensionality::<Ix2>()?;

        let n = x.shape()[0];
        let token_dim = x.shape()[1];
        let pos = build_positional_encoding(n, token_dim);
        let x = x + pos;
        let x_attn = self_attention(&x, &x, &x)?;
        let cond_attn = cross_attention(&x_attn, &cond_x)?;

        let mut out = x_attn + cond_attn;
        let n = out.shape()[0];
        let dim = out.shape()[1];
        for i in 0..n {
            let dx = motion.field[[i, 0]];
            let dy = motion.field[[i, 1]];
            for j in 0..dim {
                out[[i, j]] += dx * 0.3 + dy * 0.3;
            }
        }
        for i in 0..n {
            for j in 0..dim {
                out[[i, j]] += consistency.field[[i, j]] * 0.2;
            }
        }
        out.mapv_inplace(|value| value.tanh());
        out.mapv_inplace(|value| value * (1.0 - timestep.clamp(0.0, 1.0)));

        Ok(SpacetimeTokens {
            tokens: out.into_dyn(),
        })
    }
}
