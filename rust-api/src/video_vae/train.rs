use std::fs;
use std::process::Command;

use anyhow::Result;
use tch::nn::OptimizerConfig;
use tch::{nn, Device, Tensor};

use crate::video_vae::loss::reconstruction_loss;
use crate::video_vae::model::VideoVAE;

pub fn train() -> Result<()> {
    let device = Device::cuda_if_available();
    let vs = nn::VarStore::new(device);
    let model = VideoVAE::new(&vs.root());
    let mut opt = nn::Adam::default().build(&vs, 1e-4)?;

    for epoch in 0..1000 {
        let video = load_batch()?.to_device(device);
        let z = model.encode(&video);
        let recon = model.decode(&z);
        let loss = reconstruction_loss(&video, &recon);
        opt.backward_step(&loss);
        println!("epoch {} loss {:?}", epoch, loss.double_value(&[]));
    }

    vs.save("video_vae.pt")?;
    Ok(())
}

pub fn load_batch() -> Result<Tensor> {
    let batch = Tensor::rand(&[4, 3, 16, 128, 128], (tch::Kind::Float, tch::Device::Cpu));
    Ok(batch)
}

pub fn decode_latent_to_video(latent: Tensor) -> Result<Tensor> {
    let device = Device::cuda_if_available();
    let mut vs = nn::VarStore::new(device);
    let model = VideoVAE::new(&vs.root());
    vs.load("video_vae.pt")?;
    Ok(model.decode(&latent.to_device(device)))
}

pub fn save_tensor_as_video(video: Tensor) -> Result<String> {
    fs::create_dir_all("output/video_vae_frames")?;
    let video = video.to_device(Device::Cpu);
    let size = video.size();
    let channels = size.get(1).copied().unwrap_or(3).max(1);
    let frames = size.get(2).copied().unwrap_or(1).max(1);
    let height = size.get(3).copied().unwrap_or(64).max(1) as u32;
    let width = size.get(4).copied().unwrap_or(64).max(1) as u32;

    for frame_idx in 0..frames {
        let frame = video.get(0).narrow(1, frame_idx, 1).squeeze_dim(1);
        let mut image = image::RgbImage::new(width, height);
        for y in 0..height {
            for x in 0..width {
                let r = read_channel(&frame, 0, y as i64, x as i64, channels);
                let g = read_channel(&frame, 1, y as i64, x as i64, channels);
                let b = read_channel(&frame, 2, y as i64, x as i64, channels);
                image.put_pixel(x, y, image::Rgb([r, g, b]));
            }
        }
        image.save(format!(
            "output/video_vae_frames/frame_{:04}.png",
            frame_idx
        ))?;
    }

    let output = "output/video_vae.mp4".to_string();
    Command::new("ffmpeg")
        .args([
            "-y",
            "-framerate",
            "24",
            "-i",
            "output/video_vae_frames/frame_%04d.png",
            "-pix_fmt",
            "yuv420p",
            &output,
        ])
        .output()?;
    Ok(output)
}

fn read_channel(frame: &Tensor, channel: i64, y: i64, x: i64, channels: i64) -> u8 {
    let idx = channel.min(channels - 1);
    let value = frame.double_value(&[idx, y, x]) as f32;
    (value.clamp(0.0, 1.0) * 255.0) as u8
}
