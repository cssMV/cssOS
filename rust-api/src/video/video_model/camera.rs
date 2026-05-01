pub struct Camera {
    pub position: [f32; 3],
    pub look_at: [f32; 3],
}

pub fn project_point(p: [f32; 3], cam: &Camera) -> [f32; 2] {
    let dx = p[0] - cam.position[0];
    let dy = p[1] - cam.position[1];
    let dz = p[2] - cam.position[2];
    let z = dz.max(0.001);
    [dx / z, dy / z]
}
