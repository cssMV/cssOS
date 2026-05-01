pub fn get_timesteps(steps: usize) -> Vec<f32> {
    let steps = steps.max(1);
    let mut timesteps = Vec::with_capacity(steps);
    for i in 0..steps {
        let timestep = (steps - i) as f32 / steps as f32;
        timesteps.push(timestep);
    }
    timesteps
}
