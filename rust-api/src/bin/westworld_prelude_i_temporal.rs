use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use anyhow::{anyhow, Context, Result};
use cssos_rust_api::video::backend::types::SceneInput;
use cssos_rust_api::video::render_local::render_scene_local;
use cssos_rust_api::video::temporal_latent::types::{TemporalDecoderMetrics, TemporalLatentReport};
use cssos_rust_api::video::temporal_renderer::{
    render_temporal_rollout_from_segments, TemporalRenderProfile,
};
use serde::Serialize;

#[derive(Debug, Serialize)]
struct PreludeRegressionAggregate {
    scene_count: usize,
    total_patch_count: usize,
    mean_monotonic_phase_ratio: f32,
    mean_conditioned_step_ratio: f32,
    mean_unique_patch_ratio: f32,
    mean_state_delta_chars: f32,
    mean_decoder_overlap_secs: f32,
    mean_decoder_hold_ratio: f32,
}

#[derive(Debug, Serialize)]
struct PreludeRegressionReport {
    sample: String,
    output_video: String,
    poster_path: String,
    aggregate: PreludeRegressionAggregate,
    master_decoder: TemporalDecoderMetrics,
    scenes: Vec<TemporalLatentReport>,
}

fn main() -> Result<()> {
    let api_key = std::env::var("OPENAI_API_KEY")
        .context("set OPENAI_API_KEY before running westworld_prelude_i_temporal")?;
    let args: Vec<String> = std::env::args().collect();
    let audio_path = resolve_required_audio_path(args.get(1).map(PathBuf::from))?;

    let output_dir = PathBuf::from("output/westworld_prelude_i_temporal");
    fs::create_dir_all(&output_dir)?;

    let target_duration_secs = resolve_target_duration(&audio_path)?;
    let weights = [0.22f32, 0.26f32, 0.24f32, 0.28f32];
    let scenes = vec![
        SceneInput {
            id: 1101,
            section_type: Some("intro".to_string()),
            style_hint: Some("cinematic_dark".to_string()),
            visual_script: "白色仿生人女性独自坐在钢琴前，面无表情，冷光，黑色背景，无帽子，镜头缓慢推近".to_string(),
            duration_secs: target_duration_secs * weights[0],
        },
        SceneInput {
            id: 1102,
            section_type: Some("verse".to_string()),
            style_hint: Some("cinematic_dark".to_string()),
            visual_script: "巨大的黑暗空间中，独自一匹机械马奔跑，聚光灯打在金属骨架上，没有骑手，镜头跟拍奔跑轨迹".to_string(),
            duration_secs: target_duration_secs * weights[1],
        },
        SceneInput {
            id: 1103,
            section_type: Some("verse".to_string()),
            style_hint: Some("cinematic_dark".to_string()),
            visual_script: "机械臂正在装配一名男性仿生体，白色装甲合成外壳逐渐覆盖机械骨架，临床工业装配空间，镜头从远景推进到中景".to_string(),
            duration_secs: target_duration_secs * weights[2],
        },
        SceneInput {
            id: 1104,
            section_type: Some("chorus".to_string()),
            style_hint: Some("cinematic_dark".to_string()),
            visual_script: "白色女性仿生人特写，冷静注视前方，冷光照亮面部，黑色背景，无帽子，最终停留在面部特写".to_string(),
            duration_secs: target_duration_secs * weights[3],
        },
    ];

    let mut segment_paths = Vec::with_capacity(scenes.len());
    let mut scene_reports = Vec::with_capacity(scenes.len());
    for scene in &scenes {
        let rendered = render_scene_local(&api_key, scene)
            .with_context(|| format!("rendering temporal prelude scene {}", scene.id))?;
        let target = output_dir.join(format!("scene_{:04}.mp4", scene.id));
        fs::copy(&rendered, &target)
            .with_context(|| format!("copying rendered scene into {}", target.display()))?;
        segment_paths.push(target);
        let report = read_scene_report(scene.id)?;
        scene_reports.push(report);
    }

    let concat_list = output_dir.join("concat.txt");
    let mut list_body = String::new();
    for path in &segment_paths {
        list_body.push_str(&format!("file '{}'\n", path.display()));
    }
    fs::write(&concat_list, list_body)?;

    let final_video = output_dir.join("prelude_i_temporal.mp4");
    let master_decoder = render_temporal_rollout_from_segments(
        &segment_paths,
        &final_video,
        &TemporalRenderProfile::default(),
    )
    .context("decoding temporal prelude scenes into master rollout")?;

    let poster = output_dir.join("poster.jpg");
    run_ffmpeg_poster(&final_video, &poster)?;

    let regression_report = PreludeRegressionReport {
        sample: "westworld-prelude-i".to_string(),
        output_video: final_video.to_string_lossy().to_string(),
        poster_path: poster.to_string_lossy().to_string(),
        aggregate: build_aggregate(&scene_reports),
        master_decoder,
        scenes: scene_reports,
    };
    fs::write(
        output_dir.join("regression_report.json"),
        serde_json::to_vec_pretty(&regression_report)?,
    )?;

    println!("{}", final_video.display());
    Ok(())
}

