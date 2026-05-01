use anyhow::Result;
use tch::Tensor;

pub fn load_video_batch() -> Result<Tensor> {
    let batch = Tensor::rand(&[2, 3, 16, 128, 128], (tch::Kind::Float, tch::Device::Cpu));
    Ok(batch)
}
