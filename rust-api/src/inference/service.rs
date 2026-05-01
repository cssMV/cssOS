use std::sync::{Mutex, OnceLock};

use axum::{routing::post, Json, Router};
use serde::{Deserialize, Serialize};

use crate::inference::cache::Cache;
use crate::inference::scheduler::{select_config, InferenceConfig};
use crate::video::video_model::camera::Camera;
use crate::video::video_model::consistency::{build_consistency_field, empty_consistency};
use crate::video::video_model::decoder::decode_video;
use crate::video::video_model::dit::DiffusionTransformer;
use crate::video::video_model::fusion::fuse_modalities;
use crate::video::video_model::motion::build_motion_field;
use crate::video::video_model::multimodal::MultimodalCondition;
use crate::video::video_model::noise::init_noise;
use crate::video::video_model::pipeline::apply_tokens_to_latent;
use crate::video::video_model::scheduler::get_timesteps;
use crate::video::video_model::tokenizer::to_spacetime_tokens;
use crate::video::video_model::types::LatentVideo;

#[derive(Deserialize)]
pub struct GenerateReq {
    pub prompt: String,
}

#[derive(Serialize)]
pub struct GenerateResp {
    pub video_url: String,
}

fn cache() -> &'static Mutex<Cache> {
    static CACHE: OnceLock<Mutex<Cache>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(Cache::new()))
}

fn quick_cond(prompt: &str) -> MultimodalCondition {
    MultimodalCondition {
        text: prompt.to_string(),
        emotion: String::new(),
        dialogue: None,
        audio_features: None,
        trajectories: vec![],
        scene_3d: None,
    }
}

fn latent_from_noise(config: &InferenceConfig) -> LatentVideo {
    let frames = (config.steps.max(8) / 2).max(8);
    let side = (config.resolution / 2).max(64);
    LatentVideo {
        data: init_noise(&[frames, 4, side, side]),
    }
}

pub fn generate_fast(prompt: &str, config: InferenceConfig) -> String {
    let mut latent = latent_from_noise(&config);
    let model = DiffusionTransformer::new(512);
    let multimodal = quick_cond(prompt);

    for timestep in get_timesteps(config.steps) {
        let tokens = match to_spacetime_tokens(&latent) {
            Ok(tokens) => tokens,
            Err(_) => break,
        };
        let num_tokens = tokens.tokens.shape()[0];
        let motion = match build_motion_field(&multimodal.trajectories, num_tokens) {
            Ok(motion) => motion,
            Err(_) => break,
        };
        let consistency = if let Some(scene) = &multimodal.scene_3d {
            match build_consistency_field(
                scene,
                &Camera {
                    position: [0.0, 0.0, -5.0],
                    look_at: [0.0, 0.0, 0.0],
                },
                num_tokens,
                model.dim,
            ) {
                Ok(field) => field,
                Err(_) => break,
            }
        } else {
            empty_consistency(num_tokens, model.dim)
        };
        let multimodal_tokens = fuse_modalities(&multimodal);
        let next = match model.forward(&tokens, &multimodal_tokens, &motion, &consistency, timestep)
        {
            Ok(tokens) => tokens,
            Err(_) => break,
        };
        if apply_tokens_to_latent(&mut latent, &next).is_err() {
            break;
        }
    }

    decode_video(&latent).unwrap_or_default()
}

pub fn run_inference(prompt: &str) -> String {
    if let Some(hit) = cache().lock().ok().and_then(|guard| guard.get(prompt)) {
        return hit;
    }

    let config = select_config(true);
    let video = generate_fast(prompt, config);

    if let Ok(mut guard) = cache().lock() {
        guard.set(prompt.to_string(), video.clone());
    }

    video
}

pub async fn generate(Json(req): Json<GenerateReq>) -> Json<GenerateResp> {
    let video = run_inference(&req.prompt);
    Json(GenerateResp { video_url: video })
}

pub fn router() -> Router {
    Router::new().route("/generate", post(generate))
}
