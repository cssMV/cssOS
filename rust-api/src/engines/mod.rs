use anyhow::{anyhow, Result};
use serde_json::Value;
use std::path::{Path, PathBuf};
use tokio::process::Command;

pub mod lyrics;
pub mod mix;
pub mod music;
pub mod render;
pub mod subtitles;
pub mod video;
pub mod video_assemble;
pub mod vocals;

#[derive(Clone)]
pub struct EngineCtx {
    pub run_dir: PathBuf,
    pub ffmpeg: String,
}

impl EngineCtx {
    pub fn new(run_dir: PathBuf) -> Self {
        Self {
            run_dir,
            ffmpeg: std::env::var("CSS_FFMPEG").unwrap_or_else(|_| "ffmpeg".into()),
        }
    }
}

pub async fn write_json(path: &Path, v: &Value) -> Result<()> {
    ensure_parent(path).await?;
    tokio::fs::write(path, serde_json::to_vec_pretty(v)?).await?;
    Ok(())
}

pub async fn run_cmd(cmdline: &str, cwd: &Path, extra_env: &[(&str, String)]) -> Result<()> {
    let mut cmd = Command::new("sh");
    cmd.arg("-lc").arg(cmdline).current_dir(cwd);
    for (k, v) in extra_env {
        cmd.env(k, v);
    }
    let out = cmd.output().await?;
    if !out.status.success() {
        return Err(anyhow!(
            "engine command failed: status={:?}, stderr={}",
            out.status.code(),
            String::from_utf8_lossy(&out.stderr)
        ));
    }
    Ok(())
}

pub fn env_cmd(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|s| !s.trim().is_empty())
}

pub fn title_hint(commands: &Value) -> String {
    commands
        .get("title_hint")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string()
}

pub fn primary_lang(commands: &Value, ui_lang: &str) -> String {
    commands
        .get("lyrics")
        .and_then(|x| x.get("primary_lang"))
        .and_then(|x| x.as_str())
        .unwrap_or(ui_lang)
        .to_string()
}

pub fn lyrics_json_path(run_dir: &Path) -> PathBuf {
    run_dir.join("./build/lyrics.json")
}

pub fn music_wav_path(run_dir: &Path) -> PathBuf {
    run_dir.join("./build/music.wav")
}

pub fn vocals_wav_path(run_dir: &Path) -> PathBuf {
    run_dir.join("./build/vocals.wav")
}

pub fn mix_wav_path(run_dir: &Path) -> PathBuf {
    run_dir.join("./build/mix.wav")
}

pub fn subtitles_ass_path(run_dir: &Path) -> PathBuf {
    run_dir.join("./build/subtitles.ass")
}

pub fn video_mp4_path(run_dir: &Path) -> PathBuf {
    run_dir.join("./build/video/video.mp4")
}

pub fn render_mp4_path(run_dir: &Path) -> PathBuf {
    run_dir.join("./build/final_mv.mp4")
}

pub async fn ensure_parent(path: &Path) -> Result<()> {
    if let Some(p) = path.parent() {
        tokio::fs::create_dir_all(p).await?;
    }
    Ok(())
}

pub fn file_bytes(path: &Path) -> Result<u64> {
    Ok(std::fs::metadata(path)?.len())
}

pub async fn write_stub_ass(path: &Path, lang: &str) -> Result<()> {
    ensure_parent(path).await?;
    let body = format!(
        "[Script Info]\nScriptType: v4.00+\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,54,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,3,0,2,40,40,40,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:00.00,0:00:02.00,Default,,0,0,0,,({}) cssMV\n",
        lang
    );
    tokio::fs::write(path, body).await?;
    Ok(())
}

pub async fn validate_wav_output(path: &Path, min_bytes: u64) -> Result<()> {
    let meta = tokio::fs::metadata(path).await?;
    if !meta.is_file() {
        return Err(anyhow!("output is not a file: {}", path.display()));
    }
    if meta.len() < min_bytes {
        return Err(anyhow!(
            "output too small: {} bytes at {}",
            meta.len(),
            path.display()
        ));
    }
    Ok(())
}

