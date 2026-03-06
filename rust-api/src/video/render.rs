use anyhow::{anyhow, Result};
use std::path::Path;
use tokio::process::Command;

async fn run_ffmpeg(argv: Vec<String>) -> Result<()> {
    let mut cmd = Command::new(&argv[0]);
    cmd.args(&argv[1..]);
    let out = cmd.output().await?;
    if !out.status.success() {
        let code = out.status.code().unwrap_or(-1);
        return Err(anyhow!(
            "ffmpeg failed exit={} stderr={}",
            code,
            String::from_utf8_lossy(&out.stderr)
        ));
    }
    Ok(())
}

fn env_str(k: &str, d: &str) -> String {
    std::env::var(k).ok().unwrap_or_else(|| d.to_string())
}

pub async fn render_zero_reencode(
    video_mp4: &Path,
    music_wav: &Path,
    vocals_wav: &Path,
    out_mp4: &Path,
) -> Result<()> {
    let audio_codec = env_str("CSS_RENDER_AUDIO_CODEC", "aac");
    let audio_bitrate = env_str("CSS_RENDER_AUDIO_BITRATE", "192k");
    let mix_vocals = env_str("CSS_RENDER_VOCALS_GAIN", "1.0");
    let mix_music = env_str("CSS_RENDER_MUSIC_GAIN", "1.0");

    let argv: Vec<String> = vec![
        "ffmpeg".into(),
        "-y".into(),
        "-hide_banner".into(),
        "-loglevel".into(),
        "error".into(),
        "-i".into(),
        video_mp4.display().to_string(),
        "-i".into(),
        music_wav.display().to_string(),
        "-i".into(),
        vocals_wav.display().to_string(),
        "-filter_complex".into(),
        format!(
            "[1:a]volume={mix_music}[m];[2:a]volume={mix_vocals}[v];[m][v]amix=inputs=2:normalize=0[a]"
        ),
        "-map".into(),
        "0:v:0".into(),
        "-map".into(),
        "[a]".into(),
        "-c:v".into(),
        "copy".into(),
        "-c:a".into(),
        audio_codec,
        "-b:a".into(),
        audio_bitrate,
        "-movflags".into(),
        "+faststart".into(),
        out_mp4.display().to_string(),
    ];

    run_ffmpeg(argv).await
}

pub async fn render_fallback_reencode(
    video_mp4: &Path,
    music_wav: &Path,
    vocals_wav: &Path,
    out_mp4: &Path,
) -> Result<()> {
    let vcodec = env_str("CSS_RENDER_VCODEC", "libx264");
    let preset = env_str("CSS_RENDER_PRESET", "veryfast");
    let crf = env_str("CSS_RENDER_CRF", "23");
    let audio_codec = env_str("CSS_RENDER_AUDIO_CODEC", "aac");
    let audio_bitrate = env_str("CSS_RENDER_AUDIO_BITRATE", "192k");
    let threads = env_str("CSS_FFMPEG_THREADS", "0");
    let filter_threads = env_str("CSS_FFMPEG_FILTER_THREADS", "8");
    let mix_vocals = env_str("CSS_RENDER_VOCALS_GAIN", "1.0");
    let mix_music = env_str("CSS_RENDER_MUSIC_GAIN", "1.0");

    let argv: Vec<String> = vec![
        "ffmpeg".into(),
        "-y".into(),
        "-hide_banner".into(),
        "-loglevel".into(),
        "error".into(),
        "-threads".into(),
        threads,
        "-filter_threads".into(),
        filter_threads,
        "-i".into(),
        video_mp4.display().to_string(),
        "-i".into(),
        music_wav.display().to_string(),
        "-i".into(),
        vocals_wav.display().to_string(),
        "-filter_complex".into(),
        format!(
            "[1:a]volume={mix_music}[m];[2:a]volume={mix_vocals}[v];[m][v]amix=inputs=2:normalize=0[a]"
        ),
        "-map".into(),
        "0:v:0".into(),
        "-map".into(),
        "[a]".into(),
        "-c:v".into(),
        vcodec,
        "-preset".into(),
        preset,
        "-crf".into(),
        crf,
        "-c:a".into(),
        audio_codec,
        "-b:a".into(),
        audio_bitrate,
        "-movflags".into(),
        "+faststart".into(),
        out_mp4.display().to_string(),
    ];

    run_ffmpeg(argv).await
}

pub async fn render_mv(
    video_mp4: &Path,
    music_wav: &Path,
    vocals_wav: &Path,
    out_mp4: &Path,
) -> Result<()> {
    let copy_first = std::env::var("CSS_RENDER_COPY_FIRST")
        .ok()
        .map(|v| v != "0")
        .unwrap_or(true);

    if copy_first
        && render_zero_reencode(video_mp4, music_wav, vocals_wav, out_mp4)
            .await
            .is_ok()
    {
        return Ok(());
    }

    render_fallback_reencode(video_mp4, music_wav, vocals_wav, out_mp4).await
}
