use super::*;
use anyhow::Result;
use serde_json::json;

async fn file_exists(path: &std::path::Path) -> bool {
    tokio::fs::metadata(path).await.is_ok()
}

async fn write_mix_bus_plan(run_dir: &std::path::Path) -> Result<()> {
    write_json(
        &run_dir.join("./build/mix.bus.json"),
        &json!({
            "schema": "css.mix.bus.v1",
            "buses": [
                { "busId": "harmony", "sources": ["./build/stems/pad.wav", "./build/stems/strings.wav", "./build/stems/plucks.wav", "./build/stems/choir.wav"] },
                { "busId": "motif", "sources": ["./build/stems/lead.wav", "./build/stems/counter.wav"] },
                { "busId": "low_end", "sources": ["./build/stems/bass.wav", "./build/stems/sub.wav"] },
                { "busId": "rhythm", "sources": ["./build/stems/drums.wav", "./build/stems/percussion.wav"] },
                { "busId": "fx", "sources": ["./build/stems/fx.wav", "./build/stems/impacts.wav"] },
                { "busId": "vocals", "sources": ["./build/vocals/lead_singing_voice.wav", "./build/vocals/backing_singing_voice.wav", "./build/vocals/vocal_master.wav"] }
            ]
        }),
    ).await
}

pub async fn run(ctx: &EngineCtx, commands: &serde_json::Value, ui_lang: &str) -> Result<()> {
    let _lang = primary_lang(commands, ui_lang);
    let music = music_wav_path(&ctx.run_dir);
    let vocals = vocals_wav_path(&ctx.run_dir);
    let out = mix_wav_path(&ctx.run_dir);
    let master = master_wav_path(&ctx.run_dir);
    let lead_singing = lead_singing_voice_wav_path(&ctx.run_dir);
    let backing_singing = backing_singing_voice_wav_path(&ctx.run_dir);
    let vocal_master = vocal_master_wav_path(&ctx.run_dir);
    write_mix_bus_plan(&ctx.run_dir).await?;

    if let Some(cmdline) = env_cmd("CSS_MIX_CMD") {
        run_cmd(
            &cmdline,
            &ctx.run_dir,
            &[
                ("CSS_MUSIC_WAV", music.to_string_lossy().to_string()),
                ("CSS_VOCALS_WAV", vocals.to_string_lossy().to_string()),
                ("CSS_OUT_WAV", out.to_string_lossy().to_string()),
                ("CSS_MASTER_WAV", master.to_string_lossy().to_string()),
            ],
        )
        .await?;
        validate_wav_output(&out, 4096).await?;
        if tokio::fs::metadata(&master).await.is_err() {
            tokio::fs::copy(&out, &master).await?;
        }
    } else {
        ensure_parent(&out).await?;
        ensure_parent(&master).await?;
        let stems_dir = music_stems_dir(&ctx.run_dir);
        let use_stem_mix = file_exists(&stems_dir.join("pad.wav")).await
            && file_exists(&stems_dir.join("lead.wav")).await
            && file_exists(&stems_dir.join("bass.wav")).await
            && file_exists(&lead_singing).await
            && file_exists(&backing_singing).await;
        let status = if use_stem_mix {
            tokio::process::Command::new(&ctx.ffmpeg)
                .arg("-y")
                .arg("-loglevel")
                .arg("error")
                .arg("-i").arg(stems_dir.join("pad.wav"))
                .arg("-i").arg(stems_dir.join("strings.wav"))
                .arg("-i").arg(stems_dir.join("plucks.wav"))
                .arg("-i").arg(stems_dir.join("choir.wav"))
                .arg("-i").arg(stems_dir.join("lead.wav"))
                .arg("-i").arg(stems_dir.join("counter.wav"))
                .arg("-i").arg(stems_dir.join("bass.wav"))
                .arg("-i").arg(stems_dir.join("sub.wav"))
                .arg("-i").arg(stems_dir.join("drums.wav"))
                .arg("-i").arg(stems_dir.join("percussion.wav"))
                .arg("-i").arg(stems_dir.join("fx.wav"))
                .arg("-i").arg(stems_dir.join("impacts.wav"))
                .arg("-i").arg(&lead_singing)
                .arg("-i").arg(&backing_singing)
                .arg("-i").arg(&vocal_master)
                .arg("-filter_complex")
                .arg("[0:a][1:a][2:a][3:a]amix=inputs=4:normalize=0,volume=1.18,highpass=f=40,lowpass=f=15500,acompressor=threshold=-18dB:ratio=2.2:attack=15:release=180[h];[4:a][5:a]amix=inputs=2:normalize=0,volume=1.08,equalizer=f=2600:t=q:w=1.0:g=1.8[m];[6:a][7:a]amix=inputs=2:normalize=0,volume=1.26,lowpass=f=220,acompressor=threshold=-18dB:ratio=2.8:attack=8:release=140[l];[8:a][9:a]amix=inputs=2:normalize=0,volume=1.18,highpass=f=45,acompressor=threshold=-14dB:ratio=2.4:attack=4:release=120[r];[10:a][11:a]amix=inputs=2:normalize=0,volume=0.9,highpass=f=120[fx];[12:a][13:a][14:a]amix=inputs=3:normalize=0,volume=1.58,highpass=f=110,deesser=i=0.4:m=0.5:f=0.6,acompressor=threshold=-19dB:ratio=3.8:attack=3:release=110[v];[h][m][l][r][fx][v]amix=inputs=6:normalize=0,acompressor=threshold=-14dB:ratio=2.1:attack=9:release=150,equalizer=f=85:t=q:w=1.0:g=2.4,equalizer=f=3200:t=q:w=1.2:g=1.8,alimiter=limit=0.96[a]")
                .arg("-map").arg("[a]")
                .arg("-ar").arg("48000")
                .arg("-ac").arg("2")
                .arg(&out)
                .status()
                .await?
        } else {
            tokio::process::Command::new(&ctx.ffmpeg)
                .arg("-y")
                .arg("-loglevel")
                .arg("error")
                .arg("-i")
                .arg(&music)
                .arg("-i")
                .arg(&vocals)
                .arg("-filter_complex")
                .arg("[0:a]volume=1.35,highpass=f=28,lowpass=f=16500,acompressor=threshold=-16dB:ratio=2.5:attack=10:release=180[m];[1:a]volume=1.65,highpass=f=120,deesser=i=0.4:m=0.5:f=0.6,acompressor=threshold=-20dB:ratio=3.5:attack=3:release=120[v];[m][v]amix=inputs=2:duration=longest:normalize=0,acompressor=threshold=-14dB:ratio=2.0:attack=8:release=140,equalizer=f=90:t=q:w=1.0:g=2,equalizer=f=3200:t=q:w=1.2:g=1.6,alimiter=limit=0.95[a]")
                .arg("-map")
                .arg("[a]")
                .arg("-ar")
                .arg("48000")
                .arg("-ac")
                .arg("2")
                .arg(&out)
                .status()
                .await?
        };
        if !status.success() {
            anyhow::bail!("mix ffmpeg amix failed");
        }
        tokio::fs::copy(&out, &master).await?;
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
    validate_wav_output(&master, 4096).await?;
    transcode_wav_to_mp3(&ctx.ffmpeg, &out, &mix_mp3_path(&ctx.run_dir)).await?;
    transcode_wav_to_mp3(&ctx.ffmpeg, &master, &master_mp3_path(&ctx.run_dir)).await?;

    Ok(())
}