pub async fn validate_lyrics_json_input(path: &Path) -> Result<()> {
    let text = tokio::fs::read_to_string(path).await?;
    let v: Value = serde_json::from_str(&text)?;
    if !v.get("schema").and_then(|x| x.as_str()).is_some() {
        return Err(anyhow!("lyrics json missing schema: {}", path.display()));
    }
    if !v.get("lang").and_then(|x| x.as_str()).is_some() {
        return Err(anyhow!("lyrics json missing lang: {}", path.display()));
    }
    if !v.get("lines").and_then(|x| x.as_array()).is_some() {
        return Err(anyhow!("lyrics json missing lines: {}", path.display()));
    }
    Ok(())
}

pub async fn validate_lyrics_output(path: &Path) -> Result<()> {
    let meta = tokio::fs::metadata(path).await?;
    if !meta.is_file() {
        return Err(anyhow!("lyrics output is not a file: {}", path.display()));
    }
    if meta.len() < 16 {
        return Err(anyhow!(
            "lyrics output too small: {} bytes at {}",
            meta.len(),
            path.display()
        ));
    }

    let raw = tokio::fs::read(path).await?;
    let v: Value = serde_json::from_slice(&raw)?;

    let schema = v.get("schema").and_then(|x| x.as_str()).unwrap_or("");
    if schema.is_empty() {
        return Err(anyhow!("lyrics output missing schema"));
    }
    let lang = v.get("lang").and_then(|x| x.as_str()).unwrap_or("");
    if lang.is_empty() {
        return Err(anyhow!("lyrics output missing lang"));
    }

    let lines = v
        .get("lines")
        .and_then(|x| x.as_array())
        .ok_or_else(|| anyhow!("lyrics output missing lines"))?;
    if lines.is_empty() {
        return Err(anyhow!("lyrics output lines is empty"));
    }

    let mut non_empty = 0usize;
    for (idx, line) in lines.iter().enumerate() {
        let t_ok = line.get("t").and_then(|x| x.as_f64()).is_some();
        let text = line.get("text").and_then(|x| x.as_str()).unwrap_or("");
        if !t_ok {
            return Err(anyhow!("lyrics line {} missing numeric t", idx));
        }
        if !text.trim().is_empty() {
            non_empty += 1;
        }
    }
    if non_empty == 0 {
        return Err(anyhow!("lyrics output has no non-empty lines"));
    }
    Ok(())
}

pub async fn validate_ass_output(path: &Path) -> Result<()> {
    let meta = tokio::fs::metadata(path).await?;
    if !meta.is_file() {
        return Err(anyhow!(
            "subtitles output is not a file: {}",
            path.display()
        ));
    }
    if meta.len() < 32 {
        return Err(anyhow!(
            "subtitles output too small: {} bytes at {}",
            meta.len(),
            path.display()
        ));
    }

    let raw = tokio::fs::read_to_string(path).await?;
    if !raw.contains("[Script Info]") {
        return Err(anyhow!("subtitles output missing [Script Info]"));
    }
    if !raw.contains("[Events]") {
        return Err(anyhow!("subtitles output missing [Events]"));
    }
    if !raw.contains("Dialogue:") {
        return Err(anyhow!("subtitles output missing Dialogue"));
    }
    Ok(())
}

