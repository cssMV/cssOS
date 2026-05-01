use tch::Tensor;

pub fn reconstruction_loss(x: &Tensor, recon: &Tensor) -> Tensor {
    (x - recon).pow_tensor_scalar(2).mean(tch::Kind::Float)
}
