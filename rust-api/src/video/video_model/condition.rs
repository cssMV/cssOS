use ndarray::ArrayD;

use crate::video::video_model::geometry::Scene3D;
use crate::video::video_model::trajectory::MotionTrajectory;

#[derive(Debug, Clone)]
pub struct ConditionInput {
    pub prompt: String,
    pub characters: Vec<String>,
    pub actions: Vec<String>,
    pub environment: Vec<String>,
    pub camera: Option<String>,
    pub style: Option<String>,
    pub trajectories: Vec<MotionTrajectory>,
    pub scene_3d: Option<Scene3D>,
}

pub struct ConditionTokens {
    pub tokens: ArrayD<f32>,
}

pub fn build_condition_from_scene(
    scene: &crate::video::backend::types::SceneInput,
) -> ConditionInput {
    ConditionInput {
        prompt: scene.visual_script.clone(),
        characters: vec![],
        actions: vec![],
        environment: vec![],
        camera: None,
        style: None,
        trajectories: vec![],
        scene_3d: None,
    }
}
