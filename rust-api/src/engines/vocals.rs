use super::*;
use anyhow::Result;

pub async fn run(ctx: &EngineCtx, commands: &serde_json::Value, ui_lang: &str) -> Result<()> {
    let lang = primary_lang(commands, ui_lang);
    let voice = commands
        .get("vocals")
        .and_then(|x| x.get("voice"))
        .and_then(|x| x.as_str())
        .or_else(|| {
            commands
                .get("vocals")
                .and_then(|x| x.get("voices"))
                .and_then(|x| x.as_array())
                .and_then(|a| a.first())
                .and_then(|x| x.as_str())
        })
        .unwrap_or("female")
        .to_string();
    let lyrics = lyrics_json_path(&ctx.run_dir);
    let out = vocals_wav_path(&ctx.run_dir);
    validate_lyrics_json_input(&lyrics).await?;

    if let Some(cmdline) = env_cmd("CSS_VOCALS_CMD") {
        run_cmd(
            &cmdline,
            &ctx.run_dir,
            &[
                ("CSS_LANG", lang),
                ("CSS_VOICE", voice),
                ("CSS_LYRICS_JSON", lyrics.to_string_lossy().to_string()),
                ("CSS_OUT_WAV", out.to_string_lossy().to_string()),
                ("CSS_TITLE_HINT", title_hint(commands)),
            ],
        )
        .await?;
        validate_wav_output(&out, 4096).await?;
        let qc = crate::quality_config::load_quality_config();
        let gate = crate::quality_gates::gate_audio_duration(&out, qc.min_audio_duration_s).await?;
        if !gate.ok {
            return Err(crate::quality_gates::fail_gate(gate));
        }
        return Ok(());
    }

    ensure_parent(&out).await?;
    let status = tokio::process::Command::new(&ctx.ffmpeg)
        .arg("-y")
        .arg("-loglevel")
        .arg("error")
        .arg("-f")
        .arg("lavfi")
        .arg("-i")
        .arg("sine=frequency=660:sample_rate=48000")
        .arg("-t")
        .arg("8")
        .arg("-ac")
        .arg("1")
        .arg("-ar")
        .arg("48000")
        .arg(&out)
        .status()
        .await?;
    if !status.success() {
        anyhow::bail!("vocals fallback ffmpeg failed");
    }
    validate_wav_output(&out, 4096).await?;
    let qc = crate::quality_config::load_quality_config();
    let gate = crate::quality_gates::gate_audio_duration(&out, qc.min_audio_duration_s).await?;
    if !gate.ok {
        return Err(crate::quality_gates::fail_gate(gate));
    }
    Ok(())
}
