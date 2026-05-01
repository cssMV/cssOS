use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use anyhow::{anyhow, Result};
use image::Pixel;

fn ensure_tmp_dir() -> Result<PathBuf> {
    let dir = PathBuf::from("data/tmp");
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn extract_frame(video_path: &str, frame_index: usize, output_path: &Path) -> Result<()> {
    let output = output_path
        .to_str()
        .ok_or_else(|| anyhow!("invalid frame output path"))?;
    let status = Command::new("ffmpeg")
        .args([
            "-y",
            "-i",
            video_path,
            "-vf",
            &format!("select=eq(n\\,{frame_index})"),
            "-vsync",
            "vfr",
            output,
        ])
        .status()?;

    if !status.success() {
        return Err(anyhow!("ffmpeg frame extraction failed"));
    }

    Ok(())
}

pub fn is_not_black_frame(path: &str) -> Result<bool> {
    let img = image::open(path)?.to_rgb8();
    let mut sum = 0.0f32;

    for pixel in img.pixels() {
        let channels = pixel.channels();
        sum += channels[0] as f32 + channels[1] as f32 + channels[2] as f32;
    }

    let avg = sum / (img.width() * img.height()) as f32;
    Ok(avg > 10.0)
}

pub fn has_motion(video_path: &str) -> Result<bool> {
    let tmp_dir = ensure_tmp_dir()?;
    let frame_a = tmp_dir.join("motion_frame_01.png");
    let frame_b = tmp_dir.join("motion_frame_02.png");

    extract_frame(video_path, 0, &frame_a)?;
    extract_frame(video_path, 10, &frame_b)?;

    if !is_not_black_frame(
        frame_a
            .to_str()
            .ok_or_else(|| anyhow!("invalid frame path"))?,
    )? {
        return Ok(false);
    }

    if !is_not_black_frame(
        frame_b
            .to_str()
            .ok_or_else(|| anyhow!("invalid frame path"))?,
    )? {
        return Ok(false);
    }

    let first = image::open(&frame_a)?.to_rgb8();
    let second = image::open(&frame_b)?.to_rgb8();
    let width = first.width().min(second.width());
    let height = first.height().min(second.height());
    let mut diff = 0.0f32;

    for y in 0..height {
        for x in 0..width {
            let p1 = first.get_pixel(x, y).channels();
            let p2 = second.get_pixel(x, y).channels();
            diff += (p1[0] as f32 - p2[0] as f32).abs();
            diff += (p1[1] as f32 - p2[1] as f32).abs();
            diff += (p1[2] as f32 - p2[2] as f32).abs();
        }
    }

    Ok(diff > 1_000.0)
}

pub fn is_valid_clip(path: &str) -> Result<bool> {
    if !has_motion(path)? {
        return Ok(false);
    }

    Ok(true)
}
