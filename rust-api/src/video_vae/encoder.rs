use tch::Tensor;

pub fn encode_video(model: &crate::video_vae::model::VideoVAE, x: &Tensor) -> Tensor {
    model.encode(x)
}
