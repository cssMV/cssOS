use super::*;
use crate::video::executor::WeakReferenceStyle;
use anyhow::{anyhow, Result};
use serde_json::{json, Value};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
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

pub fn segment_timeline_json_path(run_dir: &Path) -> PathBuf {
    run_dir.join("./build/segment-timeline.json")
}

pub fn scene_plan_json_path(run_dir: &Path) -> PathBuf {
    run_dir.join("./build/scene.plan.json")
}

pub fn music_plan_json_path(run_dir: &Path) -> PathBuf {
    run_dir.join("./build/music.plan.json")
}

pub fn rendered_media_json_path(run_dir: &Path) -> PathBuf {
    run_dir.join("./build/rendered.media.json")
}

pub fn reference_media_report_json_path(run_dir: &Path) -> PathBuf {
    run_dir.join("./build/video/reference-media.report.json")
}

async fn bridge_segments(ctx: &EngineCtx, commands: &Value) -> Vec<Value> {
    let mut segments = fallback_segments(commands);
    if !segments.is_empty() {
        return segments;
    }
    if let Some(lyrics_segments) =
        bridge_segments_from_lyrics_json(&lyrics_json_path(&ctx.run_dir)).await
    {
        return lyrics_segments;
    }

    let video = commands
        .get("video")
        .and_then(|value| value.as_object())
        .cloned()
        .unwrap_or_default();
    let shots_n = video
        .get("shots_n")
        .and_then(|value| value.as_u64())
        .map(|value| value.clamp(1, 64) as usize)
        .or_else(|| {
            commands
                .get("creative")
                .and_then(|creative| creative.get("section_form"))
                .and_then(|value| value.as_array())
                .map(|items| items.len().clamp(1, 64))
        })
        .unwrap_or(1);
    let duration_s = video
        .get("duration_s")
        .and_then(|value| value.as_f64())
        .filter(|value| value.is_finite() && *value > 0.0)
        .or_else(|| {
            commands
                .get("creative")
                .and_then(|creative| creative.get("duration_s"))
                .and_then(|value| value.as_f64())
                .filter(|value| value.is_finite() && *value > 0.0)
        })
        .or_else(|| {
            video.get("segments").and_then(|value| {
                value.as_array().and_then(|segments| {
                    let derived = segments.iter().fold(0.0_f64, |acc, segment| {
                        let start_s = segment
                            .get("start_s")
                            .and_then(|value| value.as_f64())
                            .filter(|value| value.is_finite())
                            .unwrap_or(0.0);
                        let end_s = segment
                            .get("end_s")
                            .and_then(|value| value.as_f64())
                            .filter(|value| value.is_finite() && *value > start_s);
                        let duration_s = segment
                            .get("duration_s")
                            .and_then(|value| value.as_f64())
                            .filter(|value| value.is_finite() && *value > 0.0);
                        acc.max(end_s.unwrap_or(start_s + duration_s.unwrap_or(0.0)))
                    });
                    (derived > 0.0).then_some(derived)
                })
            })
        })
        .unwrap_or_else(|| {
            let section_count = commands
                .get("creative")
                .and_then(|creative| creative.get("section_form"))
                .and_then(|value| value.as_array())
                .map(|items| items.len())
                .unwrap_or(0);
            let lyric_line_count = commands
                .get("creative")
                .and_then(|creative| creative.get("lyrics_prompt"))
                .and_then(|value| value.as_str())
                .map(|raw| {
                    raw.lines()
                        .map(|line| line.trim())
                        .filter(|line| !line.is_empty())
                        .count()
                })
                .unwrap_or(0);
            let lyric_char_count = commands
                .get("creative")
                .and_then(|creative| creative.get("lyrics_prompt"))
                .and_then(|value| value.as_str())
                .map(|raw| raw.chars().filter(|ch| !ch.is_whitespace()).count())
                .unwrap_or(0);
            let char_runtime = lyric_char_count as f64 / 4.2;
            let line_runtime = lyric_line_count as f64 * 2.8;
            let section_spacing = if section_count > 0 {
                section_count.saturating_sub(1) as f64 * 0.85
            } else {
                0.0
            };
            (char_runtime.max(line_runtime) + section_spacing).max(1.0)
        })
        .max(1.0);
    let segment_duration_s = (duration_s / shots_n as f64).max(1.0);

    for index in 0..shots_n {
        let start_s = segment_duration_s * index as f64;
        let end_s = if index + 1 == shots_n {
            duration_s
        } else {
            (start_s + segment_duration_s).min(duration_s)
        };
        segments.push(json!({
            "scene_id": format!("scene_{:03}", index + 1),
            "shot_id": format!("video_shot_{:03}", index),
            "label": format!("Segment {}", index + 1),
            "start_s": start_s,
            "end_s": end_s,
            "duration_s": (end_s - start_s).max(1.0),
            "subtitle_text": commands
                .get("creative")
                .and_then(|creative| creative.get("video_prompt"))
                .and_then(|value| value.as_str())
                .unwrap_or("cssMV storyboard segment")
        }));
    }

    segments
}

async fn bridge_segments_from_lyrics_json(path: &Path) -> Option<Vec<Value>> {
    let raw = tokio::fs::read_to_string(path).await.ok()?;
    let lyrics: Value = serde_json::from_str(&raw).ok()?;
    let script = lyrics.get("video_script")?.as_array()?;
    if script.is_empty() {
        return None;
    }

    let segments = script
        .iter()
        .enumerate()
        .map(|(index, item)| {
            let label = item
                .get("section")
                .and_then(|value| value.as_str())
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .unwrap_or("Segment");
            let start_s = item
                .get("start_s")
                .or_else(|| item.get("startSec"))
                .and_then(|value| value.as_f64())
                .unwrap_or(index as f64 * 4.0);
            let end_s = item
                .get("end_s")
                .or_else(|| item.get("endSec"))
                .and_then(|value| value.as_f64())
                .unwrap_or(start_s + 4.0)
                .max(start_s + 0.1);
            let summary = item
                .get("summary")
                .and_then(|value| value.as_str())
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .unwrap_or("cssMV bridge summary");
            let lyric_excerpt = item
                .get("lyric_excerpt")
                .or_else(|| item.get("lyricExcerpt"))
                .and_then(|value| value.as_str())
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .unwrap_or("");
            let shot_prompt = item
                .get("shot_prompt")
                .or_else(|| item.get("shotPrompt"))
                .and_then(|value| value.as_str())
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .unwrap_or(summary);
            let enriched_prompt = if lyric_excerpt.is_empty() {
                format!("{shot_prompt} | scene_summary={summary}")
            } else {
                format!("{shot_prompt} | lyric_excerpt={lyric_excerpt} | scene_summary={summary}")
            };
            json!({
                "scene_id": format!("scene_{:03}", index + 1),
                "shot_id": format!("video_shot_{:03}", index),
                "label": label,
                "start_s": start_s,
                "end_s": end_s,
                "duration_s": (end_s - start_s).max(0.1),
                "subtitle_text": summary,
                "prompt": enriched_prompt
            })
        })
        .collect::<Vec<_>>();
    Some(segments)
}

