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

pub fn music_stems_dir(run_dir: &Path) -> PathBuf {
    run_dir.join("./build/stems")
}

pub fn vocals_wav_path(run_dir: &Path) -> PathBuf {
    run_dir.join("./build/vocals.wav")
}

pub fn vocals_dir(run_dir: &Path) -> PathBuf {
    run_dir.join("./build/vocals")
}

pub fn lead_vocal_guide_wav_path(run_dir: &Path) -> PathBuf {
    vocals_dir(run_dir).join("lead_vocal_guide.wav")
}

pub fn backing_vocal_guide_wav_path(run_dir: &Path) -> PathBuf {
    vocals_dir(run_dir).join("backing_vocal_guide.wav")
}

pub fn lead_singing_voice_wav_path(run_dir: &Path) -> PathBuf {
    vocals_dir(run_dir).join("lead_singing_voice.wav")
}

pub fn backing_singing_voice_wav_path(run_dir: &Path) -> PathBuf {
    vocals_dir(run_dir).join("backing_singing_voice.wav")
}

pub fn vocal_master_wav_path(run_dir: &Path) -> PathBuf {
    vocals_dir(run_dir).join("vocal_master.wav")
}

pub fn mix_wav_path(run_dir: &Path) -> PathBuf {
    run_dir.join("./build/mix.wav")
}

pub fn master_wav_path(run_dir: &Path) -> PathBuf {
    run_dir.join("./build/master.wav")
}

pub fn music_mp3_path(run_dir: &Path) -> PathBuf {
    run_dir.join("./build/music.mp3")
}

pub fn vocals_mp3_path(run_dir: &Path) -> PathBuf {
    run_dir.join("./build/vocals.mp3")
}

pub fn mix_mp3_path(run_dir: &Path) -> PathBuf {
    run_dir.join("./build/mix.mp3")
}

pub fn master_mp3_path(run_dir: &Path) -> PathBuf {
    run_dir.join("./build/master.mp3")
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

pub fn normalize_access_tier(raw: &str) -> &'static str {
    match raw.trim().to_ascii_lowercase().as_str() {
        "admin" => "admin",
        "vip" => "vip",
        "enterprise" => "enterprise",
        "studio" => "studio",
        "pro" => "pro",
        "starter" => "starter",
        "free" => "free",
        _ => "guest",
    }
}

pub fn is_pro_plus_tier(raw: &str) -> bool {
    matches!(
        normalize_access_tier(raw),
        "pro" | "studio" | "enterprise" | "vip" | "admin"
    )
}

pub fn load_run_access_tier(run_dir: &Path) -> String {
    let state_path = run_dir.join("run.json");
    std::fs::read(&state_path)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<crate::run_state::RunState>(&bytes).ok())
        .map(|state| state.tier)
        .unwrap_or_else(|| "free".to_string())
}

pub fn should_retain_lossless_audio(run_dir: &Path) -> bool {
    let env_value = std::env::var("CSS_AUDIO_DELIVERY_RETAIN_WAV")
        .unwrap_or_else(|_| "0".to_string())
        .trim()
        .to_ascii_lowercase();
    if !matches!(env_value.as_str(), "1" | "true" | "yes" | "on") {
        return false;
    }
    let tier = load_run_access_tier(run_dir);
    is_pro_plus_tier(&tier)
}

pub async fn transcode_wav_to_mp3(
    ffmpeg_bin: &str,
    input_path: &Path,
    output_path: &Path,
) -> Result<()> {
    if tokio::fs::metadata(input_path).await.is_err() {
        return Ok(());
    }
    ensure_parent(output_path).await?;
    let status = Command::new(ffmpeg_bin)
        .arg("-y")
        .arg("-hide_banner")
        .arg("-loglevel")
        .arg("error")
        .arg("-i")
        .arg(input_path)
        .arg("-vn")
        .arg("-codec:a")
        .arg("libmp3lame")
        .arg("-q:a")
        .arg("2")
        .arg(output_path)
        .status()
        .await?;
    if !status.success() {
        return Err(anyhow!(
            "ffmpeg mp3 transcode failed for {}",
            input_path.display()
        ));
    }
    Ok(())
}

pub async fn finalize_audio_delivery_assets(ctx: &EngineCtx) -> Result<()> {
    let primary_pairs = [
        (music_wav_path(&ctx.run_dir), music_mp3_path(&ctx.run_dir)),
        (vocals_wav_path(&ctx.run_dir), vocals_mp3_path(&ctx.run_dir)),
        (mix_wav_path(&ctx.run_dir), mix_mp3_path(&ctx.run_dir)),
        (master_wav_path(&ctx.run_dir), master_mp3_path(&ctx.run_dir)),
    ];
    for (wav_path, mp3_path) in &primary_pairs {
        transcode_wav_to_mp3(&ctx.ffmpeg, wav_path, mp3_path).await?;
    }
    let vocal_pairs = [
        (
            vocal_master_wav_path(&ctx.run_dir),
            ctx.run_dir.join("./build/vocals/vocal_master.mp3"),
        ),
        (
            lead_singing_voice_wav_path(&ctx.run_dir),
            ctx.run_dir.join("./build/vocals/lead_singing_voice.mp3"),
        ),
        (
            backing_singing_voice_wav_path(&ctx.run_dir),
            ctx.run_dir.join("./build/vocals/backing_singing_voice.mp3"),
        ),
    ];
    for (wav_path, mp3_path) in &vocal_pairs {
        transcode_wav_to_mp3(&ctx.ffmpeg, wav_path, mp3_path).await?;
    }

    if should_retain_lossless_audio(&ctx.run_dir) {
        return Ok(());
    }

    let cleanup_dirs = [
        ctx.run_dir.join("./build/stems"),
        ctx.run_dir.join("./build/vocals"),
    ];
    for dir in cleanup_dirs {
        if let Ok(mut entries) = tokio::fs::read_dir(&dir).await {
            while let Ok(Some(entry)) = entries.next_entry().await {
                let path = entry.path();
                let lower = path.to_string_lossy().to_ascii_lowercase();
                if lower.ends_with(".wav") {
                    let _ = tokio::fs::remove_file(path).await;
                }
            }
        }
    }

    for (wav_path, _mp3_path) in &primary_pairs {
        let _ = tokio::fs::remove_file(wav_path).await;
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

    if let Some(segments) = v.get("segments").and_then(|x| x.as_array()) {
        for (idx, segment) in segments.iter().enumerate() {
            let scene_id = segment
                .get("scene_id")
                .and_then(|x| x.as_str())
                .unwrap_or("");
            let shot_id = segment
                .get("shot_id")
                .and_then(|x| x.as_str())
                .unwrap_or("");
            let label = segment.get("label").and_then(|x| x.as_str()).unwrap_or("");
            let start_s = segment
                .get("start_s")
                .and_then(|x| x.as_f64())
                .unwrap_or(-1.0);
            let end_s = segment
                .get("end_s")
                .and_then(|x| x.as_f64())
                .unwrap_or(-1.0);
            let duration_s = segment
                .get("duration_s")
                .and_then(|x| x.as_f64())
                .unwrap_or(-1.0);

            if scene_id.is_empty() {
                return Err(anyhow!("video plan segment {} missing scene_id", idx));
            }
            if shot_id.is_empty() {
                return Err(anyhow!("video plan segment {} missing shot_id", idx));
            }
            if label.trim().is_empty() {
                return Err(anyhow!("video plan segment {} missing label", idx));
            }
            if start_s < 0.0 || end_s <= start_s || duration_s <= 0.0 {
                return Err(anyhow!("video plan segment {} has invalid timing", idx));
            }
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
