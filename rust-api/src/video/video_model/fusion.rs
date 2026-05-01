use ndarray::{ArrayD, IxDyn};

use crate::video::video_model::audio_encoder::encode_audio;
use crate::video::video_model::multimodal::MultimodalCondition;
use crate::video::video_model::text_encoder::encode_text;

pub struct MultiModalTokens {
    pub tokens: ArrayD<f32>,
}

pub fn fuse_modalities(cond: &MultimodalCondition) -> MultiModalTokens {
    let text_vec = encode_text(&cond.text);
    let emotion_vec = encode_text(&cond.emotion);
    let mut all: Vec<Vec<f32>> = vec![text_vec, emotion_vec];

    if let Some(dialogue) = &cond.dialogue {
        all.push(encode_text(dialogue));
    }

    if let Some(audio) = &cond.audio_features {
        all.push(encode_audio(audio));
    }

    let n = all.len().max(1);
    let dim = all.first().map(|v| v.len()).unwrap_or(1024);
    let mut flat = Vec::with_capacity(n * dim);
    for values in all {
        flat.extend(values);
    }

    let tokens = ArrayD::from_shape_vec(IxDyn(&[n, dim]), flat).expect("multimodal token shape");
    MultiModalTokens { tokens }
}