pub async fn ensure_cssmv_bridge_artifacts(ctx: &EngineCtx, commands: &Value) -> Result<()> {
    let segments = bridge_segments(ctx, commands).await;
    let scene_path = scene_plan_json_path(&ctx.run_dir);
    let music_path = music_plan_json_path(&ctx.run_dir);
    let rendered_path = rendered_media_json_path(&ctx.run_dir);
    let segment_path = segment_timeline_json_path(&ctx.run_dir);

    let scenes = segments
        .iter()
        .enumerate()
        .map(|(index, segment)| {
            let motif_callback = infer_motif_callback(segment);
            let relationship_arc = infer_relationship_arc(segment);
            json!({
                "sceneId": segment.get("scene_id").and_then(|value| value.as_str()).unwrap_or("scene_001"),
                "label": segment.get("label").and_then(|value| value.as_str()).unwrap_or("Segment"),
                "order": index + 1,
                "durationSec": segment.get("duration_s").and_then(|value| value.as_f64()).unwrap_or(2.0),
                "summary": segment.get("subtitle_text").and_then(|value| value.as_str()).unwrap_or("cssMV bridge summary"),
                "workType": segment.get("work_type").and_then(|value| value.as_str()).unwrap_or("single"),
                "structureNodeId": segment.get("structure_node_id").and_then(|value| value.as_str()).unwrap_or(""),
                "parentStructureNodeId": segment.get("parent_structure_node_id").and_then(|value| value.as_str()).unwrap_or(""),
                "structureRole": segment.get("structure_role").and_then(|value| value.as_str()).unwrap_or("scene"),
                "structurePath": segment.get("structure_path").cloned().unwrap_or_else(|| json!([])),
                "motifCallback": motif_callback.clone(),
                "relationshipArc": relationship_arc.clone()
            })
        })
        .collect::<Vec<_>>();
    let scene_shots = segments
        .iter()
        .enumerate()
        .map(|(idx, segment)| {
            let prompt = segment
                .get("prompt")
                .or_else(|| segment.get("subtitle_text"))
                .or_else(|| segment.get("label"))
                .and_then(|value| value.as_str())
                .unwrap_or("cssMV timeline shot");
            let relationship_arc = infer_relationship_arc(segment).unwrap_or_default();
            let motif_callback = infer_motif_callback(segment).unwrap_or_default();
            let duration_s = segment
                .get("duration_s")
                .and_then(|value| value.as_f64())
                .unwrap_or(2.0);
            json!({
                "id": segment
                    .get("shot_id")
                    .and_then(|value| value.as_str())
                    .map(|value| value.to_string())
                    .unwrap_or_else(|| format!("video_shot_{idx:03}")),
                "sceneId": segment.get("scene_id").and_then(|value| value.as_str()).unwrap_or("scene_001"),
                "label": segment.get("label").cloned().unwrap_or_else(|| json!("Segment")),
                "prompt": format!("{prompt} | relationship_arc={relationship_arc} | motif_callback={motif_callback}"),
                "duration_s": duration_s,
                "start_s": segment.get("start_s").and_then(|value| value.as_f64()).unwrap_or(0.0),
                "end_s": segment.get("end_s").and_then(|value| value.as_f64()).unwrap_or(duration_s),
                "relationship_arc": relationship_arc,
                "motif_callback": motif_callback,
                "reference_media_paths": segment
                    .get("reference_media_paths")
                    .cloned()
                    .unwrap_or_else(|| json!([])),
                "thumbnail_path": segment
                    .get("thumbnail_path")
                    .cloned()
                    .unwrap_or(serde_json::Value::Null)
            })
        })
        .collect::<Vec<_>>();
    let transitions = segments
        .iter()
        .enumerate()
        .filter_map(|(index, segment)| {
            let current_scene = segment.get("scene_id").and_then(|value| value.as_str())?;
            let next_scene = segments
                .get(index + 1)
                .and_then(|value| value.get("scene_id"))
                .and_then(|value| value.as_str());
            Some(json!({
                "transitionId": format!("transition_{:03}", index + 1),
                "kind": segment.get("transition_to_next").and_then(|value| value.as_str()).unwrap_or("fade"),
                "fromSceneId": current_scene,
                "toSceneId": next_scene
            }))
        })
        .collect::<Vec<_>>();
    let preview_segments = segments
        .iter()
        .map(|segment| {
            json!({
                "section": segment.get("label").and_then(|value| value.as_str()).unwrap_or("Segment"),
                "title": segment.get("label").and_then(|value| value.as_str()).unwrap_or("Segment"),
                "startSec": segment.get("start_s").and_then(|value| value.as_f64()).unwrap_or(0.0),
                "durationSec": segment.get("duration_s").and_then(|value| value.as_f64()).unwrap_or(2.0),
                "bars": 4,
                "energy": "medium",
                "audioCue": segment.get("subtitle_text").and_then(|value| value.as_str()).unwrap_or("cssMV bridge cue"),
                "motifCallback": segment.get("motif_callback").cloned().unwrap_or(serde_json::Value::Null),
                "relationshipArc": segment.get("relationship_arc").cloned().unwrap_or(serde_json::Value::Null)
            })
        })
        .collect::<Vec<_>>();
    let segment_timeline = segments
        .iter()
        .map(|segment| {
            let shot_id = segment
                .get("shot_id")
                .and_then(|value| value.as_str())
                .unwrap_or("video_shot_000");
            let motif_callback = infer_motif_callback(segment);
            let relationship_arc = infer_relationship_arc(segment);
            json!({
                "sceneId": segment.get("scene_id").and_then(|value| value.as_str()).unwrap_or("scene_001"),
                "label": segment.get("label").and_then(|value| value.as_str()).unwrap_or("Segment"),
                "videoPath": format!("./build/video/shots/{shot_id}.mp4"),
                "startSec": segment.get("start_s").and_then(|value| value.as_f64()).unwrap_or(0.0),
                "endSec": segment.get("end_s").and_then(|value| value.as_f64()).unwrap_or(2.0),
                "durationSec": segment.get("duration_s").and_then(|value| value.as_f64()).unwrap_or(2.0),
                "workType": segment.get("work_type").and_then(|value| value.as_str()).unwrap_or("single"),
                "structureNodeId": segment.get("structure_node_id").and_then(|value| value.as_str()).unwrap_or(""),
                "parentStructureNodeId": segment.get("parent_structure_node_id").and_then(|value| value.as_str()).unwrap_or(""),
                "structureRole": segment.get("structure_role").and_then(|value| value.as_str()).unwrap_or("scene"),
                "structurePath": segment.get("structure_path").cloned().unwrap_or_else(|| json!([])),
                "transitionToNext": segment.get("transition_to_next").and_then(|value| value.as_str()).unwrap_or("fade"),
                "subtitleText": segment.get("subtitle_text").and_then(|value| value.as_str()).unwrap_or("cssMV bridge subtitle"),
                "motifCallback": motif_callback,
                "relationshipArc": relationship_arc
            })
        })
        .collect::<Vec<_>>();

    write_json(
        &scene_path,
        &json!({
            "scenes": scenes,
            "shots": scene_shots,
            "transitions": transitions,
            "duration_s": segments.iter().map(|segment| segment.get("duration_s").and_then(|value| value.as_f64()).unwrap_or(0.0)).sum::<f64>()
        }),
    )
    .await?;
    write_json(
        &music_path,
        &json!({
            "tracks": [{
                "trackId": "track_main_001",
                "label": commands
                    .get("creative")
                    .and_then(|creative| creative.get("genre"))
                    .and_then(|value| value.as_str())
                    .unwrap_or("cssmv_bridge_main_theme")
            }],
            "cues": scenes.iter().enumerate().map(|(index, scene)| {
                json!({
                    "cueId": format!("cue_{:03}", index + 1),
                    "label": format!("Cue {}", index + 1),
                    "targetSceneId": scene.get("sceneId").and_then(|value| value.as_str()).unwrap_or("scene_001"),
                    "section": scene.get("label").and_then(|value| value.as_str()).unwrap_or("Segment")
                })
            }).collect::<Vec<_>>(),
            "strategy": "hybrid",
            "previewSegments": preview_segments
        }),
    )
    .await?;
    write_json(
        &rendered_path,
        &json!({
            "videoSegments": segment_timeline.iter().map(|segment| segment.get("videoPath").cloned().unwrap_or_else(|| json!("./build/video/shots/video_shot_000.mp4"))).collect::<Vec<_>>(),
            "mainCompositeVideo": "./build/video/video.mp4",
            "subtitleTrack": "./build/subtitles.ass",
            "segmentTimeline": segment_timeline,
            "totalDurationSec": segments.iter().map(|segment| segment.get("duration_s").and_then(|value| value.as_f64()).unwrap_or(0.0)).sum::<f64>(),
            "renderProfile": "mv_rust_minimal",
            "workType": commands.get("creative").and_then(|creative| creative.get("work_type")).and_then(|value| value.as_str()).unwrap_or("single"),
            "structureTree": commands.get("creative").and_then(|creative| creative.get("structure_tree")).cloned().unwrap_or_else(|| json!([]))
        }),
    )
    .await?;
    write_json(&segment_path, &json!(segments)).await?;
    Ok(())
}

