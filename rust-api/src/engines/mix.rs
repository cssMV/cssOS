use super::*;
use anyhow::Result;

pub async fn run(ctx: &EngineCtx, commands: &serde_json::Value, ui_lang: &str) -> Result<()> {
    let _lang = primary_lang(commands, ui_lang);
    let music = music_wav_path(&ctx.run_dir);
    let vocals = vocals_wav_path(&ctx.run_dir);
    let out = mix_wav_path(&ctx.run_dir);

    if let Some(cmdline) = env_cmd("CSS_MIX_CMD") {
        run_cmd(
            &cmdline,
            &ctx.run_dir,
            &[
                ("CSS_MUSIC_WAV", music.to_string_lossy().to_string()),
                ("CSS_VOCALS_WAV", vocals.to_string_lossy().to_string()),
                ("CSS_OUT_WAV", out.to_string_lossy().to_string()),
            ],
        )
        .await?;
        validate_wav_output(&out, 4096).await?;
    } else {
        ensure_parent(&out).await?;
        let status = tokio::process::Command::new(&ctx.ffmpeg)
            .arg("-y")
            .arg("-loglevel")
            .arg("error")
            .arg("-i")
            .arg(&music)
            .arg("-i")
            .arg(&vocals)
            .arg("-filter_complex")
            .arg("[0:a][1:a]amix=inputs=2:duration=longest:normalize=0[a]")
            .arg("-map")
            .arg("[a]")
            .arg("-ar")
            .arg("48000")
            .arg("-ac")
            .arg("2")
            .arg(&out)
            .status()
            .await?;
        if !status.success() {
            anyhow::bail!("mix ffmpeg amix failed");
        }
        validate_wav_output(&out, 4096).await?;
    }

    let qc = crate::quality_config::load_quality_config();
    let gate1 = crate::quality_gates::gate_audio_duration(&out, qc.min_audio_duration_s).await?;
    if !gate1.ok {
        return Err(crate::quality_gates::fail_gate(gate1));
    }
    let gate2 = crate::quality_gates::gate_audio_not_silent(&out, qc.min_mix_peak_db).await?;
    if !gate2.ok {
        return Err(crate::quality_gates::fail_gate(gate2));
    }

    Ok(())
}
