use anyhow::Result;
use ndarray::Array2;

use crate::video::video_model::trajectory::{MotionField, MotionTrajectory};

pub fn build_motion_field(
    trajectories: &[MotionTrajectory],
    num_tokens: usize,
) -> Result<MotionField> {
    let mut field = Array2::<f32>::zeros((num_tokens.max(1), 2));

    for trajectory in trajectories {
        for (index, point) in trajectory.points.iter().enumerate() {
            let token_index = (point.t * num_tokens.max(1) as f32) as usize % num_tokens.max(1);

            if index > 0 {
                let prev = &trajectory.points[index - 1];
                let dx = point.x - prev.x;
                let dy = point.y - prev.y;
                field[[token_index, 0]] += dx;
                field[[token_index, 1]] += dy;
            }
        }
    }

    Ok(MotionField { field })
}