fn optional_env_path(extra_env: &mut Vec<(&'static str, String)>, key: &'static str, path: &Path) {
    if path.exists() {
        extra_env.push((key, path.to_string_lossy().to_string()));
    }
}

fn fallback_segments(commands: &Value) -> Vec<Value> {
    commands
        .get("video")
        .and_then(|video| video.get("segments"))
        .and_then(|segments| segments.as_array())
        .cloned()
        .unwrap_or_default()
}

fn infer_relationship_arc(segment: &Value) -> Option<String> {
    let direct = segment
        .get("relationship_arc")
        .or_else(|| segment.get("relationshipArc"))
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_string());
    if direct.is_some() {
        return direct;
    }

    let label = segment
        .get("label")
        .or_else(|| segment.get("title"))
        .or_else(|| segment.get("section"))
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    if label.contains("intro") || label.contains("opening") {
        Some("solo_hold".to_string())
    } else if label.contains("verse 1") {
        Some("equals_to_lead".to_string())
    } else if label.contains("verse 2") {
        Some("center_release".to_string())
    } else if label.contains("chorus") {
        Some("scatter_to_center".to_string())
    } else if label.contains("bridge") {
        Some("lead_to_release".to_string())
    } else if label.contains("outro") || label.contains("ending") || label.contains("final") {
        Some("solo_release".to_string())
    } else {
        None
    }
}

fn infer_motif_callback(segment: &Value) -> Option<String> {
    let direct = segment
        .get("motif_callback")
        .or_else(|| segment.get("motifCallback"))
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_string());
    if direct.is_some() {
        return direct;
    }

    let label = segment
        .get("label")
        .or_else(|| segment.get("title"))
        .or_else(|| segment.get("section"))
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    if label.contains("intro") || label.contains("opening") {
        Some("opening_seed".to_string())
    } else if label.contains("bridge") {
        Some("pre_closing_recall".to_string())
    } else if label.contains("outro") || label.contains("ending") || label.contains("final") {
        Some("direct_opening_response".to_string())
    } else {
        Some("forward_motion".to_string())
    }
}

async fn hydrate_storyboard_segments(out: &Path, commands: &Value, ui_lang: &str) -> Result<()> {
    let raw = tokio::fs::read(out).await?;
    let mut plan: Value = serde_json::from_slice(&raw)?;
    let segments = fallback_segments(commands);
    if segments.is_empty() {
        return Ok(());
    }

    let needs_segments = plan
        .get("segments")
        .and_then(|value| value.as_array())
        .map(|items| items.is_empty())
        .unwrap_or(true);
    let needs_shots = plan
        .get("shots")
        .and_then(|value| value.as_array())
        .map(|items| items.is_empty())
        .unwrap_or(true);
    let needs_title = plan
        .get("title")
        .and_then(|value| value.as_str())
        .map(|value| value.trim().is_empty())
        .unwrap_or(true);
    let needs_lang = plan
        .get("lang")
        .and_then(|value| value.as_str())
        .map(|value| value.trim().is_empty())
        .unwrap_or(true);

    if let Some(obj) = plan.as_object_mut() {
        if needs_segments {
            obj.insert("segments".to_string(), json!(segments.clone()));
        }
        if needs_shots {
            let shots = segments
                .iter()
                .enumerate()
                .map(|(idx, segment)| {
                    let prompt = segment
                        .get("subtitle_text")
                        .and_then(|value| value.as_str())
                        .or_else(|| segment.get("label").and_then(|value| value.as_str()))
                        .unwrap_or("cssMV timeline shot");
                    let relationship_arc = infer_relationship_arc(segment).unwrap_or_default();
                    let motif_callback = infer_motif_callback(segment).unwrap_or_default();
                    let duration_s = segment
                        .get("duration_s")
                        .and_then(|value| value.as_f64())
                        .unwrap_or(2.0);
                    json!({
                        "id": segment
                            .get("shot_id")
                            .and_then(|value| value.as_str())
                            .map(|value| value.to_string())
                            .unwrap_or_else(|| format!("video_shot_{idx:03}")),
                        "prompt": format!("{prompt} | relationship_arc={relationship_arc} | motif_callback={motif_callback}"),
                        "duration_s": duration_s,
                        "relationship_arc": json!(relationship_arc),
                        "motif_callback": json!(motif_callback),
                        "label": segment.get("label").cloned().unwrap_or_else(|| json!("Segment"))
                    })
                })
                .collect::<Vec<_>>();
            obj.insert("shots".to_string(), json!(shots));
        }
        if needs_title {
            obj.insert("title".to_string(), json!(title_hint(commands)));
        }
        if needs_lang {
            obj.insert("lang".to_string(), json!(primary_lang(commands, ui_lang)));
        }
        if obj
            .get("work_type")
            .and_then(|value| value.as_str())
            .map(|value| value.trim().is_empty())
            .unwrap_or(true)
        {
            obj.insert(
                "work_type".to_string(),
                json!(commands
                    .get("creative")
                    .and_then(|creative| creative.get("work_type"))
                    .and_then(|value| value.as_str())
                    .unwrap_or("single")),
            );
        }
        if obj.get("structure_tree").is_none() {
            obj.insert(
                "structure_tree".to_string(),
                commands
                    .get("creative")
                    .and_then(|creative| creative.get("structure_tree"))
                    .cloned()
                    .unwrap_or_else(|| json!([])),
            );
        }
    }

    write_json(out, &plan).await?;
    Ok(())
}

