use anyhow::Result;

use crate::video::backend::types::SceneInput as BackendSceneInput;
use crate::video::video_model::condition::build_condition_from_scene;
use crate::video::video_model::pipeline::generate_video_with_condition;
use crate::video::video_model::types::VideoCondition;

pub fn render_scene_local(api_key: &str, scene: &BackendSceneInput) -> Result<String> {
    match std::env::var("CSS_VIDEO_EXECUTION_MODE")
        .unwrap_or_else(|_| "temporal_latent".to_string())
        .as_str()
    {
        "sora_like" => {
            let _ = api_key;
            let base = VideoCondition {
                prompt: scene.visual_script.clone(),
                duration: scene.duration_secs,
                fps: 24,
            };
            let cond = build_condition_from_scene(scene);
            Ok(generate_video_with_condition(cond, base)?.path)
        }
        "direct_render" => crate::video::direct_render::render_scene_direct(
            api_key,
            scene,
            scene.section_type.as_deref(),
        ),
        _ => crate::video::temporal_latent::render_scene_temporal_latent(api_key, scene),
    }
}
