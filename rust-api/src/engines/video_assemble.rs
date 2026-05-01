use crate::engines::*;
use anyhow::{anyhow, Result};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

pub fn shots_concat_txt_path(run_dir: &Path) -> PathBuf {
    run_dir.join("./build/video/shots.txt")
}

pub fn assemble_manifest_json_path(run_dir: &Path) -> PathBuf {
    run_dir.join("./build/video/assemble.json")
}

async fn read_storyboard_segments(run_dir: &Path) -> Result<Vec<Value>> {
    let storyboard_path = crate::engines::video::storyboard_json_path(run_dir);
    if !storyboard_path.exists() {
        return Ok(Vec::new());
    }
    let raw = tokio::fs::read(&storyboard_path).await?;
    let value: Value = serde_json::from_slice(&raw)?;
    Ok(value
        .get("segments")
        .and_then(|segments| segments.as_array())
        .cloned()
        .unwrap_or_default())
}

pub async fn write_assemble_manifest(run_dir: &Path, shot_files: &[PathBuf]) -> Result<PathBuf> {
    let manifest_path = assemble_manifest_json_path(run_dir);
    ensure_parent(&manifest_path).await?;
    let shots_txt = shots_concat_txt_path(run_dir);
    let out_mp4 = video_mp4_path(run_dir);
    let segments = read_storyboard_segments(run_dir).await?;
    let shots = shot_files
        .iter()
        .enumerate()
        .map(|(index, path)| {
            json!({
                "id": format!("video_shot_{index:03}"),
                "path": path.to_string_lossy().to_string()
            })
        })
        .collect::<Vec<_>>();
    let payload = json!({
        "schema": "css.video.assemble.v1",
        "storyboard_path": crate::engines::video::storyboard_json_path(run_dir).to_string_lossy().to_string(),
        "shots_txt_path": shots_txt.to_string_lossy().to_string(),
        "out_mp4": out_mp4.to_string_lossy().to_string(),
        "shots": shots,
        "segments": segments
    });
    tokio::fs::write(&manifest_path, serde_json::to_vec_pretty(&payload)?).await?;
    Ok(manifest_path)
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
    let assemble_manifest = write_assemble_manifest(&ctx.run_dir, shot_files).await?;

    if let Some(cmdline) = env_cmd("CSS_VIDEO_ASSEMBLE_CMD") {
        run_cmd(
            &cmdline,
            &ctx.run_dir,
            &[
                ("CSS_SHOTS_TXT", shots_txt.to_string_lossy().to_string()),
                (
                    "CSS_STORYBOARD_JSON",
                    crate::engines::video::storyboard_json_path(&ctx.run_dir)
                        .to_string_lossy()
                        .to_string(),
                ),
                (
                    "CSS_ASSEMBLE_JSON",
                    assemble_manifest.to_string_lossy().to_string(),
                ),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn write_assemble_manifest_carries_storyboard_segments() {
        let run_dir =
            std::env::temp_dir().join(format!("cssos_video_assemble_test_{}", std::process::id()));
        let storyboard_path = crate::engines::video::storyboard_json_path(&run_dir);
        ensure_parent(&storyboard_path).await.unwrap();
        tokio::fs::write(
            &storyboard_path,
            serde_json::to_vec_pretty(&json!({
                "schema": "css.video.plan.v1",
                "lang": "en",
                "shots": [
                    { "id": "video_shot_000", "prompt": "intro", "duration_s": 2.0 }
                ],
                "segments": [
                    {
                        "scene_id": "scene_001",
                        "shot_id": "video_shot_000",
                        "label": "Intro",
                        "start_s": 0.0,
                        "end_s": 2.0,
                        "duration_s": 2.0
                    }
                ]
            }))
            .unwrap(),
        )
        .await
        .unwrap();

        let manifest = write_assemble_manifest(
            &run_dir,
            &[run_dir.join("./build/video/shots/video_shot_000.mp4")],
        )
        .await
        .unwrap();
        let raw = tokio::fs::read_to_string(manifest).await.unwrap();
        let value: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(
            value.get("schema").and_then(|v| v.as_str()),
            Some("css.video.assemble.v1")
        );
        assert_eq!(
            value["segments"]
                .as_array()
                .and_then(|v| v.first())
                .and_then(|v| v.get("scene_id"))
                .and_then(|v| v.as_str()),
            Some("scene_001")
        );
        let _ = tokio::fs::remove_dir_all(&run_dir).await;
    }
}