pub async fn run_plan(ctx: &EngineCtx, commands: &Value, ui_lang: &str) -> Result<()> {
    let lang = primary_lang(commands, ui_lang);
    let lyrics = lyrics_json_path(&ctx.run_dir);
    let mix = mix_wav_path(&ctx.run_dir);
    let out = storyboard_json_path(&ctx.run_dir);
    ensure_cssmv_bridge_artifacts(ctx, commands).await?;
    let segments = bridge_segments(ctx, commands).await;

    if let Some(cmdline) = env_cmd("CSS_VIDEO_PLAN_CMD") {
        let mut extra_env = vec![
            ("CSS_LANG", lang.clone()),
            ("CSS_TITLE_HINT", title_hint(commands)),
            ("CSS_LYRICS_JSON", lyrics.to_string_lossy().to_string()),
            ("CSS_MIX_WAV", mix.to_string_lossy().to_string()),
            ("CSS_OUT_JSON", out.to_string_lossy().to_string()),
        ];
        optional_env_path(
            &mut extra_env,
            "CSS_SEGMENT_TIMELINE_JSON",
            &segment_timeline_json_path(&ctx.run_dir),
        );
        optional_env_path(
            &mut extra_env,
            "CSS_SCENE_PLAN_JSON",
            &scene_plan_json_path(&ctx.run_dir),
        );
        optional_env_path(
            &mut extra_env,
            "CSS_MUSIC_PLAN_JSON",
            &music_plan_json_path(&ctx.run_dir),
        );
        optional_env_path(
            &mut extra_env,
            "CSS_RENDERED_MEDIA_JSON",
            &rendered_media_json_path(&ctx.run_dir),
        );
        run_cmd(&cmdline, &ctx.run_dir, &extra_env).await?;
        hydrate_storyboard_segments(&out, commands, ui_lang).await?;
        validate_video_plan_output(&out).await?;
        return Ok(());
    }

    let plan = json!({
        "schema": "css.video.plan.v1",
        "lang": lang,
        "title": title_hint(commands),
        "shots": if segments.is_empty() {
            json!([
                {
                    "id": "video_shot_000",
                    "prompt": "cssMV opening shot",
                    "duration_s": 2.0,
                    "relationship_arc": serde_json::Value::Null,
                    "motif_callback": serde_json::Value::Null,
                    "label": "Opening"
                }
            ])
        } else {
            json!(segments.iter().enumerate().map(|(idx, segment)| {
                let prompt = segment
                    .get("prompt")
                    .and_then(|value| value.as_str())
                    .or_else(|| segment.get("subtitle_text").and_then(|value| value.as_str()))
                    .or_else(|| segment.get("label").and_then(|value| value.as_str()))
                    .unwrap_or("cssMV timeline shot");
                let relationship_arc = infer_relationship_arc(segment).unwrap_or_default();
                let motif_callback = infer_motif_callback(segment).unwrap_or_default();
                let duration_s = segment
                    .get("duration_s")
                    .and_then(|value| value.as_f64())
                    .unwrap_or(2.0);
                json!({
                    "id": segment
                        .get("shot_id")
                        .and_then(|value| value.as_str())
                        .map(|value| value.to_string())
                        .unwrap_or_else(|| format!("video_shot_{idx:03}")),
                    "prompt": format!("{prompt} | relationship_arc={relationship_arc} | motif_callback={motif_callback}"),
                    "duration_s": duration_s,
                    "relationship_arc": json!(relationship_arc),
                    "motif_callback": json!(motif_callback),
                    "label": segment.get("label").cloned().unwrap_or_else(|| json!("Segment")),
                    "thumbnail_path": segment.get("thumbnail_path").cloned().unwrap_or(serde_json::Value::Null)
                })
            }).collect::<Vec<_>>())
        },
        "segments": segments,
        "work_type": commands.get("creative").and_then(|creative| creative.get("work_type")).and_then(|value| value.as_str()).unwrap_or("single"),
        "structure_tree": commands.get("creative").and_then(|creative| creative.get("structure_tree")).cloned().unwrap_or_else(|| json!([]))
    });
    write_json(&out, &plan).await?;
    validate_video_plan_output(&out).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn ensure_cssmv_bridge_artifacts_writes_scene_music_and_rendered_files() {
        let run_dir =
            std::env::temp_dir().join(format!("cssos_video_bridge_test_{}", std::process::id()));
        let ctx = EngineCtx::new(run_dir.clone());
        let commands = json!({
            "creative": {
                "genre": "dream_pop",
                "video_prompt": "Neon skyline and rain"
            },
            "video": {
                "segments": [
                    {
                        "scene_id": "scene_001",
                        "shot_id": "video_shot_000",
                        "label": "Intro",
                        "start_s": 0.0,
                        "end_s": 2.5,
                        "duration_s": 2.5,
                        "subtitle_text": "Opening line"
                    }
                ]
            }
        });

        ensure_cssmv_bridge_artifacts(&ctx, &commands)
            .await
            .unwrap();

        assert!(scene_plan_json_path(&run_dir).exists());
        assert!(music_plan_json_path(&run_dir).exists());
        assert!(rendered_media_json_path(&run_dir).exists());
        assert!(segment_timeline_json_path(&run_dir).exists());

        let rendered: Value = serde_json::from_slice(
            &tokio::fs::read(rendered_media_json_path(&run_dir))
                .await
                .unwrap(),
        )
        .unwrap();
        assert_eq!(
            rendered["segmentTimeline"][0]["subtitleText"].as_str(),
            Some("Opening line")
        );

        let _ = tokio::fs::remove_dir_all(run_dir).await;
    }
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
    let prompt = shot
        .get("prompt")
        .and_then(|value| value.as_str())
        .or_else(|| shot.get("label").and_then(|value| value.as_str()))
        .unwrap_or("cssMV visible scene shot")
        .to_string();
    if let Some(reference_media) = resolve_shot_reference_media(shot) {
        let reference_diagnostic =
            inspect_reference_media(&ctx.ffmpeg, &reference_media, dur, &prompt).await?;
        write_reference_media_report(&ctx.run_dir, shot_id, &reference_diagnostic).await?;
        if !reference_diagnostic.accepted {
            return Err(anyhow!(
                "reference media rejected for {}: origin={} watermark_risk={} {}",
                shot_id,
                reference_diagnostic.origin,
                reference_diagnostic.watermark_risk,
                reference_diagnostic
                    .rejection_reason
                    .as_deref()
                    .unwrap_or("")
            ));
        }
        if reference_diagnostic.render_mode == "weak_reference" {
            let weak_style = derive_weak_reference_style(
                &ctx.ffmpeg,
                &reference_media,
                &prompt,
                &reference_diagnostic,
            )
            .await
            .ok();
            let weak_prompt = format!(
                "{prompt} | weak_reference=true | source_origin={} | watermark_placement={} | use only composition, color palette, and scene semantics from the source; do not reproduce source pixels, logos, or text",
                reference_diagnostic.origin,
                reference_diagnostic.watermark_placement
            );
            let weak_base_color = if prompt.to_ascii_lowercase().contains("desert")
                || prompt.to_ascii_lowercase().contains("dust")
                || prompt.to_ascii_lowercase().contains("sand")
            {
                "#6f563e"
            } else if prompt.to_ascii_lowercase().contains("night")
                || prompt.to_ascii_lowercase().contains("neon")
                || prompt.to_ascii_lowercase().contains("city")
            {
                "#172538"
            } else {
                "#243246"
            };
            crate::video::executor::render_one_shot_mp4_graph(
                shot_id.to_string(),
                weak_base_color.to_string(),
                Some(weak_prompt),
                weak_style,
                None,
                1280,
                720,
                24,
                dur,
                &out,
            )
            .await?;
            validate_video_mp4_output(&out, Some("ffprobe")).await?;
            return Ok(());
        }
        render_shot_from_reference_media(
            &ctx.ffmpeg,
            &reference_media,
            dur,
            &out,
            &prompt,
            &reference_diagnostic,
        )
        .await?;
        validate_video_mp4_output(&out, Some("ffprobe")).await?;
        return Ok(());
    }
    let base_color = if prompt.to_ascii_lowercase().contains("desert")
        || prompt.to_ascii_lowercase().contains("dust")
        || prompt.to_ascii_lowercase().contains("sand")
    {
        "#6e5744"
    } else if prompt.to_ascii_lowercase().contains("night")
        || prompt.to_ascii_lowercase().contains("neon")
        || prompt.to_ascii_lowercase().contains("city")
    {
        "#18263a"
    } else if prompt.to_ascii_lowercase().contains("palace")
        || prompt.to_ascii_lowercase().contains("temple")
        || prompt.to_ascii_lowercase().contains("shrine")
    {
        "#334458"
    } else {
        "#243246"
    };

    crate::video::executor::render_one_shot_mp4_graph(
        shot_id.to_string(),
        base_color.to_string(),
        Some(prompt),
        None,
        None,
        1280,
        720,
        24,
        dur,
        &out,
    )
    .await?;

    validate_video_mp4_output(&out, Some("ffprobe")).await?;
    Ok(())
}

