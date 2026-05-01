use tch::Tensor;

pub fn quantize(tensor: &Tensor) -> Tensor {
    tensor.to_kind(tch::Kind::Half)
}
