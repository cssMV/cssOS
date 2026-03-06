use crate::video::hw::{HwMode, HwPlan};
use crate::video::storyboard::{Camera, StoryboardV1};
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct ShotParams {
    pub id: String,
    pub color: String,
    pub w: u32,
    pub h: u32,
    pub fps: u32,
    pub duration_s: f64,
    pub camera: Option<Camera>,
}

fn frames(fps: u32, duration_s: f64) -> u32 {
    let n = (duration_s.max(0.001) * fps as f64).round() as i64;
    n.max(1) as u32
}

fn clamp_strength(x: f64) -> f64 {
    if x.is_nan() {
        0.0
    } else {
        x.max(0.0).min(1.0)
    }
}

fn camera_vf(cam: &Camera, fps: u32, duration_s: f64) -> String {
    let _ = cam;
    let _ = fps;
    let _ = duration_s;
    "null".to_string()
}

pub fn lavfi_color_source(color: &str, w: u32, h: u32, fps: u32, duration_s: f64) -> String {
    let d = format!("{:.3}", duration_s.max(0.001));
    format!("color=c={}:s={}x{}:r={}:d={}", color, w, h, fps, d)
}

pub fn build_vf(plan: &HwPlan, p: &ShotParams) -> String {
    let mut parts: Vec<String> = Vec::new();
    if let Some(cam) = &p.camera {
        let cvf = camera_vf(cam, p.fps, p.duration_s);
        if cvf != "null" {
            parts.push(cvf);
        }
    }
    match plan.mode {
        HwMode::Nvenc => {
            parts.push("format=rgba".to_string());
            parts.push("hwupload_cuda".to_string());
            parts.push(format!("scale_cuda=w={}:h={}", p.w, p.h));
            parts.push("format=nv12".to_string());
        }
        HwMode::Vaapi => {
            parts.push("format=nv12".to_string());
            parts.push("hwupload".to_string());
            parts.push(format!("scale_vaapi=w={}:h={}", p.w, p.h));
        }
        HwMode::Cpu => {
            parts.push(format!("scale=w={}:h={}", p.w, p.h));
            parts.push("format=yuv420p".to_string());
        }
    }
    parts.join(",")
}

pub fn video_shot_ids(sb: &StoryboardV1) -> Vec<String> {
    sb.shots.iter().map(|s| s.id.clone()).collect()
}

pub fn shot_out_path(out_dir: &PathBuf, shot_id: &str) -> PathBuf {
    out_dir
        .join("build")
        .join("video")
        .join("shots")
        .join(format!("{shot_id}.mp4"))
}