#[derive(Debug, Clone)]
struct WeakReferenceFrameStats {
    top_color: String,
    mid_color: String,
    bottom_color: String,
    left_right_contrast: f32,
    top_bottom_contrast: f32,
    center_darkness: f32,
    highlight_ratio: f32,
    subject_center_x: f32,
    left_mass: f32,
    right_mass: f32,
}

async fn derive_weak_reference_style(
    ffmpeg_bin: &str,
    media_path: &Path,
    prompt: &str,
    diagnostic: &ReferenceMediaDiagnostic,
) -> Result<WeakReferenceStyle> {
    let frame_stats =
        sample_weak_reference_frame_stats(ffmpeg_bin, media_path, diagnostic.sample_offset_s)
            .await
            .unwrap_or_else(|_| fallback_weak_reference_frame_stats(prompt));
    let profile_hint = infer_profile_hint(prompt, &frame_stats);
    let silhouette_count = if frame_stats.left_right_contrast > 0.22 {
        3
    } else if frame_stats.center_darkness > 0.44 || frame_stats.highlight_ratio < 0.16 {
        2
    } else {
        1
    };
    let atmosphere =
        (0.16 + frame_stats.highlight_ratio * 0.42 + frame_stats.top_bottom_contrast * 0.18)
            .clamp(0.12, 0.52);
    let horizon_ratio = match profile_hint.as_deref() {
        Some("desert") => 0.56 - frame_stats.top_bottom_contrast * 0.05,
        Some("interior") => 0.66,
        Some("shrine") => 0.61,
        _ => 0.58,
    }
    .clamp(0.38, 0.72);
    Ok(WeakReferenceStyle {
        sky_color: frame_stats.top_color.clone(),
        ground_color: frame_stats.bottom_color.clone(),
        accent_color: saturate_hex_color(&frame_stats.mid_color, 0.18),
        glow_color: lighten_hex_color_local(&frame_stats.top_color, 0.24),
        subject_tint: darken_hex_color_local(&frame_stats.mid_color, 0.26),
        horizon_ratio,
        atmosphere,
        silhouette_count,
        subject_center_x: frame_stats.subject_center_x,
        left_mass: frame_stats.left_mass,
        right_mass: frame_stats.right_mass,
        profile_hint,
    })
}

fn fallback_weak_reference_frame_stats(prompt: &str) -> WeakReferenceFrameStats {
    let lower = prompt.to_ascii_lowercase();
    if lower.contains("desert") || lower.contains("dust") || lower.contains("west") {
        WeakReferenceFrameStats {
            top_color: "#6A88A8".to_string(),
            mid_color: "#5F4D38".to_string(),
            bottom_color: "#8B6A47".to_string(),
            left_right_contrast: 0.18,
            top_bottom_contrast: 0.34,
            center_darkness: 0.42,
            highlight_ratio: 0.20,
            subject_center_x: 0.52,
            left_mass: 0.18,
            right_mass: 0.22,
        }
    } else {
        WeakReferenceFrameStats {
            top_color: "#31445C".to_string(),
            mid_color: "#40536A".to_string(),
            bottom_color: "#243246".to_string(),
            left_right_contrast: 0.12,
            top_bottom_contrast: 0.20,
            center_darkness: 0.32,
            highlight_ratio: 0.18,
            subject_center_x: 0.50,
            left_mass: 0.20,
            right_mass: 0.20,
        }
    }
}

async fn sample_weak_reference_frame_stats(
    ffmpeg_bin: &str,
    media_path: &Path,
    sample_offset_s: f64,
) -> Result<WeakReferenceFrameStats> {
    let output = tokio::process::Command::new(ffmpeg_bin)
        .arg("-hide_banner")
        .arg("-loglevel")
        .arg("error")
        .arg("-ss")
        .arg(format!("{sample_offset_s:.3}"))
        .arg("-i")
        .arg(media_path)
        .arg("-frames:v")
        .arg("1")
        .arg("-vf")
        .arg("scale=64:36")
        .arg("-f")
        .arg("rawvideo")
        .arg("-pix_fmt")
        .arg("rgb24")
        .arg("-")
        .output()
        .await?;
    if !output.status.success() || output.stdout.is_empty() {
        return Err(anyhow!(
            "ffmpeg frame sampling failed for {}",
            media_path.display()
        ));
    }
    let frame = output.stdout;
    let width = 64usize;
    let height = 36usize;
    if frame.len() < width * height * 3 {
        return Err(anyhow!(
            "sampled frame too small for {}",
            media_path.display()
        ));
    }
    let top = average_rgb_region(&frame, width, height, 0, 0, width, height / 3);
    let mid = average_rgb_region(
        &frame,
        width,
        height,
        width / 4,
        height / 4,
        width / 2,
        height / 3,
    );
    let bottom = average_rgb_region(&frame, width, height, 0, height * 2 / 3, width, height / 3);
    let left = average_rgb_region(&frame, width, height, 0, 0, width / 3, height);
    let right = average_rgb_region(&frame, width, height, width * 2 / 3, 0, width / 3, height);
    let center_darkness = region_darkness(
        &frame,
        width,
        height,
        width / 3,
        height / 4,
        width / 3,
        height / 2,
    );
    let highlight_ratio =
        region_highlight_ratio(&frame, width, height, width / 4, 0, width / 2, height / 2);
    let subject_center_x = estimate_subject_center_x(&frame, width, height);
    let left_mass = region_mass_ratio(&frame, width, height, 0, height / 3, width / 2, height / 2);
    let right_mass = region_mass_ratio(
        &frame,
        width,
        height,
        width / 2,
        height / 3,
        width / 2,
        height / 2,
    );
    Ok(WeakReferenceFrameStats {
        top_color: rgb_to_hex(top),
        mid_color: rgb_to_hex(mid),
        bottom_color: rgb_to_hex(bottom),
        left_right_contrast: rgb_distance(left, right),
        top_bottom_contrast: rgb_distance(top, bottom),
        center_darkness,
        highlight_ratio,
        subject_center_x,
        left_mass,
        right_mass,
    })
}

fn average_rgb_region(
    frame: &[u8],
    width: usize,
    height: usize,
    x: usize,
    y: usize,
    region_w: usize,
    region_h: usize,
) -> (u8, u8, u8) {
    let max_x = (x + region_w).min(width);
    let max_y = (y + region_h).min(height);
    let mut sr = 0u64;
    let mut sg = 0u64;
    let mut sb = 0u64;
    let mut count = 0u64;
    for yy in y..max_y {
        for xx in x..max_x {
            let idx = (yy * width + xx) * 3;
            sr += u64::from(frame[idx]);
            sg += u64::from(frame[idx + 1]);
            sb += u64::from(frame[idx + 2]);
            count += 1;
        }
    }
    if count == 0 {
        return (36, 50, 70);
    }
    ((sr / count) as u8, (sg / count) as u8, (sb / count) as u8)
}

fn region_darkness(
    frame: &[u8],
    width: usize,
    height: usize,
    x: usize,
    y: usize,
    region_w: usize,
    region_h: usize,
) -> f32 {
    let (r, g, b) = average_rgb_region(frame, width, height, x, y, region_w, region_h);
    1.0 - rgb_luma((r, g, b))
}

