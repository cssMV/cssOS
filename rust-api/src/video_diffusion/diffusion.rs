use tch::Tensor;

pub fn add_noise(x: &Tensor, t: f64) -> (Tensor, Tensor) {
    let noise = Tensor::randn_like(x);
    let alpha = (1.0 - t).sqrt();
    let beta = t.sqrt();
    let noisy = x * alpha + &noise * beta;
    (noisy, noise)
}
