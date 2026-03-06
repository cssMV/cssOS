use crate::video::hw::{HwMode, HwPlan};
use std::path::{Path, PathBuf};
use tokio::process::Command;

fn env_str(k: &str, d: &str) -> String {
    std::env::var(k).unwrap_or_else(|_| d.to_string())
}

pub fn ffmpeg_common_threads_args() -> Vec<String> {
    let threads = env_str("CSS_FFMPEG_THREADS", "0");
    let filter_threads = env_str("CSS_FFMPEG_FILTER_THREADS", "8");
    vec![
        "-threads".into(),
        threads,
        "-filter_threads".into(),
        filter_threads,
    ]
}

pub fn ffmpeg_hw_input_args(plan: &HwPlan) -> Vec<String> {
    match plan.mode {
        HwMode::Vaapi => {
            let dev = plan
                .vaapi_device
                .clone()
                .unwrap_or_else(|| "/dev/dri/renderD128".into());
            vec!["-vaapi_device".into(), dev]
        }
        _ => vec![],
    }
}

pub fn ffmpeg_encoder_args(plan: &HwPlan) -> Vec<String> {
    match plan.mode {
        HwMode::Nvenc => vec![
            "-c:v".into(),
            "h264_nvenc".into(),
            "-preset".into(),
            env_str("CSS_NVENC_PRESET", "p4"),
            "-rc".into(),
            env_str("CSS_NVENC_RC", "vbr"),
            "-cq".into(),
            env_str("CSS_NVENC_CQ", "21"),
        ],
        HwMode::Vaapi => vec![
            "-c:v".into(),
            "h264_vaapi".into(),
            "-qp".into(),
            env_str("CSS_VAAPI_QP", "22"),
        ],
        HwMode::Cpu => vec![
            "-c:v".into(),
            "libx264".into(),
            "-preset".into(),
            env_str("CSS_X264_PRESET", "veryfast"),
            "-crf".into(),
            env_str("CSS_X264_CRF", "21"),
        ],
    }
}

pub fn build_color_source_filter(color: &str, w: u32, h: u32, fps: u32, dur_s: f64) -> String {
    let d = format!("{:.3}", dur_s.max(0.001));
    format!("color=c={}:s={}x{}:r={}:d={}", color, w, h, fps, d)
}

pub fn build_filter_chain(plan: &HwPlan, w: u32, h: u32) -> String {
    match plan.mode {
        HwMode::Nvenc => {
            format!(
                "format=rgba,hwupload_cuda,scale_cuda=w={}:h={},format=nv12",
                w, h
            )
        }
        HwMode::Vaapi => {
            format!("format=nv12,hwupload,scale_vaapi=w={}:h={}", w, h)
        }
        HwMode::Cpu => {
            format!("scale=w={}:h={},format=yuv420p", w, h)
        }
    }
}

pub async fn concat_mp4_ffmpeg(shots: &[PathBuf], out_mp4: &Path) -> Result<(), String> {
    let mut list = String::new();
    for p in shots {
        let s = p.to_string_lossy().replace('\'', "'\\''");
        list.push_str(&format!("file '{}'\n", s));
    }
    let dir = out_mp4.parent().unwrap_or(Path::new("."));
    let list_path = dir.join("shots.txt");
    if tokio::fs::write(&list_path, list).await.is_err() {
        return Err("write concat list failed".into());
    }

    let status = Command::new("ffmpeg")
        .arg("-y")
        .arg("-hide_banner")
        .arg("-loglevel")
        .arg(env_str("CSS_FFMPEG_LOGLEVEL", "error"))
        .arg("-f")
        .arg("concat")
        .arg("-safe")
        .arg("0")
        .arg("-i")
        .arg(list_path)
        .arg("-c")
        .arg("copy")
        .arg(out_mp4)
        .status()
        .await
        .map_err(|e| format!("spawn ffmpeg concat failed: {e}"))?;

    if !status.success() {
        return Err(format!("ffmpeg concat failed: {status}"));
    }
    Ok(())
}

pub async fn concat_mp4_ffmpeg_copy(list_txt: &Path, out_mp4: &Path) -> Result<(), String> {
    let status = Command::new("ffmpeg")
        .arg("-y")
        .arg("-hide_banner")
        .arg("-loglevel")
        .arg(env_str("CSS_FFMPEG_LOGLEVEL", "error"))
        .arg("-f")
        .arg("concat")
        .arg("-safe")
        .arg("0")
        .arg("-i")
        .arg(list_txt)
        .arg("-c")
        .arg("copy")
        .arg(out_mp4)
        .status()
        .await
        .map_err(|e| e.to_string())?;
    if !status.success() {
        return Err(format!("ffmpeg concat copy failed: {status}"));
    }
    Ok(())
}

