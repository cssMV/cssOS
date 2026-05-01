use anyhow::Result;
use image::{Rgb, RgbImage};

use crate::video::video_model::types::LatentVideo;

pub fn render_latent_to_frames(latent: &LatentVideo) -> Result<Vec<RgbImage>> {
    let shape = latent.data.shape();
    let t = shape[0];
    let h = 256u32;
    let w = 256u32;

    let mut frames = Vec::with_capacity(t);
    for frame_idx in 0..t {
        let mut img = RgbImage::new(w, h);
        for x in 0..w {
            for y in 0..h {
                let val = latent.data[[frame_idx, 0, (x as usize) % 64, (y as usize) % 64]];
                let r = ((val + 1.0) * 127.0).clamp(0.0, 255.0) as u8;
                let g = ((val * 0.5 + 0.5) * 255.0).clamp(0.0, 255.0) as u8;
                let b = ((1.0 - val) * 255.0).clamp(0.0, 255.0) as u8;
                img.put_pixel(x, y, Rgb([r, g, b]));
            }
        }
        frames.push(img);
    }

    Ok(frames)
}