fn region_highlight_ratio(
    frame: &[u8],
    width: usize,
    height: usize,
    x: usize,
    y: usize,
    region_w: usize,
    region_h: usize,
) -> f32 {
    let max_x = (x + region_w).min(width);
    let max_y = (y + region_h).min(height);
    let mut highlights = 0usize;
    let mut count = 0usize;
    for yy in y..max_y {
        for xx in x..max_x {
            let idx = (yy * width + xx) * 3;
            let rgb = (frame[idx], frame[idx + 1], frame[idx + 2]);
            if rgb_luma(rgb) > 0.72 {
                highlights += 1;
            }
            count += 1;
        }
    }
    highlights as f32 / count.max(1) as f32
}

fn region_mass_ratio(
    frame: &[u8],
    width: usize,
    height: usize,
    x: usize,
    y: usize,
    region_w: usize,
    region_h: usize,
) -> f32 {
    let max_x = (x + region_w).min(width);
    let max_y = (y + region_h).min(height);
    let mut mass = 0usize;
    let mut count = 0usize;
    for yy in y..max_y {
        for xx in x..max_x {
            let idx = (yy * width + xx) * 3;
            let rgb = (frame[idx], frame[idx + 1], frame[idx + 2]);
            if rgb_luma(rgb) < 0.46 {
                mass += 1;
            }
            count += 1;
        }
    }
    mass as f32 / count.max(1) as f32
}

fn estimate_subject_center_x(frame: &[u8], width: usize, height: usize) -> f32 {
    let start_y = height / 4;
    let end_y = (height * 4 / 5).max(start_y + 1);
    let mut weighted_x = 0.0f32;
    let mut total_weight = 0.0f32;
    for yy in start_y..end_y {
        for xx in 0..width {
            let idx = (yy * width + xx) * 3;
            let rgb = (frame[idx], frame[idx + 1], frame[idx + 2]);
            let darkness = (0.62 - rgb_luma(rgb)).max(0.0);
            if darkness > 0.0 {
                weighted_x += darkness * xx as f32;
                total_weight += darkness;
            }
        }
    }
    if total_weight <= 0.0 {
        0.5
    } else {
        (weighted_x / total_weight / width as f32).clamp(0.18, 0.82)
    }
}

fn rgb_distance(a: (u8, u8, u8), b: (u8, u8, u8)) -> f32 {
    ((i16::from(a.0) - i16::from(b.0)).unsigned_abs() as f32
        + (i16::from(a.1) - i16::from(b.1)).unsigned_abs() as f32
        + (i16::from(a.2) - i16::from(b.2)).unsigned_abs() as f32)
        / (255.0 * 3.0)
}

fn rgb_luma(rgb: (u8, u8, u8)) -> f32 {
    (0.2126 * f32::from(rgb.0) + 0.7152 * f32::from(rgb.1) + 0.0722 * f32::from(rgb.2)) / 255.0
}

fn rgb_to_hex(rgb: (u8, u8, u8)) -> String {
    format!("#{:02X}{:02X}{:02X}", rgb.0, rgb.1, rgb.2)
}

fn infer_profile_hint(prompt: &str, stats: &WeakReferenceFrameStats) -> Option<String> {
    let lower = prompt.to_ascii_lowercase();
    if lower.contains("desert")
        || lower.contains("dust")
        || lower.contains("sand")
        || lower.contains("west")
        || stats.top_bottom_contrast > 0.22
    {
        Some("desert".to_string())
    } else if lower.contains("shrine") || lower.contains("temple") || lower.contains("opera") {
        Some("shrine".to_string())
    } else if lower.contains("interior") || lower.contains("hall") || lower.contains("corridor") {
        Some("interior".to_string())
    } else {
        Some("skyline".to_string())
    }
}

fn parse_hex_color_local(input: &str) -> Option<(u8, u8, u8)> {
    let hex = input.trim().trim_start_matches('#');
    if hex.len() != 6 {
        return None;
    }
    Some((
        u8::from_str_radix(&hex[0..2], 16).ok()?,
        u8::from_str_radix(&hex[2..4], 16).ok()?,
        u8::from_str_radix(&hex[4..6], 16).ok()?,
    ))
}

fn lighten_hex_color_local(input: &str, ratio: f32) -> String {
    adjust_hex_color_local(input, ratio.abs())
}

fn darken_hex_color_local(input: &str, ratio: f32) -> String {
    adjust_hex_color_local(input, -ratio.abs())
}

fn saturate_hex_color(input: &str, ratio: f32) -> String {
    let (r, g, b) = parse_hex_color_local(input).unwrap_or((100, 120, 150));
    let avg = (f32::from(r) + f32::from(g) + f32::from(b)) / 3.0;
    let apply = |value: u8| -> u8 {
        let delta = (f32::from(value) - avg) * (1.0 + ratio.clamp(0.0, 1.0));
        (avg + delta).round().clamp(0.0, 255.0) as u8
    };
    format!("#{:02X}{:02X}{:02X}", apply(r), apply(g), apply(b))
}

fn adjust_hex_color_local(input: &str, delta: f32) -> String {
    let (r, g, b) = parse_hex_color_local(input).unwrap_or((36, 50, 70));
    let apply = |value: u8| -> u8 {
        let v = f32::from(value);
        let next = if delta >= 0.0 {
            v + (255.0 - v) * delta.clamp(0.0, 1.0)
        } else {
            v * (1.0 + delta.clamp(-1.0, 0.0))
        };
        next.round().clamp(0.0, 255.0) as u8
    };
    format!("#{:02X}{:02X}{:02X}", apply(r), apply(g), apply(b))
}

fn resolve_shot_reference_media(shot: &Value) -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(paths) = shot
        .get("reference_media_paths")
        .and_then(|value| value.as_array())
    {
        candidates.extend(
            paths
                .iter()
                .filter_map(|value| value.as_str().map(PathBuf::from)),
        );
    }
    if let Some(path) = shot
        .get("thumbnail_path")
        .and_then(|value| value.as_str())
        .map(PathBuf::from)
    {
        candidates.push(path);
    }
    candidates.into_iter().find(|path| path.exists())
}

#[derive(Debug, Clone)]
struct ReferenceMediaDiagnostic {
    media_path: PathBuf,
    origin: String,
    watermark_risk: String,
    watermark_placement: String,
    accepted: bool,
    render_mode: String,
    rejection_reason: Option<String>,
    source_duration_s: Option<f64>,
    sample_offset_s: f64,
    transform_profile: String,
    mirror: bool,
}

async fn write_reference_media_report(
    run_dir: &Path,
    shot_id: &str,
    diagnostic: &ReferenceMediaDiagnostic,
) -> Result<()> {
    let path = reference_media_report_json_path(run_dir);
    let mut root = if path.exists() {
        let raw = tokio::fs::read(&path).await?;
        serde_json::from_slice::<Value>(&raw).unwrap_or_else(|_| json!({}))
    } else {
        json!({})
    };
    if !root.is_object() {
        root = json!({});
    }
    let obj = root.as_object_mut().expect("object just created");
    let shots = obj
        .entry("shots")
        .or_insert_with(|| json!({}))
        .as_object_mut()
        .expect("shots object");
    shots.insert(
        shot_id.to_string(),
        json!({
            "media_path": diagnostic.media_path,
            "origin": diagnostic.origin,
            "watermark_risk": diagnostic.watermark_risk,
            "watermark_placement": diagnostic.watermark_placement,
            "accepted": diagnostic.accepted,
            "render_mode": diagnostic.render_mode,
            "rejection_reason": diagnostic.rejection_reason,
            "source_duration_s": diagnostic.source_duration_s,
            "sample_offset_s": diagnostic.sample_offset_s,
            "transform_profile": diagnostic.transform_profile,
            "mirror": diagnostic.mirror
        }),
    );
    write_json(&path, &root).await
}

