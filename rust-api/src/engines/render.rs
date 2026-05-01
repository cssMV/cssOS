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

    let video_duration_s = crate::video::duration::probe_media_duration_s(&video)
        .await?
        .unwrap_or(0.0);
    let audio_duration_s = crate::video::duration::probe_media_duration_s(&audio)
        .await?
        .unwrap_or(0.0);
    let target_duration_s = if video_duration_s > 0.0 && audio_duration_s > 0.0 {
        video_duration_s.max(audio_duration_s)
    } else {
        video_duration_s.max(audio_duration_s)
    };

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
                ("CSS_TARGET_DURATION_S", format!("{target_duration_s:.3}")),
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
    let extend_video_s = (target_duration_s - video_duration_s).max(0.0);
    let needs_video_hold = extend_video_s > 0.05;

    let mux_status = if !needs_video_hold {
        tokio::process::Command::new(&ctx.ffmpeg)
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
            .arg("-t")
            .arg(format!("{target_duration_s:.3}"))
            .arg("-movflags")
            .arg("+faststart")
            .arg(&out)
            .status()
            .await?
    } else {
        tokio::process::Command::new(&ctx.ffmpeg)
            .arg("-y")
            .arg("-loglevel")
            .arg("error")
            .arg("-i")
            .arg(&video)
            .arg("-i")
            .arg(&audio)
            .arg("-filter_complex")
            .arg(format!(
                "[0:v]tpad=stop_mode=clone:stop_duration={extend_video_s:.3}[vout]"
            ))
            .arg("-map")
            .arg("[vout]")
            .arg("-map")
            .arg("1:a:0")
            .arg("-c:v")
            .arg("libx264")
            .arg("-preset")
            .arg("veryfast")
            .arg("-crf")
            .arg("18")
            .arg("-pix_fmt")
            .arg("yuv420p")
            .arg("-c:a")
            .arg("aac")
            .arg("-b:a")
            .arg("192k")
            .arg("-t")
            .arg(format!("{target_duration_s:.3}"))
            .arg("-movflags")
            .arg("+faststart")
            .arg(&out)
            .status()
            .await?
    };

    if !mux_status.success() {
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
            .arg("-pix_fmt")
            .arg("yuv420p")
            .arg("-c:a")
            .arg("aac")
            .arg("-b:a")
            .arg("192k")
            .arg("-vf")
            .arg(if needs_video_hold {
                format!("tpad=stop_mode=clone:stop_duration={extend_video_s:.3}")
            } else {
                "null".to_string()
            })
            .arg("-t")
            .arg(format!("{target_duration_s:.3}"))
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
    finalize_audio_delivery_assets(ctx).await?;
    Ok(())
}