pub async fn validate_mp4_output(path: &Path, ffprobe_bin: Option<&str>) -> Result<()> {
    let meta = tokio::fs::metadata(path).await?;
    if !meta.is_file() {
        return Err(anyhow!("render output is not a file: {}", path.display()));
    }
    if meta.len() < 4096 {
        return Err(anyhow!(
            "render output too small: {} bytes at {}",
            meta.len(),
            path.display()
        ));
    }

    let ffprobe = ffprobe_bin.unwrap_or("ffprobe");
    let out = tokio::process::Command::new(ffprobe)
        .arg("-v")
        .arg("error")
        .arg("-show_entries")
        .arg("stream=codec_type")
        .arg("-of")
        .arg("json")
        .arg(path)
        .output()
        .await?;

    if !out.status.success() {
        return Err(anyhow!("ffprobe failed for {}", path.display()));
    }

    let v: Value = serde_json::from_slice(&out.stdout)?;
    let streams = v
        .get("streams")
        .and_then(|x| x.as_array())
        .ok_or_else(|| anyhow!("ffprobe output missing streams"))?;

    let mut has_video = false;
    let mut has_audio = false;
    for s in streams {
        match s.get("codec_type").and_then(|x| x.as_str()) {
            Some("video") => has_video = true,
            Some("audio") => has_audio = true,
            _ => {}
        }
    }

    if !has_video {
        return Err(anyhow!("render output missing video stream"));
    }
    if !has_audio {
        return Err(anyhow!("render output missing audio stream"));
    }
    Ok(())
}

pub async fn validate_video_plan_output(path: &Path) -> Result<()> {
    let meta = tokio::fs::metadata(path).await?;
    if !meta.is_file() {
        return Err(anyhow!(
            "video plan output is not a file: {}",
            path.display()
        ));
    }
    if meta.len() < 16 {
        return Err(anyhow!(
            "video plan output too small: {} bytes at {}",
            meta.len(),
            path.display()
        ));
    }

    let raw = tokio::fs::read(path).await?;
    let v: Value = serde_json::from_slice(&raw)?;

    let schema = v.get("schema").and_then(|x| x.as_str()).unwrap_or("");
    if schema.is_empty() {
        return Err(anyhow!("video plan missing schema"));
    }

    let lang = v.get("lang").and_then(|x| x.as_str()).unwrap_or("");
    if lang.is_empty() {
        return Err(anyhow!("video plan missing lang"));
    }

    let shots = v
        .get("shots")
        .and_then(|x| x.as_array())
        .ok_or_else(|| anyhow!("video plan missing shots"))?;

    if shots.is_empty() {
        return Err(anyhow!("video plan shots is empty"));
    }

    for (idx, shot) in shots.iter().enumerate() {
        let id = shot.get("id").and_then(|x| x.as_str()).unwrap_or("");
        let prompt = shot.get("prompt").and_then(|x| x.as_str()).unwrap_or("");
        let dur = shot
            .get("duration_s")
            .and_then(|x| x.as_f64())
            .unwrap_or(0.0);

        if id.is_empty() {
            return Err(anyhow!("video plan shot {} missing id", idx));
        }
        if prompt.trim().is_empty() {
            return Err(anyhow!("video plan shot {} missing prompt", idx));
        }
        if dur <= 0.0 {
            return Err(anyhow!("video plan shot {} invalid duration_s", idx));
        }
    }

    Ok(())
}

pub async fn validate_video_mp4_output(path: &Path, ffprobe_bin: Option<&str>) -> Result<()> {
    let meta = tokio::fs::metadata(path).await?;
    if !meta.is_file() {
        return Err(anyhow!(
            "video shot output is not a file: {}",
            path.display()
        ));
    }
    if meta.len() < 4096 {
        return Err(anyhow!(
            "video shot output too small: {} bytes at {}",
            meta.len(),
            path.display()
        ));
    }

    let ffprobe = ffprobe_bin.unwrap_or("ffprobe");
    let out = tokio::process::Command::new(ffprobe)
        .arg("-v")
        .arg("error")
        .arg("-show_entries")
        .arg("stream=codec_type")
        .arg("-of")
        .arg("json")
        .arg(path)
        .output()
        .await?;

    if !out.status.success() {
        return Err(anyhow!("ffprobe failed for {}", path.display()));
    }

    let v: Value = serde_json::from_slice(&out.stdout)?;
    let streams = v
        .get("streams")
        .and_then(|x| x.as_array())
        .ok_or_else(|| anyhow!("ffprobe output missing streams"))?;

    let mut has_video = false;
    for s in streams {
        if s.get("codec_type").and_then(|x| x.as_str()) == Some("video") {
            has_video = true;
        }
    }

    if !has_video {
        return Err(anyhow!("video shot output missing video stream"));
    }

    Ok(())
}
