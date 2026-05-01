use ndarray::{ArrayD, IxDyn};
use rand::Rng;

pub fn init_noise(shape: &[usize]) -> ArrayD<f32> {
    let mut rng = rand::thread_rng();
    let total: usize = shape.iter().product();
    let data: Vec<f32> = (0..total).map(|_| rng.gen::<f32>() * 2.0 - 1.0).collect();
    ArrayD::from_shape_vec(IxDyn(shape), data).expect("noise shape must be valid")
}