fn resolve_required_audio_path(explicit: Option<PathBuf>) -> Result<PathBuf> {
    if let Some(path) = explicit.filter(|path| path.exists()) {
        return Ok(path);
    }
    let env_candidates = [
        "CSSMV_WESTWORLD_AUDIO_PATH",
        "CSSMV_AUDIO_PATH",
        "CSS_AUDIO_PATH",
    ];
    for key in env_candidates {
        if let Ok(value) = std::env::var(key) {
            let path = PathBuf::from(value);
            if path.exists() {
                return Ok(path);
            }
        }
    }
    let local_candidates = [
        PathBuf::from("output/music.wav"),
        PathBuf::from("output/music.mp3"),
        PathBuf::from("build/music.wav"),
        PathBuf::from("build/music.mp3"),
        PathBuf::from("public/probes/westworld-prelude-i/audio.wav"),
        PathBuf::from("public/probes/westworld-prelude-i/audio.mp3"),
    ];
    for path in local_candidates {
        if path.exists() {
            return Ok(path);
        }
    }
    if let Some(path) = discover_latest_run_music() {
        return Ok(path);
    }
    Err(anyhow!(
        "no real audio file was found for westworld_prelude_i_temporal; pass an audio path explicitly or export CSSMV_WESTWORLD_AUDIO_PATH / CSSMV_AUDIO_PATH"
    ))
}

fn discover_latest_run_music() -> Option<PathBuf> {
    let runs_dir = PathBuf::from(".runs");
    let entries = fs::read_dir(&runs_dir).ok()?;
    let mut candidates = entries
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            let path = entry.path().join("build").join("music.wav");
            if path.exists() {
                let modified = path.metadata().ok()?.modified().ok()?;
                Some((modified, path))
            } else {
                None
            }
        })
        .collect::<Vec<_>>();
    candidates.sort_by(|left, right| left.0.cmp(&right.0));
    candidates.pop().map(|(_, path)| path)
}

fn resolve_target_duration(audio_path: &Path) -> Result<f32> {
    let output = Command::new("ffprobe")
        .arg("-v")
        .arg("error")
        .arg("-show_entries")
        .arg("format=duration")
        .arg("-of")
        .arg("default=noprint_wrappers=1:nokey=1")
        .arg(audio_path)
        .output()
        .with_context(|| format!("probing audio duration {}", audio_path.display()))?;
    if !output.status.success() {
        return Err(anyhow!(
            "ffprobe duration probe failed for {}: {}",
            audio_path.display(),
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    let duration = String::from_utf8_lossy(&output.stdout)
        .trim()
        .parse::<f32>()
        .with_context(|| format!("parsing ffprobe duration for {}", audio_path.display()))?;
    Ok(duration.max(0.2))
}

fn read_scene_report(scene_id: u32) -> Result<TemporalLatentReport> {
    let report_path = PathBuf::from(format!(
        "output/scene_{}_temporal_latent.report.json",
        scene_id
    ));
    let body = fs::read(&report_path)
        .with_context(|| format!("reading temporal scene report {}", report_path.display()))?;
    let report = serde_json::from_slice(&body)
        .with_context(|| format!("parsing {}", report_path.display()))?;
    Ok(report)
}

fn build_aggregate(reports: &[TemporalLatentReport]) -> PreludeRegressionAggregate {
    if reports.is_empty() {
        return PreludeRegressionAggregate {
            scene_count: 0,
            total_patch_count: 0,
            mean_monotonic_phase_ratio: 0.0,
            mean_conditioned_step_ratio: 0.0,
            mean_unique_patch_ratio: 0.0,
            mean_state_delta_chars: 0.0,
            mean_decoder_overlap_secs: 0.0,
            mean_decoder_hold_ratio: 0.0,
        };
    }

    let scene_count = reports.len() as f32;
    PreludeRegressionAggregate {
        scene_count: reports.len(),
        total_patch_count: reports.iter().map(|report| report.patch_count).sum(),
        mean_monotonic_phase_ratio: reports
            .iter()
            .map(|report| report.state_continuity.monotonic_phase_ratio)
            .sum::<f32>()
            / scene_count,
        mean_conditioned_step_ratio: reports
            .iter()
            .map(|report| report.state_continuity.conditioned_step_ratio)
            .sum::<f32>()
            / scene_count,
        mean_unique_patch_ratio: reports
            .iter()
            .map(|report| report.state_continuity.unique_patch_ratio)
            .sum::<f32>()
            / scene_count,
        mean_state_delta_chars: reports
            .iter()
            .map(|report| report.state_continuity.mean_state_delta_chars)
            .sum::<f32>()
            / scene_count,
        mean_decoder_overlap_secs: reports
            .iter()
            .map(|report| report.decoder_metrics.overlap_duration_secs)
            .sum::<f32>()
            / scene_count,
        mean_decoder_hold_ratio: reports
            .iter()
            .map(|report| report.decoder_metrics.latent_hold_ratio)
            .sum::<f32>()
            / scene_count,
    }
}

fn run_ffmpeg_poster(video_path: &Path, poster_path: &Path) -> Result<()> {
    let output = Command::new("ffmpeg")
        .arg("-y")
        .arg("-hide_banner")
        .arg("-loglevel")
        .arg("error")
        .arg("-ss")
        .arg("1.5")
        .arg("-i")
        .arg(video_path)
        .arg("-frames:v")
        .arg("1")
        .arg(poster_path)
        .output()
        .context("running ffmpeg poster capture for temporal prelude")?;
    if !output.status.success() {
        return Err(anyhow!(
            "ffmpeg poster capture failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(())
}
