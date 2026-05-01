use anyhow::Result;
use std::path::Path;

use crate::video::video_model::camera::Camera;
use crate::video::video_model::condition::ConditionInput;
use crate::video::video_model::consistency::{build_consistency_field, empty_consistency};
use crate::video::video_model::decoder::{decode_video, decode_video_to_path};
use crate::video::video_model::dit::DiffusionTransformer;
use crate::video::video_model::encoder::encode_to_latent;
use crate::video::video_model::fusion::fuse_modalities;
use crate::video::video_model::motion::build_motion_field;
use crate::video::video_model::multimodal::MultimodalCondition;
use crate::video::video_model::scheduler::get_timesteps;
use crate::video::video_model::tokenizer::to_spacetime_tokens;
use crate::video::video_model::types::{VideoCondition, VideoOutput};

pub fn generate_video(cond: VideoCondition) -> Result<VideoOutput> {
    let cond_input = ConditionInput {
        prompt: cond.prompt.clone(),
        characters: vec![],
        actions: vec![],
        environment: vec![],
        camera: None,
        style: None,
        trajectories: vec![],
        scene_3d: None,
    };
    let multimodal = MultimodalCondition {
        text: cond_input.prompt,
        emotion: String::new(),
        dialogue: None,
        audio_features: None,
        trajectories: cond_input.trajectories,
        scene_3d: cond_input.scene_3d,
    };
    generate_video_full(multimodal, cond)
}

pub fn generate_video_with_condition(
    cond_input: ConditionInput,
    base: VideoCondition,
) -> Result<VideoOutput> {
    let multimodal = MultimodalCondition {
        text: cond_input.prompt,
        emotion: String::new(),
        dialogue: None,
        audio_features: None,
        trajectories: cond_input.trajectories,
        scene_3d: cond_input.scene_3d,
    };
    generate_video_full(multimodal, base)
}

pub fn generate_video_with_condition_to_path(
    cond_input: ConditionInput,
    base: VideoCondition,
    output_path: &Path,
) -> Result<VideoOutput> {
    let multimodal = MultimodalCondition {
        text: cond_input.prompt,
        emotion: String::new(),
        dialogue: None,
        audio_features: None,
        trajectories: cond_input.trajectories,
        scene_3d: cond_input.scene_3d,
    };
    generate_video_full_to_path(multimodal, base, output_path)
}

pub fn generate_video_with_motion(
    cond_input: ConditionInput,
    base: VideoCondition,
) -> Result<VideoOutput> {
    let multimodal = MultimodalCondition {
        text: cond_input.prompt,
        emotion: String::new(),
        dialogue: None,
        audio_features: None,
        trajectories: cond_input.trajectories,
        scene_3d: cond_input.scene_3d,
    };
    generate_video_full(multimodal, base)
}

pub fn generate_video_final(
    cond_input: ConditionInput,
    base: VideoCondition,
) -> Result<VideoOutput> {
    let multimodal = MultimodalCondition {
        text: cond_input.prompt,
        emotion: String::new(),
        dialogue: None,
        audio_features: None,
        trajectories: cond_input.trajectories,
        scene_3d: cond_input.scene_3d,
    };
    generate_video_full(multimodal, base)
}

pub fn generate_video_full(cond: MultimodalCondition, base: VideoCondition) -> Result<VideoOutput> {
    let mut latent = encode_to_latent(&base)?;
    let mut tokens = to_spacetime_tokens(&latent)?;
    let num_tokens = tokens.tokens.shape()[0];
    let multimodal = fuse_modalities(&cond);
    let motion = build_motion_field(&cond.trajectories, num_tokens)?;

    let consistency = if let Some(scene) = &cond.scene_3d {
        build_consistency_field(
            scene,
            &Camera {
                position: [0.0, 0.0, -5.0],
                look_at: [0.0, 0.0, 0.0],
            },
            num_tokens,
            1024,
        )?
    } else {
        empty_consistency(num_tokens, 1024)
    };

    let model = DiffusionTransformer::new(1024);
    for timestep in get_timesteps(50) {
        tokens = model.forward(&tokens, &multimodal, &motion, &consistency, timestep)?;
        apply_tokens_to_latent(&mut latent, &tokens)?;
    }

    let path = decode_video(&latent)?;
    Ok(VideoOutput { path })
}

pub fn generate_video_full_to_path(
    cond: MultimodalCondition,
    base: VideoCondition,
    output_path: &Path,
) -> Result<VideoOutput> {
    let mut latent = encode_to_latent(&base)?;
    let mut tokens = to_spacetime_tokens(&latent)?;
    let num_tokens = tokens.tokens.shape()[0];
    let multimodal = fuse_modalities(&cond);
    let motion = build_motion_field(&cond.trajectories, num_tokens)?;

    let consistency = if let Some(scene) = &cond.scene_3d {
        build_consistency_field(
            scene,
            &Camera {
                position: [0.0, 0.0, -5.0],
                look_at: [0.0, 0.0, 0.0],
            },
            num_tokens,
            1024,
        )?
    } else {
        empty_consistency(num_tokens, 1024)
    };

    let model = DiffusionTransformer::new(1024);
    for timestep in get_timesteps(50) {
        tokens = model.forward(&tokens, &multimodal, &motion, &consistency, timestep)?;
        apply_tokens_to_latent(&mut latent, &tokens)?;
    }

    let path = decode_video_to_path(&latent, output_path, base.fps)?;
    Ok(VideoOutput { path })
}

pub fn apply_tokens_to_latent(
    latent: &mut crate::video::video_model::types::LatentVideo,
    tokens: &crate::video::video_model::types::SpacetimeTokens,
) -> Result<()> {
    let shape = latent.data.shape().to_vec();
    let t = shape[0].max(1);

    for i in 0..tokens.tokens.shape()[0] {
        let frame = i % t;
        let val = tokens.tokens[[i, 0]];
        latent.data[[frame, 0, 0, 0]] += val * 0.01;
    }

    Ok(())
}
