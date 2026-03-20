use super::*;
use anyhow::Result;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

pub fn storyboard_json_path(run_dir: &Path) -> PathBuf {
    run_dir.join("./build/video/storyboard.json")
}

pub fn shot_json_path(run_dir: &Path, shot_id: &str) -> PathBuf {
    run_dir.join(format!("./build/video/shots/{}.json", shot_id))
}

pub fn shot_mp4_path(run_dir: &Path, shot_id: &str) -> PathBuf {
    run_dir.join(format!("./build/video/shots/{}.mp4", shot_id))
}

pub async fn run_plan(ctx: &EngineCtx, commands: &Value, ui_lang: &str) -> Result<()> {
    let lang = primary_lang(commands, ui_lang);
    let lyrics = lyrics_json_path(&ctx.run_dir);
    let mix = mix_wav_path(&ctx.run_dir);
    let out = storyboard_json_path(&ctx.run_dir);

    if let Some(cmdline) = env_cmd("CSS_VIDEO_PLAN_CMD") {
        run_cmd(
            &cmdline,
            &ctx.run_dir,
            &[
                ("CSS_LANG", lang.clone()),
                ("CSS_TITLE_HINT", title_hint(commands)),
                ("CSS_LYRICS_JSON", lyrics.to_string_lossy().to_string()),
                ("CSS_MIX_WAV", mix.to_string_lossy().to_string()),
                ("CSS_OUT_JSON", out.to_string_lossy().to_string()),
            ],
        )
        .await?;
        validate_video_plan_output(&out).await?;
        return Ok(());
    }

    let plan = json!({
        "schema": "css.video.plan.v1",
        "lang": lang,
        "title": title_hint(commands),
        "shots": [
            {
                "id": "video_shot_000",
                "prompt": "cssMV opening shot",
                "duration_s": 2.0
            }
        ]
    });
    write_json(&out, &plan).await?;
    validate_video_plan_output(&out).await?;
    Ok(())
}

pub async fn run_shot(ctx: &EngineCtx, shot_id: &str, shot: &Value, lang: &str) -> Result<()> {
    let shot_json = shot_json_path(&ctx.run_dir, shot_id);
    let out = shot_mp4_path(&ctx.run_dir, shot_id);

    write_json(&shot_json, shot).await?;

    if let Some(cmdline) = env_cmd("CSS_VIDEO_SHOT_CMD") {
        run_cmd(
            &cmdline,
            &ctx.run_dir,
            &[
                ("CSS_LANG", lang.to_string()),
                ("CSS_SHOT_ID", shot_id.to_string()),
                ("CSS_SHOT_JSON", shot_json.to_string_lossy().to_string()),
                ("CSS_OUT_MP4", out.to_string_lossy().to_string()),
            ],
        )
        .await?;
        validate_video_mp4_output(&out, Some("ffprobe")).await?;
        return Ok(());
    }

    ensure_parent(&out).await?;
    let dur = shot
        .get("duration_s")
        .and_then(|x| x.as_f64())
        .unwrap_or(2.0)
        .max(1.0);

    let status = tokio::process::Command::new(&ctx.ffmpeg)
        .arg("-y")
        .arg("-loglevel")
        .arg("error")
        .arg("-f")
        .arg("lavfi")
        .arg("-i")
        .arg("color=c=black:s=1280x720:r=24")
        .arg("-t")
        .arg(format!("{dur}"))
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg(&out)
        .status()
        .await?;
    if !status.success() {
        anyhow::bail!("video shot fallback ffmpeg failed");
    }

    validate_video_mp4_output(&out, Some("ffprobe")).await?;
    Ok(())
}