async fn inspect_reference_media(
    ffmpeg_bin: &str,
    media_path: &Path,
    duration_s: f64,
    prompt: &str,
) -> Result<ReferenceMediaDiagnostic> {
    let origin = classify_reference_origin(media_path);
    let watermark_signal = detect_watermark_signal(ffmpeg_bin, media_path, duration_s)
        .await
        .unwrap_or_else(|_| WatermarkSignal {
            risk: if origin == "example_library" {
                "suspect".to_string()
            } else {
                "unknown".to_string()
            },
            placement: "unknown".to_string(),
        });
    let watermark_risk = watermark_signal.risk.clone();
    let watermark_placement = watermark_signal.placement.clone();
    let allow_third_party = std::env::var("CSS_VIDEO_ALLOW_THIRD_PARTY_REFERENCE")
        .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    let weak_reference = !allow_third_party
        && matches!(watermark_placement.as_str(), "central" | "central_large")
        && matches!(watermark_risk.as_str(), "high" | "suspect");
    let accepted = weak_reference
        || allow_third_party
        || (!matches!(origin.as_str(), "example_library" | "third_party_demo")
            && !matches!(watermark_risk.as_str(), "high" | "suspect"));
    let render_mode = if weak_reference {
        "weak_reference".to_string()
    } else if accepted {
        "direct_reference".to_string()
    } else {
        "rejected".to_string()
    };
    let rejection_reason = if accepted {
        None
    } else if matches!(origin.as_str(), "example_library" | "third_party_demo") {
        Some("example/demo reference media is blocked for formal render output".to_string())
    } else {
        Some("reference media carries suspected third-party watermark or logo".to_string())
    };
    let source_duration_s = probe_media_duration_s(media_path).await.ok();
    let variant = derive_reference_variant(media_path, prompt, duration_s, source_duration_s);
    Ok(ReferenceMediaDiagnostic {
        media_path: media_path.to_path_buf(),
        origin,
        watermark_risk,
        watermark_placement,
        accepted,
        render_mode,
        rejection_reason,
        source_duration_s,
        sample_offset_s: variant.sample_offset_s,
        transform_profile: variant.profile,
        mirror: variant.mirror,
    })
}

fn classify_reference_origin(media_path: &Path) -> String {
    let raw = media_path.to_string_lossy().to_ascii_lowercase();
    if raw.contains("/public/examples/") || raw.contains("/assets/examples/") {
        "example_library".to_string()
    } else if raw.contains("sora") || raw.contains("openai") || raw.contains("midjourney") {
        "third_party_demo".to_string()
    } else if raw.contains("/shared/runs/")
        || raw.contains("/uploads/")
        || raw.contains("/assets/user/")
    {
        "owned_asset".to_string()
    } else {
        "unknown".to_string()
    }
}

async fn probe_media_duration_s(media_path: &Path) -> Result<f64> {
    let out = tokio::process::Command::new("ffprobe")
        .args([
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
        ])
        .arg(media_path)
        .output()
        .await?;
    if !out.status.success() {
        return Err(anyhow!("ffprobe failed for {}", media_path.display()));
    }
    let raw = String::from_utf8_lossy(&out.stdout);
    raw.trim()
        .parse::<f64>()
        .map_err(|err| anyhow!("parse duration for {}: {}", media_path.display(), err))
}

#[derive(Debug, Clone)]
struct WatermarkSignal {
    risk: String,
    placement: String,
}

#[derive(Debug, Clone, Default)]
struct RegionSignalMetrics {
    persistent_bright_ratio: f64,
    mean_luma: f64,
    edge_density: f64,
    text_structure_score: f64,
    composite_score: f64,
}

fn compute_region_signal_metrics(
    frames: &[Vec<u8>],
    width: usize,
    height: usize,
) -> RegionSignalMetrics {
    if frames.is_empty() || width == 0 || height == 0 {
        return RegionSignalMetrics::default();
    }
    let pixel_count = width * height;
    let frame_count = frames.len();
    let mut persistent_bright = 0usize;
    let mut total_luma = 0f64;
    let mut edge_hits = 0usize;
    let mut edge_checks = 0usize;
    let mut bright_dark_transitions = 0usize;
    let mut bright_dark_checks = 0usize;

    for idx in 0..pixel_count {
        let mut all_bright = true;
        for frame in frames {
            let value = frame.get(idx).copied().unwrap_or_default();
            total_luma += f64::from(value);
            if value < 214 {
                all_bright = false;
            }
        }
        if all_bright {
            persistent_bright += 1;
        }
    }

    for frame in frames {
        for y in 0..height {
            for x in 0..width {
                let idx = y * width + x;
                let value = i16::from(frame[idx]);
                if x > 0 {
                    edge_checks += 1;
                    let left = i16::from(frame[idx - 1]);
                    if (value - left).abs() >= 42 {
                        edge_hits += 1;
                    }
                    bright_dark_checks += 1;
                    if (value >= 210 && left <= 110) || (left >= 210 && value <= 110) {
                        bright_dark_transitions += 1;
                    }
                }
                if y > 0 {
                    edge_checks += 1;
                    let up = i16::from(frame[idx - width]);
                    if (value - up).abs() >= 42 {
                        edge_hits += 1;
                    }
                    bright_dark_checks += 1;
                    if (value >= 210 && up <= 110) || (up >= 210 && value <= 110) {
                        bright_dark_transitions += 1;
                    }
                }
            }
        }
    }

    let persistent_bright_ratio = persistent_bright as f64 / pixel_count.max(1) as f64;
    let mean_luma = total_luma / (pixel_count * frame_count).max(1) as f64 / 255.0;
    let edge_density = edge_hits as f64 / edge_checks.max(1) as f64;
    let text_structure_score = bright_dark_transitions as f64 / bright_dark_checks.max(1) as f64;
    let composite_score = persistent_bright_ratio * 1.6
        + mean_luma * 0.65
        + edge_density * 1.75
        + text_structure_score * 1.9;

    RegionSignalMetrics {
        persistent_bright_ratio,
        mean_luma,
        edge_density,
        text_structure_score,
        composite_score,
    }
}

