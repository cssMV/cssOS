use crate::engines::*;
use anyhow::{anyhow, Result};
use std::path::{Path, PathBuf};

pub fn shots_concat_txt_path(run_dir: &Path) -> PathBuf {
    run_dir.join("./build/video/shots.txt")
}

pub async fn write_concat_list(run_dir: &Path, shot_files: &[PathBuf]) -> Result<PathBuf> {
    let list_path = shots_concat_txt_path(run_dir);
    ensure_parent(&list_path).await?;

    let mut body = String::new();
    for p in shot_files {
        body.push_str(&format!(
            "file '{}'\n",
            p.to_string_lossy().replace('\'', "'\\''")
        ));
    }

    tokio::fs::write(&list_path, body).await?;
    Ok(list_path)
}

pub async fn run(ctx: &EngineCtx, shot_files: &[PathBuf]) -> Result<()> {
    let out = video_mp4_path(&ctx.run_dir);

    if shot_files.is_empty() {
        return Err(anyhow!("video assemble missing shot files"));
    }

    let shots_txt = write_concat_list(&ctx.run_dir, shot_files).await?;

    if let Some(cmdline) = env_cmd("CSS_VIDEO_ASSEMBLE_CMD") {
        run_cmd(
            &cmdline,
            &ctx.run_dir,
            &[
                ("CSS_SHOTS_TXT", shots_txt.to_string_lossy().to_string()),
                ("CSS_OUT_MP4", out.to_string_lossy().to_string()),
            ],
        )
        .await?;
        validate_video_mp4_output(&out, Some("ffprobe")).await?;
        return Ok(());
    }

    ensure_parent(&out).await?;
    let status = tokio::process::Command::new(&ctx.ffmpeg)
        .arg("-y")
        .arg("-loglevel")
        .arg("error")
        .arg("-f")
        .arg("concat")
        .arg("-safe")
        .arg("0")
        .arg("-i")
        .arg(&shots_txt)
        .arg("-c")
        .arg("copy")
        .arg(&out)
        .status()
        .await?;

    if !status.success() {
        let enc = tokio::process::Command::new(&ctx.ffmpeg)
            .arg("-y")
            .arg("-loglevel")
            .arg("error")
            .arg("-f")
            .arg("concat")
            .arg("-safe")
            .arg("0")
            .arg("-i")
            .arg(&shots_txt)
            .arg("-c:v")
            .arg("libx264")
            .arg("-preset")
            .arg("veryfast")
            .arg("-crf")
            .arg("18")
            .arg("-pix_fmt")
            .arg("yuv420p")
            .arg(&out)
            .status()
            .await?;

        if !enc.success() {
            anyhow::bail!("video assemble failed");
        }
    }

    validate_video_mp4_output(&out, Some("ffprobe")).await?;
    Ok(())
}
