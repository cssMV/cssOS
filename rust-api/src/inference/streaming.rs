use anyhow::Result;

use crate::video::video_model::camera::Camera;
use crate::video::video_model::consistency::{build_consistency_field, empty_consistency};
use crate::video::video_model::dit::DiffusionTransformer;
use crate::video::video_model::fusion::fuse_modalities;
use crate::video::video_model::motion::build_motion_field;
use crate::video::video_model::multimodal::MultimodalCondition;
use crate::video::video_model::pipeline::apply_tokens_to_latent;
use crate::video::video_model::scheduler::get_timesteps;
use crate::video::video_model::tokenizer::to_spacetime_tokens;
use crate::video::video_model::types::LatentVideo;

fn quick_multimodal(prompt: &str) -> MultimodalCondition {
    MultimodalCondition {
        text: prompt.to_string(),
        emotion: String::new(),
        dialogue: None,
        audio_features: None,
        trajectories: vec![],
        scene_3d: None,
    }
}

pub fn stream_video_generation(
    mut latent: LatentVideo,
    model: &DiffusionTransformer,
    prompt: &str,
) -> Result<Vec<LatentVideo>> {
    let mut outputs = Vec::new();
    let multimodal = quick_multimodal(prompt);

    for timestep in get_timesteps(20) {
        let tokens = to_spacetime_tokens(&latent)?;
        let num_tokens = tokens.tokens.shape()[0];
        let motion = build_motion_field(&multimodal.trajectories, num_tokens)?;
        let consistency = if let Some(scene) = &multimodal.scene_3d {
            build_consistency_field(
                scene,
                &Camera {
                    position: [0.0, 0.0, -5.0],
                    look_at: [0.0, 0.0, 0.0],
                },
                num_tokens,
                model.dim,
            )?
        } else {
            empty_consistency(num_tokens, model.dim)
        };
        let multimodal_tokens = fuse_modalities(&multimodal);
        let next = model.forward(&tokens, &multimodal_tokens, &motion, &consistency, timestep)?;

        apply_tokens_to_latent(&mut latent, &next)?;
        outputs.push(latent.clone());
    }

    Ok(outputs)
}
