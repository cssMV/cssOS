#[derive(Debug, Clone)]
pub struct Object3D {
    pub id: String,
    pub position: [f32; 3],
    pub velocity: [f32; 3],
}

#[derive(Debug, Clone)]
pub struct Scene3D {
    pub objects: Vec<Object3D>,
}
