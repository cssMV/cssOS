use ndarray::Array2;

#[derive(Debug, Clone)]
pub struct MotionPoint {
    pub t: f32,
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Clone)]
pub struct MotionTrajectory {
    pub object_id: String,
    pub points: Vec<MotionPoint>,
}

#[derive(Debug, Clone)]
pub struct MotionField {
    pub field: Array2<f32>,
}
