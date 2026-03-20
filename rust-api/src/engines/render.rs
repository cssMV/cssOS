use super::*;
use anyhow::{anyhow, Result};

pub async fn run(ctx: &EngineCtx, commands: &serde_json::Value, ui_lang: &str) -> Result<()> {
    let lang = primary_lang(commands, ui_lang);
    let video = video_mp4_path(&ctx.run_dir);
    let audio = mix_wav_path(&ctx.run_dir);
    let subtitles = subtitles_ass_path(&ctx.run_dir);
    let out = render_mp4_path(&ctx.run_dir);

    if !video.exists() {
        return Err(anyhow!("render input missing: {}", video.display()));
    }
    if !audio.exists() {
        return Err(anyhow!("render input missing: {}", audio.display()));
    }
    if !subtitles.exists() {
        return Err(anyhow!("render input missing: {}", subtitles.display()));
    }

    if let Some(cmdline) = env_cmd("CSS_RENDER_CMD") {
        run_cmd(
            &cmdline,
            &ctx.run_dir,
            &[
                ("CSS_LANG", lang.clone()),
                ("CSS_VIDEO_MP4", video.to_string_lossy().to_string()),
                ("CSS_MIX_WAV", audio.to_string_lossy().to_string()),
                ("CSS_SUB_ASS", subtitles.to_string_lossy().to_string()),
                ("CSS_OUT_MP4", out.to_string_lossy().to_string()),
            ],
        )
        .await?;
        validate_mp4_output(&out, Some("ffprobe")).await?;
        let qc = crate::quality_config::load_quality_config();
        let gate = crate::quality_gates::gate_video_duration(&out, qc.min_video_duration_s).await?;
        if !gate.ok {
            return Err(crate::quality_gates::fail_gate(gate));
        }
        let gate_av =
            crate::quality_gates::gate_av_duration_delta(&out, &audio, qc.max_av_duration_delta_s)
                .await?;
        if !gate_av.ok {
            return Err(crate::quality_gates::fail_gate(gate_av));
        }
        return Ok(());
    }

    ensure_parent(&out).await?;
    let copy = tokio::process::Command::new(&ctx.ffmpeg)
        .arg("-y")
        .arg("-loglevel")
        .arg("error")
        .arg("-i")
        .arg(&video)
        .arg("-i")
        .arg(&audio)
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
        .arg(&out)
        .status()
        .await?;

    if !copy.success() {
        let enc = tokio::process::Command::new(&ctx.ffmpeg)
            .arg("-y")
            .arg("-loglevel")
            .arg("error")
            .arg("-i")
            .arg(&video)
            .arg("-i")
            .arg(&audio)
            .arg("-map")
            .arg("0:v:0")
            .arg("-map")
            .arg("1:a:0")
            .arg("-c:v")
            .arg("libx264")
            .arg("-preset")
            .arg("veryfast")
            .arg("-crf")
            .arg("18")
            .arg("-c:a")
            .arg("aac")
            .arg("-b:a")
            .arg("192k")
            .arg("-shortest")
            .arg("-movflags")
            .arg("+faststart")
            .arg(&out)
            .status()
            .await?;

        if !enc.success() {
            anyhow::bail!("render mux failed");
        }
    }

    validate_mp4_output(&out, Some("ffprobe")).await?;
    let qc = crate::quality_config::load_quality_config();
    let gate = crate::quality_gates::gate_video_duration(&out, qc.min_video_duration_s).await?;
    if !gate.ok {
        return Err(crate::quality_gates::fail_gate(gate));
    }
    let gate_av =
        crate::quality_gates::gate_av_duration_delta(&out, &audio, qc.max_av_duration_delta_s)
            .await?;
    if !gate_av.ok {
        return Err(crate::quality_gates::fail_gate(gate_av));
    }
    Ok(())
}
