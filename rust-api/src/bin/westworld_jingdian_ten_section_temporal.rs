use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use anyhow::{anyhow, Context, Result};
use cssos_rust_api::video::backend::types::SceneInput;
use cssos_rust_api::video::temporal_latent::{
    render_scene_temporal_latent_with_bootstrap, TemporalRenderConfig,
};
use cssos_rust_api::video::temporal_renderer::{
    render_temporal_rollout_from_segments, TemporalRenderProfile,
};
use serde::Serialize;

#[derive(Debug, Clone)]
struct JingdianSection<'a> {
    id: u32,
    section_type: &'a str,
    title: &'a str,
    lyrics: &'a [&'a str],
    visual_script: &'a str,
    weight: f32,
}

#[derive(Debug, Serialize)]
struct TimelineSceneReport {
    id: u32,
    section_type: String,
    title: String,
    duration_secs: f32,
    video_path: String,
}

#[derive(Debug, Serialize)]
struct RunnerReport {
    title: String,
    target_duration_secs: f32,
    duration_source: String,
    scene_count: usize,
    output_video: String,
    poster_path: String,
    scenes: Vec<TimelineSceneReport>,
}

const JINGDIAN_SECTIONS: [JingdianSection<'static>; 10] = [
    JingdianSection {
        id: 2101,
        section_type: "intro",
        title: "Prelude",
        lyrics: &[
            "黑色虚空里，白色仿生人坐在钢琴前",
            "冷光落下，世界像刚被造出来",
        ],
        visual_script:
            "白色女性仿生人独自坐在钢琴前，黑色虚空，冷光缓慢推近，手指开始极轻微运动，世界刚刚苏醒",
        weight: 0.8,
    },
    JingdianSection {
        id: 2102,
        section_type: "verse",
        title: "Run",
        lyrics: &["机械马从黑暗里穿出", "金属骨架在聚光灯中奔跑"],
        visual_script:
            "机械马在巨大黑暗空间中连续奔跑，镜头侧向跟拍，步态逐渐建立，金属骨架反射冷光",
        weight: 1.0,
    },
    JingdianSection {
        id: 2103,
        section_type: "verse",
        title: "Assembly",
        lyrics: &["机械臂在工业圣殿里工作", "白色外壳一层层覆盖仿生体"],
        visual_script:
            "工业装配空间内，机械臂持续组装男性仿生体，白色外壳逐步闭合，镜头从远景推进到中景",
        weight: 1.05,
    },
    JingdianSection {
        id: 2104,
        section_type: "pre_chorus",
        title: "Awakening Face",
        lyrics: &["女性仿生人抬眼", "情绪极轻微变化，但身份完全锁定"],
        visual_script:
            "女性仿生人面部特写，冷光掠过面部，目光极其缓慢发生变化，镜头不重置，只做持续推进",
        weight: 0.95,
    },
    JingdianSection {
        id: 2105,
        section_type: "chorus",
        title: "Corridor Walk",
        lyrics: &["她沿着无菌走廊向前", "地面反射她的影子与命运"],
        visual_script:
            "女性仿生人在无菌地下走廊中持续向前行走，镜头稳定跟随，脚步、肩线、目光连续推进",
        weight: 1.2,
    },
    JingdianSection {
        id: 2106,
        section_type: "verse",
        title: "Player Piano Hall",
        lyrics: &["自动钢琴在空旷厅堂里自己奏响", "机械世界像一台被唤醒的神庙"],
        visual_script: "自动钢琴在空旷厅堂中持续演奏，琴槌与琴键动作连贯，镜头围绕钢琴轻缓滑动",
        weight: 1.0,
    },
    JingdianSection {
        id: 2107,
        section_type: "bridge",
        title: "Eye Reflection",
        lyrics: &["她的眼中映出正在施工的西部小镇", "两个世界开始叠合"],
        visual_script: "女性仿生人极近特写，眼中反射施工中的西部小镇，镜头维持特写连续变化，不切镜",
        weight: 1.0,
    },
    JingdianSection {
        id: 2108,
        section_type: "chorus",
        title: "Dual Worlds",
        lyrics: &["实验室与西部街道在她身后交叠", "冷暖两种世界同时运转"],
        visual_script:
            "女性仿生人站在实验室与西部街道交叠的空间中，冷暖光线同时运动，镜头围绕角色连续漂移",
        weight: 1.25,
    },
    JingdianSection {
        id: 2109,
        section_type: "chorus",
        title: "Confrontation",
        lyrics: &["女性与男性仿生人正面对峙", "空气中的张力持续升级"],
        visual_script:
            "女性与男性仿生人在无菌走廊内持续对峙，彼此缓慢靠近，镜头保持同一场景连续张力",
        weight: 1.2,
    },
    JingdianSection {
        id: 2110,
        section_type: "outro",
        title: "Final Walk",
        lyrics: &["她走向暖色黎明", "像走出被制造的命运"],
        visual_script:
            "女性仿生人从黑暗持续走向暖色黎明，长影拖在身后，情绪觉醒但镜头和身份保持连续",
        weight: 1.1,
    },
];

