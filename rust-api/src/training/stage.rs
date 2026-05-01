#[derive(Debug, Clone)]
pub struct CurriculumStage {
    pub name: String,
    pub max_motion: f32,
    pub max_objects: usize,
    pub max_scene_complexity: usize,
    pub min_duration: f32,
    pub max_duration: f32,
}
