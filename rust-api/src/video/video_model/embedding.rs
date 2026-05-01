use anyhow::Result;
use ndarray::{Array2, ArrayD, IxDyn};

use crate::video::video_model::camera::Camera;
use crate::video::video_model::condition::{ConditionInput, ConditionTokens};
use crate::video::video_model::consistency::{build_consistency_field, ConsistencyField};
use crate::video::video_model::motion::build_motion_field;
use crate::video::video_model::trajectory::MotionField;

const EMBED_DIM: usize = 1024;

fn text_embed(text: &str) -> Vec<f32> {
    let mut values = vec![0.0; EMBED_DIM];
    for (index, byte) in text.bytes().enumerate() {
        values[index % EMBED_DIM] += byte as f32 / 255.0;
    }
    values
}

pub fn encode_condition(cond: &ConditionInput) -> Result<ConditionTokens> {
    let mut all_tokens: Vec<Vec<f32>> = Vec::new();

    all_tokens.push(text_embed(&cond.prompt));

    for character in &cond.characters {
        all_tokens.push(text_embed(character));
    }

    for action in &cond.actions {
        all_tokens.push(text_embed(action));
    }

    for environment in &cond.environment {
        all_tokens.push(text_embed(environment));
    }

    if let Some(camera) = &cond.camera {
        all_tokens.push(text_embed(camera));
    }

    if let Some(style) = &cond.style {
        all_tokens.push(text_embed(style));
    }

    let token_count = all_tokens.len().max(1);
    let mut flattened = Vec::with_capacity(token_count * EMBED_DIM);
    for token in all_tokens {
        flattened.extend(token);
    }

    let tokens = ArrayD::from_shape_vec(IxDyn(&[token_count, EMBED_DIM]), flattened)?;
    Ok(ConditionTokens { tokens })
}

pub fn encode_condition_with_motion(
    cond: &ConditionInput,
    num_tokens: usize,
) -> Result<(ConditionTokens, MotionField)> {
    let cond_tokens = encode_condition(cond)?;
    let motion = build_motion_field(&cond.trajectories, num_tokens)?;
    Ok((cond_tokens, motion))
}

pub fn encode_condition_full(
    cond: &ConditionInput,
    num_tokens: usize,
    dim: usize,
) -> Result<(ConditionTokens, MotionField, ConsistencyField)> {
    let cond_tokens = encode_condition(cond)?;
    let motion = build_motion_field(&cond.trajectories, num_tokens)?;

    let consistency = if let Some(scene) = &cond.scene_3d {
        let cam = Camera {
            position: [0.0, 0.0, -5.0],
            look_at: [0.0, 0.0, 0.0],
        };
        build_consistency_field(scene, &cam, num_tokens, dim)?
    } else {
        ConsistencyField {
            field: Array2::zeros((num_tokens.max(1), dim.max(1))),
        }
    };

    Ok((cond_tokens, motion, consistency))
}