fn main() -> Result<()> {
    let _api_key = std::env::var("OPENAI_API_KEY")
        .context("set OPENAI_API_KEY before running jingdian temporal runner")?;
    let args: Vec<String> = std::env::args().collect();
    let audio_path = resolve_required_audio_path(args.get(1).map(PathBuf::from))?;
    let output_dir = PathBuf::from("output/westworld_jingdian_ten_section_temporal");
    fs::create_dir_all(&output_dir)?;

    let (target_duration_secs, duration_source) = resolve_target_duration(&audio_path)?;
    let scenes = build_scene_timeline(target_duration_secs);
    let config = TemporalRenderConfig {
        fps: 24,
        width: 1280,
        height: 720,
        target_patch_span_secs: 0.5,
        min_patch_count: 18,
        max_patch_count: 360,
    };

    let mut bootstrap_state_summary = None::<String>;
    let mut segment_paths = Vec::with_capacity(scenes.len());
    let mut report_scenes = Vec::with_capacity(scenes.len());
    for scene in &scenes {
        let outcome = render_scene_temporal_latent_with_bootstrap(
            &_api_key,
            scene,
            &config,
            bootstrap_state_summary.clone(),
        )
        .with_context(|| format!("rendering jingdian temporal scene {}", scene.id))?;
        bootstrap_state_summary = Some(outcome.final_state_summary);
        let target = output_dir.join(format!("scene_{:04}.mp4", scene.id));
        fs::copy(&outcome.output_path, &target)
            .with_context(|| format!("copying scene output into {}", target.display()))?;
        segment_paths.push(target.clone());
        report_scenes.push(TimelineSceneReport {
            id: scene.id,
            section_type: scene
                .section_type
                .clone()
                .unwrap_or_else(|| "scene".to_string()),
            title: section_title(scene.id),
            duration_secs: scene.duration_secs,
            video_path: target.to_string_lossy().to_string(),
        });
    }

    let final_video = output_dir.join("westworld_jingdian_ten_section_temporal.mp4");
    let total_duration = scenes.iter().map(|scene| scene.duration_secs).sum::<f32>();
    render_temporal_rollout_from_segments(
        &segment_paths,
        &final_video,
        &TemporalRenderProfile {
            width: 1280,
            height: 720,
            fps: 24,
            enable_motion_interpolation: false,
        },
    )
    .context("assembling jingdian long-form temporal rollout")?;

    let poster_path = output_dir.join("poster.jpg");
    capture_poster(&final_video, &poster_path)?;
    let report = RunnerReport {
        title: "西部世界歌剧MV·京典十节长时序版".to_string(),
        target_duration_secs: total_duration,
        duration_source,
        scene_count: report_scenes.len(),
        output_video: final_video.to_string_lossy().to_string(),
        poster_path: poster_path.to_string_lossy().to_string(),
        scenes: report_scenes,
    };
    fs::write(
        output_dir.join("runner_report.json"),
        serde_json::to_vec_pretty(&report)?,
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
        "no real audio file was found for the jingdian ten-section runner; pass an audio path explicitly or export CSSMV_WESTWORLD_AUDIO_PATH / CSSMV_AUDIO_PATH"
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

fn resolve_target_duration(audio_path: &Path) -> Result<(f32, String)> {
    if let Some(duration_secs) = probe_media_duration(audio_path)? {
        return Ok((
            duration_secs,
            format!("audio:{:.2}s:{}", duration_secs, audio_path.display()),
        ));
    }
    Err(anyhow!(
        "failed to probe duration from required audio file {}",
        audio_path.display()
    ))
}

fn probe_media_duration(path: &Path) -> Result<Option<f32>> {
    if !path.exists() {
        return Ok(None);
    }
    let output = Command::new("ffprobe")
        .arg("-v")
        .arg("error")
        .arg("-show_entries")
        .arg("format=duration")
        .arg("-of")
        .arg("default=noprint_wrappers=1:nokey=1")
        .arg(path)
        .output()
        .with_context(|| format!("probing audio duration {}", path.display()))?;
    if !output.status.success() {
        return Ok(None);
    }
    let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if raw.is_empty() {
        return Ok(None);
    }
    let duration = raw
        .parse::<f32>()
        .ok()
        .filter(|value| value.is_finite() && *value > 0.0);
    Ok(duration)
}

fn build_scene_timeline(target_duration_secs: f32) -> Vec<SceneInput> {
    let total_weight = JINGDIAN_SECTIONS
        .iter()
        .map(|section| section.weight)
        .sum::<f32>()
        .max(1.0);
    JINGDIAN_SECTIONS
        .iter()
        .map(|section| SceneInput {
            id: section.id,
            section_type: Some(section.section_type.to_string()),
            style_hint: Some("cinematic_dark".to_string()),
            visual_script: format!(
                "{}. LYRICS: {}. This section belongs to a ten-section continuous opera timeline and must preserve the exact same world state from the previous section.",
                section.visual_script,
                section.lyrics.join(" / ")
            ),
            duration_secs: (target_duration_secs * section.weight) / total_weight,
        })
        .collect()
}

fn section_title(scene_id: u32) -> String {
    JINGDIAN_SECTIONS
        .iter()
        .find(|section| section.id == scene_id)
        .map(|section| section.title.to_string())
        .unwrap_or_else(|| format!("scene-{scene_id}"))
}

fn capture_poster(video_path: &Path, poster_path: &Path) -> Result<()> {
    let output = Command::new("ffmpeg")
        .arg("-y")
        .arg("-hide_banner")
        .arg("-loglevel")
        .arg("error")
        .arg("-ss")
        .arg("2.0")
        .arg("-i")
        .arg(video_path)
        .arg("-frames:v")
        .arg("1")
        .arg(poster_path)
        .output()
        .context("capturing poster for jingdian temporal rollout")?;
    if !output.status.success() {
        return Err(anyhow!(
            "ffmpeg poster capture failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(())
}