pub async fn concat_mp4_ffmpeg_reencode(list_txt: &Path, out_mp4: &Path) -> Result<(), String> {
    let status = Command::new("ffmpeg")
        .arg("-y")
        .arg("-hide_banner")
        .arg("-loglevel")
        .arg(env_str("CSS_FFMPEG_LOGLEVEL", "error"))
        .arg("-f")
        .arg("concat")
        .arg("-safe")
        .arg("0")
        .arg("-i")
        .arg(list_txt)
        .arg("-c:v")
        .arg("libx264")
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg("-movflags")
        .arg("+faststart")
        .arg(out_mp4)
        .status()
        .await
        .map_err(|e| e.to_string())?;
    if !status.success() {
        return Err(format!("ffmpeg concat reencode failed: {status}"));
    }
    Ok(())
}

async fn run_ok(mut cmd: Command) -> Result<(), String> {
    let out = cmd.output().await.map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(())
    } else {
        let code = out.status.code().unwrap_or(-1);
        let stderr = String::from_utf8_lossy(&out.stderr).to_string();
        Err(format!("ffmpeg exit={} stderr={}", code, stderr))
    }
}

pub async fn mux_av_copy_first(
    in_video: &Path,
    in_audio: &Path,
    out_mp4: &Path,
) -> Result<(), String> {
    let out_dir = out_mp4.parent().unwrap_or_else(|| Path::new("."));
    let _ = tokio::fs::create_dir_all(out_dir).await;

    let r1 = run_ok({
        let mut c = Command::new("ffmpeg");
        c.arg("-y")
            .arg("-hide_banner")
            .arg("-loglevel")
            .arg("error")
            .arg("-i")
            .arg(in_video)
            .arg("-i")
            .arg(in_audio)
            .arg("-map")
            .arg("0:v:0")
            .arg("-map")
            .arg("1:a:0")
            .arg("-c:v")
            .arg("copy")
            .arg("-c:a")
            .arg("aac")
            .arg("-b:a")
            .arg("192k")
            .arg("-shortest")
            .arg("-movflags")
            .arg("+faststart")
            .arg(out_mp4);
        c
    })
    .await;
    if r1.is_ok() {
        return Ok(());
    }

    run_ok({
        let mut c = Command::new("ffmpeg");
        c.arg("-y")
            .arg("-hide_banner")
            .arg("-loglevel")
            .arg("error")
            .arg("-i")
            .arg(in_video)
            .arg("-i")
            .arg(in_audio)
            .arg("-map")
            .arg("0:v:0")
            .arg("-map")
            .arg("1:a:0")
            .arg("-c:v")
            .arg("libx264")
            .arg("-preset")
            .arg("veryfast")
            .arg("-crf")
            .arg("20")
            .arg("-c:a")
            .arg("aac")
            .arg("-b:a")
            .arg("192k")
            .arg("-shortest")
            .arg("-movflags")
            .arg("+faststart")
            .arg(out_mp4);
        c
    })
    .await
}

pub fn default_render_inputs(run_dir: &Path) -> (PathBuf, PathBuf, PathBuf) {
    (
        run_dir.join("build/video/video.mp4"),
        run_dir.join("build/vocals.wav"),
        run_dir.join("build/final_mv.mp4"),
    )
}

pub async fn mux_final_copy(
    video_mp4: &Path,
    audio_path: &Path,
    out_mp4: &Path,
) -> Result<(), String> {
    let status = Command::new("ffmpeg")
        .arg("-y")
        .arg("-hide_banner")
        .arg("-loglevel")
        .arg(env_str("CSS_FFMPEG_LOGLEVEL", "error"))
        .arg("-i")
        .arg(video_mp4)
        .arg("-i")
        .arg(audio_path)
        .arg("-map")
        .arg("0:v:0")
        .arg("-map")
        .arg("1:a:0")
        .arg("-c:v")
        .arg("copy")
        .arg("-c:a")
        .arg("aac")
        .arg("-b:a")
        .arg("192k")
        .arg("-movflags")
        .arg("+faststart")
        .arg(out_mp4)
        .status()
        .await
        .map_err(|e| e.to_string())?;
    if !status.success() {
        return Err(format!("ffmpeg mux copy failed: {status}"));
    }
    Ok(())
}

pub async fn mux_final_reencode(
    video_mp4: &Path,
    audio_path: &Path,
    out_mp4: &Path,
) -> Result<(), String> {
    let status = Command::new("ffmpeg")
        .arg("-y")
        .arg("-hide_banner")
        .arg("-loglevel")
        .arg(env_str("CSS_FFMPEG_LOGLEVEL", "error"))
        .arg("-i")
        .arg(video_mp4)
        .arg("-i")
        .arg(audio_path)
        .arg("-map")
        .arg("0:v:0")
        .arg("-map")
        .arg("1:a:0")
        .arg("-c:v")
        .arg("libx264")
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg("-preset")
        .arg(env_str("CSS_X264_PRESET", "veryfast"))
        .arg("-crf")
        .arg(env_str("CSS_X264_CRF", "20"))
        .arg("-c:a")
        .arg("aac")
        .arg("-b:a")
        .arg("192k")
        .arg("-movflags")
        .arg("+faststart")
        .arg(out_mp4)
        .status()
        .await
        .map_err(|e| e.to_string())?;
    if !status.success() {
        return Err(format!("ffmpeg mux reencode failed: {status}"));
    }
    Ok(())
}
