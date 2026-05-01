use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use anyhow::{anyhow, Context, Result};

use crate::video::types::{ProjectInput, ThumbnailVideoResult};

pub fn generate_thumbnail_video(input: &ProjectInput) -> Result<ThumbnailVideoResult> {
    if !input.thumbnail.enabled {
        return Ok(ThumbnailVideoResult {
            enabled: false,
            generated: false,
            duration_secs: 0.0,
            output_path: None,
            source_scene_ids: Vec::new(),
            message: Some("thumbnail disabled".to_string()),
        });
    }

    let duration_secs = resolve_thumbnail_duration(input.thumbnail.duration_secs);
    let root = project_output_root(&input.project_id)?;
    fs::create_dir_all(&root)?;
    let output_path = root.join("thumbnail.mp4");

    let selected = select_thumbnail_scenes(&input.scenes);
    let sources = selected
        .iter()
        .filter_map(|scene| first_existing_path(&scene.reference_media_paths))
        .collect::<Vec<_>>();
    if sources.is_empty() && !input.reference_media_paths.is_empty() {
        if let Some(path) = first_existing_path(&input.reference_media_paths) {
            return build_single_source_thumbnail(
                &path,
                duration_secs,
                &output_path,
                selected.iter().map(|scene| scene.id).collect(),
            );
        }
    }
    if sources.is_empty() {
        return Err(anyhow!(
            "thumbnail enabled but no valid reference media paths were available"
        ));
    }

    let temp_dir = root.join("thumbnail_parts");
    fs::create_dir_all(&temp_dir)?;
    let part_duration = (duration_secs / sources.len() as f32).clamp(0.6, duration_secs);
    let mut parts = Vec::new();
    for (index, source) in sources.iter().enumerate() {
        let part_path = temp_dir.join(format!("part_{index:02}.mp4"));
        render_reference_clip(source, &part_path, part_duration, index as u64)?;
        parts.push(part_path);
    }
    concat_videos(&parts, &output_path)?;
    validate_video_output(&output_path, duration_secs, 0.4)?;

    Ok(ThumbnailVideoResult {
        enabled: true,
        generated: true,
        duration_secs,
        output_path: Some(output_path.to_string_lossy().to_string()),
        source_scene_ids: selected.iter().map(|scene| scene.id).collect(),
        message: None,
    })
}

fn build_single_source_thumbnail(
    source: &Path,
    duration_secs: f32,
    output_path: &Path,
    source_scene_ids: Vec<u32>,
) -> Result<ThumbnailVideoResult> {
    render_reference_clip(source, output_path, duration_secs, 0)?;
    validate_video_output(output_path, duration_secs, 0.4)?;
    Ok(ThumbnailVideoResult {
        enabled: true,
        generated: true,
        duration_secs,
        output_path: Some(output_path.to_string_lossy().to_string()),
        source_scene_ids,
        message: None,
    })
}

fn select_thumbnail_scenes(
    scenes: &[crate::video::types::SceneInput],
) -> Vec<&crate::video::types::SceneInput> {
    let mut preferred = scenes
        .iter()
        .filter(|scene| {
            matches!(
                scene.section_type.to_ascii_lowercase().as_str(),
                "chorus" | "bridge"
            )
        })
        .collect::<Vec<_>>();
    if preferred.is_empty() {
        preferred = scenes.iter().take(3).collect();
    } else {
        preferred.truncate(3);
    }
    preferred
}

pub(crate) fn resolve_thumbnail_duration(value: Option<f32>) -> f32 {
    value.unwrap_or(4.0).clamp(3.0, 5.0)
}

