use std::fs;
use std::process::Command;

use anyhow::{anyhow, Result};

use crate::data_pipeline::decode::VideoProbe;
use crate::data_pipeline::schema::{ClipRecord, RawVideoRecord};

pub fn segment_video_fixed(
    video: &RawVideoRecord,
    probe: &VideoProbe,
    clip_len_sec: f32,
    output_dir: &str,
) -> Result<Vec<ClipRecord>> {
    fs::create_dir_all(output_dir)?;

    let mut clips = Vec::new();
    let mut start = 0.0f32;
    let mut idx = 0usize;

    while start + clip_len_sec <= probe.duration_sec {
        let end = start + clip_len_sec;
        let clip_id = format!("{}_clip_{:05}", video.id, idx);
        let clip_path = format!("{}/{}.mp4", output_dir, clip_id);

        let status = Command::new("ffmpeg")
            .args([
                "-y",
                "-ss",
                &format!("{start}"),
                "-i",
                &video.local_path,
                "-t",
                &format!("{clip_len_sec}"),
                "-an",
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                &clip_path,
            ])
            .status()?;

        if !status.success() {
            return Err(anyhow!("ffmpeg segment failed"));
        }

        clips.push(ClipRecord {
            clip_id,
            video_id: video.id.clone(),
            start_sec: start,
            end_sec: end,
            fps: probe.fps.round() as u32,
            width: probe.width,
            height: probe.height,
            clip_path,
        });

        start += clip_len_sec;
        idx += 1;
    }

    Ok(clips)
}
