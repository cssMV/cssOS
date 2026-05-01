use anyhow::Result;
use ndarray::Array2;

use crate::video::video_model::camera::{project_point, Camera};
use crate::video::video_model::geometry::Scene3D;

#[derive(Debug, Clone)]
pub struct ConsistencyField {
    pub field: Array2<f32>,
}

pub fn build_consistency_field(
    scene: &Scene3D,
    cam: &Camera,
    num_tokens: usize,
    dim: usize,
) -> Result<ConsistencyField> {
    let mut field = Array2::<f32>::zeros((num_tokens.max(1), dim.max(1)));

    for object in &scene.objects {
        let screen = project_point(object.position, cam);
        let idx = ((screen[0].abs() * num_tokens.max(1) as f32) as usize) % num_tokens.max(1);

        for d in 0..dim.max(1) {
            field[[idx, d]] +=
                object.position[0] * 0.1 + object.position[1] * 0.1 + object.position[2] * 0.1;
        }
    }

    Ok(ConsistencyField { field })
}

pub fn empty_consistency(num_tokens: usize, dim: usize) -> ConsistencyField {
    ConsistencyField {
        field: Array2::zeros((num_tokens.max(1), dim.max(1))),
    }
}
