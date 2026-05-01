use anyhow::Result;

use crate::video::renderer::render_scene_with_openai;
use crate::video::types::{SceneInput, SceneRenderPlan, SceneRenderResult};

pub fn generate_scene_videos(
    scenes: &[SceneInput],
    plans: &[SceneRenderPlan],
) -> Result<Vec<SceneRenderResult>> {
    let mut results = Vec::with_capacity(scenes.len());
    for scene in scenes {
        let plan = plans
            .iter()
            .find(|candidate| candidate.shot_plan.scene_id == scene.id)
            .expect("missing scene render plan");
        results.push(render_scene_with_openai(scene, plan)?);
    }
    Ok(results)
}
