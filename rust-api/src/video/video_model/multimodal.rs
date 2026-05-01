use crate::video::video_model::geometry::Scene3D;
use crate::video::video_model::trajectory::MotionTrajectory;

#[derive(Debug, Clone)]
pub struct MultimodalCondition {
    pub text: String,
    pub emotion: String,
    pub dialogue: Option<String>,
    pub audio_features: Option<Vec<f32>>,
    pub trajectories: Vec<MotionTrajectory>,
    pub scene_3d: Option<Scene3D>,
}