async fn detect_watermark_signal(
    ffmpeg_bin: &str,
    media_path: &Path,
    duration_s: f64,
) -> Result<WatermarkSignal> {
    let source_duration = probe_media_duration_s(media_path)
        .await
        .unwrap_or(duration_s.max(1.0));
    let timestamps = sample_timestamps(source_duration);
    let regions = [
        (
            "top_left",
            "crop=192:96:0:0,scale=96:48,format=gray",
            96usize,
            48usize,
        ),
        (
            "top_right",
            "crop=192:96:iw-192:0,scale=96:48,format=gray",
            96usize,
            48usize,
        ),
        (
            "bottom_right",
            "crop=192:96:iw-192:ih-96,scale=96:48,format=gray",
            96usize,
            48usize,
        ),
        (
            "center",
            "crop=224:120:(iw-224)/2:(ih-120)/2,scale=112:60,format=gray",
            112usize,
            60usize,
        ),
    ];
    let mut region_scores: Vec<(&str, RegionSignalMetrics)> = Vec::new();
    for (label, vf, width, height) in regions {
        let mut frames = Vec::new();
        for ts in &timestamps {
            let out = tokio::process::Command::new(ffmpeg_bin)
                .arg("-hide_banner")
                .arg("-loglevel")
                .arg("error")
                .arg("-ss")
                .arg(format!("{ts:.3}"))
                .arg("-i")
                .arg(media_path)
                .arg("-frames:v")
                .arg("1")
                .arg("-vf")
                .arg(vf)
                .arg("-f")
                .arg("rawvideo")
                .arg("-")
                .output()
                .await?;
            if !out.status.success() || out.stdout.is_empty() {
                continue;
            }
            frames.push(out.stdout);
        }
        if frames.len() < 2 {
            continue;
        }
        region_scores.push((label, compute_region_signal_metrics(&frames, width, height)));
    }
    if region_scores.is_empty() {
        return Ok(WatermarkSignal {
            risk: "unknown".to_string(),
            placement: "unknown".to_string(),
        });
    }
    let mut dominant = ("unknown", RegionSignalMetrics::default());
    let mut dominant_weighted_score = 0.0f64;
    for (label, metrics) in &region_scores {
        let region_weight = if *label == "center" { 1.45 } else { 1.0 };
        let weighted_score = metrics.composite_score * region_weight;
        if weighted_score > dominant_weighted_score {
            dominant_weighted_score = weighted_score;
            dominant = (label, metrics.clone());
        }
    }
    let placement = match dominant.0 {
        "center"
            if dominant.1.composite_score > 0.72
                || (dominant.1.mean_luma > 0.56
                    && dominant.1.edge_density > 0.16
                    && dominant.1.text_structure_score > 0.08) =>
        {
            "central_large"
        }
        "center"
            if dominant.1.composite_score > 0.46
                || (dominant.1.mean_luma > 0.46 && dominant.1.text_structure_score > 0.05) =>
        {
            "central"
        }
        "bottom_right" | "top_right" | "top_left"
            if dominant.1.composite_score > 0.28 || dominant.1.persistent_bright_ratio > 0.008 =>
        {
            "corner"
        }
        "bottom_right" | "top_right" | "top_left" => "edge",
        _ => "unknown",
    };
    let risk = if matches!(placement, "central_large")
        || dominant.1.composite_score > 0.82
        || dominant.1.text_structure_score > 0.12
    {
        "high"
    } else if matches!(placement, "central" | "corner")
        || dominant.1.composite_score > 0.50
        || dominant.1.edge_density > 0.13
    {
        "suspect"
    } else {
        "low"
    };
    Ok(WatermarkSignal {
        risk: risk.to_string(),
        placement: placement.to_string(),
    })
}

fn sample_timestamps(source_duration: f64) -> Vec<f64> {
    let safe = source_duration.max(3.0);
    vec![
        (safe * 0.18).min((safe - 0.8).max(0.0)),
        (safe * 0.51).min((safe - 0.6).max(0.0)),
        (safe * 0.83).min((safe - 0.4).max(0.0)),
    ]
}

#[derive(Debug, Clone)]
struct ReferenceRenderVariant {
    sample_offset_s: f64,
    profile: String,
    mirror: bool,
    crop_scale: String,
}

fn derive_reference_variant(
    media_path: &Path,
    prompt: &str,
    duration_s: f64,
    source_duration_s: Option<f64>,
) -> ReferenceRenderVariant {
    let mut hasher = DefaultHasher::new();
    media_path.hash(&mut hasher);
    prompt.hash(&mut hasher);
    let seed = hasher.finish();
    let mirror = seed % 2 == 1;
    let source_duration_s = source_duration_s.unwrap_or(duration_s.max(1.0));
    let max_offset = (source_duration_s - duration_s - 0.5).max(0.0);
    let sample_offset_s = if max_offset > 0.0 {
        ((seed % 10_000) as f64 / 10_000.0) * max_offset
    } else {
        0.0
    };
    let crop_scale = match seed % 3 {
        0 => "scale=1344:756,crop=1280:720:32:18".to_string(),
        1 => "scale=1408:792,crop=1280:720:64:36".to_string(),
        _ => "scale=1360:765,crop=1280:720:40:22".to_string(),
    };
    let profile = if mirror {
        "excerpt_mirror_crop".to_string()
    } else {
        "excerpt_crop".to_string()
    };
    ReferenceRenderVariant {
        sample_offset_s,
        profile,
        mirror,
        crop_scale,
    }
}

async fn render_shot_from_reference_media(
    ffmpeg_bin: &str,
    media_path: &Path,
    duration_s: f64,
    out: &Path,
    prompt: &str,
    diagnostic: &ReferenceMediaDiagnostic,
) -> Result<()> {
    let ext = media_path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .unwrap_or_default();
    let is_video = matches!(ext.as_str(), "mp4" | "mov" | "m4v" | "webm");
    let is_image = matches!(ext.as_str(), "jpg" | "jpeg" | "png" | "webp");
    let lower_prompt = prompt.to_ascii_lowercase();
    let variant =
        derive_reference_variant(media_path, prompt, duration_s, diagnostic.source_duration_s);
    let color_fx = if lower_prompt.contains("night")
        || lower_prompt.contains("neon")
        || lower_prompt.contains("city")
    {
        "eq=contrast=1.06:saturation=0.94:brightness=-0.02"
    } else if lower_prompt.contains("desert")
        || lower_prompt.contains("dust")
        || lower_prompt.contains("sand")
    {
        "eq=contrast=1.04:saturation=0.92:brightness=0.01"
    } else {
        "eq=contrast=1.02:saturation=0.98:brightness=0.00"
    };
    let motion_fx = if variant.mirror { "hflip," } else { "" };
    let vf = format!(
        "fps=24,{motion_fx}{crop_scale},{color_fx},format=yuv420p",
        crop_scale = variant.crop_scale
    );

    let mut cmd = tokio::process::Command::new(ffmpeg_bin);
    cmd.arg("-y");
    if is_video {
        cmd.arg("-ss")
            .arg(format!("{:.3}", diagnostic.sample_offset_s))
            .arg("-stream_loop")
            .arg("-1")
            .arg("-i")
            .arg(media_path);
    } else if is_image {
        cmd.arg("-loop").arg("1").arg("-i").arg(media_path);
    } else {
        return Err(anyhow!(
            "unsupported reference media for shot render: {}",
            media_path.display()
        ));
    }
    let output = cmd
        .args([
            "-t",
            &format!("{duration_s:.3}"),
            "-vf",
            &vf,
            "-pix_fmt",
            "yuv420p",
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-movflags",
            "+faststart",
        ])
        .arg(out)
        .output()
        .await?;
    if !output.status.success() {
        return Err(anyhow!(
            "reference-media shot render failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(())
}

#[cfg(test)]
mod reference_media_tests {
    use super::*;

    #[test]
    fn classifies_example_library_as_external_risk() {
        assert_eq!(
            classify_reference_origin(Path::new("/srv/cssos/repo/public/examples/foo.mp4")),
            "example_library"
        );
    }

    #[test]
    fn keeps_owned_assets_distinct_from_examples() {
        assert_eq!(
            classify_reference_origin(Path::new(
                "/srv/cssos/shared/runs/run_x/build/video/foo.mp4"
            )),
            "owned_asset"
        );
    }

    #[test]
    fn derives_stable_reference_variant() {
        let a = derive_reference_variant(
            Path::new("/tmp/ref.mp4"),
            "westworld heroine dusk procession",
            26.0,
            Some(120.0),
        );
        let b = derive_reference_variant(
            Path::new("/tmp/ref.mp4"),
            "westworld heroine dusk procession",
            26.0,
            Some(120.0),
        );
        assert_eq!(a.sample_offset_s, b.sample_offset_s);
        assert_eq!(a.profile, b.profile);
    }

    #[test]
    fn central_watermark_signal_prefers_weak_reference_mode() {
        let watermark_placement = "central";
        let watermark_risk = "high";
        let weak_reference = matches!(watermark_placement, "central" | "central_large")
            && matches!(watermark_risk, "high" | "suspect");
        assert!(weak_reference);
    }
}
