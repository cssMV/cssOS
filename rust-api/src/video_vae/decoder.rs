use tch::Tensor;

pub fn decode_video(model: &crate::video_vae::model::VideoVAE, z: &Tensor) -> Tensor {
    model.decode(z)
}