pub(crate) fn project_output_root(project_id: &str) -> Result<PathBuf> {
    let slug = project_id
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() {
                ch.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string();
    Ok(PathBuf::from("target")
        .join("cssmv-video-engine")
        .join(slug))
}

pub(crate) fn first_existing_path(paths: &[String]) -> Option<PathBuf> {
    paths.iter().map(PathBuf::from).find(|path| path.exists())
}

pub(crate) fn render_reference_clip(
    source: &Path,
    output_path: &Path,
    duration_secs: f32,
    seed: u64,
) -> Result<()> {
    fs::create_dir_all(output_path.parent().unwrap_or_else(|| Path::new(".")))?;
    let lower = source
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let mut cmd = Command::new("ffmpeg");
    cmd.arg("-y")
        .arg("-hide_banner")
        .arg("-loglevel")
        .arg("error");
    if matches!(lower.as_str(), "png" | "jpg" | "jpeg" | "webp") {
        cmd.arg("-loop")
            .arg("1")
            .arg("-i")
            .arg(source)
            .arg("-vf")
            .arg(format!(
                "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,zoompan=z='min(zoom+0.0008,1.12)':d=1:s=1280x720:fps=24"
            ));
    } else {
        let offset = ((seed % 7) as f32 * 0.37).min(duration_secs * 0.25) as f64;
        cmd.arg("-stream_loop")
            .arg("-1")
            .arg("-ss")
            .arg(format!("{offset:.3}"))
            .arg("-i")
            .arg(source)
            .arg("-vf")
            .arg("scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720");
    }
    cmd.arg("-t")
        .arg(format!("{duration_secs:.3}"))
        .arg("-an")
        .arg("-r")
        .arg("24")
        .arg("-c:v")
        .arg("libx264")
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg(output_path);
    let output = cmd.output().context("running ffmpeg for thumbnail")?;
    if !output.status.success() {
        return Err(anyhow!(
            "thumbnail ffmpeg failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(())
}

pub(crate) fn concat_videos(parts: &[PathBuf], output_path: &Path) -> Result<()> {
    let list_path = output_path.with_extension("concat.txt");
    let list_body = parts
        .iter()
        .map(|path| format!("file '{}'\n", path.to_string_lossy().replace('\'', "'\\''")))
        .collect::<String>();
    fs::write(&list_path, list_body)?;
    let output = Command::new("ffmpeg")
        .arg("-y")
        .arg("-hide_banner")
        .arg("-loglevel")
        .arg("error")
        .arg("-f")
        .arg("concat")
        .arg("-safe")
        .arg("0")
        .arg("-i")
        .arg(&list_path)
        .arg("-c")
        .arg("copy")
        .arg(output_path)
        .output()?;
    if !output.status.success() {
        return Err(anyhow!(
            "thumbnail concat failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(())
}

pub(crate) fn validate_video_output(path: &Path, expected_secs: f32, tolerance: f32) -> Result<()> {
    if !path.exists() {
        return Err(anyhow!("missing generated video {}", path.display()));
    }
    let metadata = fs::metadata(path)?;
    if metadata.len() < 8_192 {
        return Err(anyhow!(
            "generated video too small to trust: {} bytes",
            metadata.len()
        ));
    }
    let actual = probe_duration(path)?;
    if (actual - expected_secs).abs() > tolerance {
        return Err(anyhow!(
            "duration mismatch for {}: expected {:.3}s actual {:.3}s",
            path.display(),
            expected_secs,
            actual
        ));
    }
    Ok(())
}

pub(crate) fn probe_duration(path: &Path) -> Result<f32> {
    let output = Command::new("ffprobe")
        .arg("-v")
        .arg("error")
        .arg("-show_entries")
        .arg("format=duration")
        .arg("-of")
        .arg("default=noprint_wrappers=1:nokey=1")
        .arg(path)
        .output()?;
    if !output.status.success() {
        return Err(anyhow!(
            "ffprobe failed for {}: {}",
            path.display(),
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    let value = String::from_utf8_lossy(&output.stdout)
        .trim()
        .parse::<f32>()?;
    Ok(value)
}

#[cfg(test)]
mod tests {
    use crate::video::types::{MusicInput, ProjectInput, ProjectStyleInput, ThumbnailInput};

    use super::{generate_thumbnail_video, resolve_thumbnail_duration};

    #[test]
    fn thumbnail_duration_stays_inside_contract() {
        assert_eq!(resolve_thumbnail_duration(Some(2.0)), 3.0);
        assert_eq!(resolve_thumbnail_duration(Some(6.0)), 5.0);
        assert_eq!(resolve_thumbnail_duration(None), 4.0);
    }

    #[test]
    fn disabled_thumbnail_returns_clean_state() {
        let result = generate_thumbnail_video(&ProjectInput {
            project_id: "demo".into(),
            project_prompt: "demo".into(),
            music: MusicInput {
                audio_path: "/tmp/unused.wav".into(),
                duration_secs: 10.0,
            },
            thumbnail: ThumbnailInput {
                enabled: false,
                duration_secs: None,
            },
            style_profile: ProjectStyleInput::default(),
            reference_media_paths: vec![],
            scenes: vec![],
        })
        .expect("disabled thumbnail should not error");
        assert!(!result.generated);
        assert!(!result.enabled);
        assert!(result.output_path.is_none());
    }
}
