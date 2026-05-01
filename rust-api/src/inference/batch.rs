use tch::{Device, Tensor};

use crate::video_diffusion::unet3d::UNet3D;

pub fn batch_infer(inputs: Vec<Tensor>, model: &UNet3D) -> Vec<Tensor> {
    if inputs.is_empty() {
        return Vec::new();
    }

    let device = inputs.first().map(Tensor::device).unwrap_or(Device::Cpu);
    let batch = Tensor::stack(&inputs, 0).to_device(device);
    let timestep = Tensor::from(0.5f32).to_device(device);
    let out = model.forward(&batch, &timestep);
    out.unbind(0)
}
