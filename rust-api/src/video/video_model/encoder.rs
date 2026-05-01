use anyhow::Result;

use crate::video::video_model::noise::init_noise;
use crate::video::video_model::types::{LatentVideo, VideoCondition};

pub fn encode_to_latent(cond: &VideoCondition) -> Result<LatentVideo> {
    let t = (cond.duration.max(1.0) * cond.fps.max(1) as f32).round() as usize;
    let latent = init_noise(&[t.max(2) / 2, 4, 64, 64]);
    Ok(LatentVideo { data: latent })
}
