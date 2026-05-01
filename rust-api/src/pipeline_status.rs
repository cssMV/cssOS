use crate::dag::{cssmv_dag_active, Dag};
use crate::run_worker;
use serde_json::json;
use std::{collections::BTreeSet, fs, path::Path};

fn structure_plan_value(state: &serde_json::Value, run_dir: &Path) -> Option<serde_json::Value> {
    let build_path = run_dir.join("build").join("structure.plan.json");
    read_json_file(&build_path).or_else(|| {
        state
            .get("commands")
            .and_then(|value| value.get("creative"))
            .and_then(|value| value.get("structure_plan"))
            .cloned()
    })
}

fn structure_plan_i64(value: &serde_json::Value, key: &str) -> Option<i64> {
    value
        .get(key)
        .and_then(|entry| {
            entry
                .as_i64()
                .or_else(|| entry.as_u64().map(|raw| raw as i64))
        })
        .filter(|raw| *raw > 0)
}

fn structure_plan_text(value: &serde_json::Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(|entry| entry.as_str())
        .map(|raw| raw.to_string())
}

fn structure_path_titles(summary: &serde_json::Value) -> (serde_json::Value, serde_json::Value) {
    let path = summary
        .get("structure_path")
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default();
    let root_title = path.first().cloned().unwrap_or(serde_json::Value::Null);
    let container_title = if path.len() >= 2 {
        path.get(path.len() - 2)
            .cloned()
            .unwrap_or(serde_json::Value::Null)
    } else {
        serde_json::Value::Null
    };
    (root_title, container_title)
}

fn structure_runtime_summary(plan: Option<&serde_json::Value>) -> serde_json::Value {
    let Some(plan) = plan else {
        return json!({});
    };
    let work_type =
        structure_plan_text(plan, "work_type").or_else(|| structure_plan_text(plan, "workType"));
    let total_parts = structure_plan_i64(plan, "totalParts");
    let total_acts = structure_plan_i64(plan, "totalActs");
    let scenes_per_act = structure_plan_i64(plan, "scenesPerAct");
    let target_part_number = structure_plan_i64(plan, "targetPartNumber");
    let target_act_number = structure_plan_i64(plan, "targetActNumber");
    let scene_start = structure_plan_i64(plan, "sceneStart");
    let scene_end = structure_plan_i64(plan, "sceneEnd").or(scene_start);
    let planned_total_scenes = match (total_acts, scenes_per_act) {
        (Some(acts), Some(per_act)) => Some(acts * per_act),
        _ => None,
    };
    json!({
        "planned_work_type": work_type,
        "planned_total_parts": total_parts,
        "planned_total_acts": total_acts,
        "planned_scenes_per_act": scenes_per_act,
        "planned_total_scenes": planned_total_scenes,
        "current_part_number": target_part_number,
        "current_act_number": target_act_number,
        "current_scene_start": scene_start,
        "current_scene_end": scene_end
    })
}

fn stage_status(state: &serde_json::Value, stage: &str) -> String {
    state
        .get("stages")
        .and_then(|v| v.get(stage))
        .and_then(|v| v.get("status").or(Some(v)))
        .and_then(|v| v.as_str())
        .unwrap_or("PENDING")
        .to_string()
}

fn is_done(status: &str) -> bool {
    let s = status.to_uppercase();
    s.contains("SUCCESS") || s.contains("SUCCEEDED") || s.contains("DONE") || s == "OK"
}

fn is_pending(status: &str) -> bool {
    let s = status.to_uppercase();
    s.contains("PENDING") || s.contains("UNKNOWN")
}

fn deps_satisfied(dag: &Dag, state: &serde_json::Value, stage: &str) -> bool {
    let node = match dag.nodes.iter().find(|n| n.name == stage) {
        Some(n) => n,
        None => return false,
    };
    for d in node.deps {
        let dep_obj = &state["stages"][d];
        let st = stage_status(state, d);
        if !is_done(&st) {
            return false;
        }
        let outs = dep_obj["outputs"].as_array().cloned().unwrap_or_default();
        let ok = outs.iter().all(|p| {
            p.as_str()
                .map(|s| {
                    let ps = Path::new(s);
                    fs::metadata(ps)
                        .map(|m| m.is_file() && m.len() > 0)
                        .unwrap_or(false)
                })
                .unwrap_or(false)
        });
        if !ok {
            return false;
        }
    }
    true
}

fn ready_queue(dag: &Dag, state: &serde_json::Value) -> Vec<String> {
    let mut out = Vec::new();
    for n in &dag.nodes {
        let st = stage_status(state, n.name);
        if is_pending(&st) && deps_satisfied(dag, state, n.name) {
            out.push(n.name.to_string());
        }
    }
    out
}

fn artifact_stage_value(state: &serde_json::Value, stage: &str) -> Option<String> {
    state
        .get("artifacts")
        .and_then(|value| value.as_array())
        .and_then(|items| {
            items.iter().find_map(|item| {
                let key = item.get("stage").and_then(|value| value.as_str())?;
                if key != stage {
                    return None;
                }
                item.get("path")
                    .and_then(|value| value.as_str())
                    .map(|value| value.to_string())
            })
        })
}

fn read_json_file(path: &Path) -> Option<serde_json::Value> {
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn array_len_at(value: &serde_json::Value, path: &[&str]) -> Option<i64> {
    let mut current = value;
    for key in path {
        current = current.get(*key)?;
    }
    current.as_array().map(|items| items.len() as i64)
}

fn count_structure_nodes(nodes: &serde_json::Value) -> i64 {
    fn walk(node: &serde_json::Value) -> i64 {
        let children_total = node
            .get("children")
            .and_then(|value| value.as_array())
            .map(|items| items.iter().map(walk).sum::<i64>())
            .unwrap_or(0);
        1 + children_total
    }

    nodes
        .as_array()
        .map(|items| items.iter().map(walk).sum::<i64>())
        .unwrap_or(0)
}

fn unique_scene_count_from_segments(value: &serde_json::Value) -> Option<i64> {
    let segments = value.as_array()?;
    let mut ids = BTreeSet::new();
    for segment in segments {
        if let Some(scene_id) = segment
            .get("sceneId")
            .or_else(|| segment.get("scene_id"))
            .and_then(|value| value.as_str())
        {
            ids.insert(scene_id.to_string());
        }
    }
    Some(ids.len() as i64)
}

fn normalize_shot_id_from_stage_name(name: &str) -> Option<String> {
    if let Some(index) = name.find("video_shot_") {
        let suffix = &name[index..];
        let normalized = suffix
            .chars()
            .take_while(|ch| ch.is_ascii_alphanumeric() || *ch == '_')
            .collect::<String>();
        if !normalized.is_empty() {
            return Some(normalized);
        }
    }
    if let Some(rest) = name.strip_prefix("shot.") {
        let trimmed = rest.trim();
        if !trimmed.is_empty() {
            return Some(format!("video_shot_{trimmed}"));
        }
    }
    if let Some(rest) = name.strip_prefix("video.shot:") {
        let trimmed = rest.trim();
        if !trimmed.is_empty() {
            return Some(if trimmed.starts_with("video_shot_") {
                trimmed.to_string()
            } else {
                format!("video_shot_{trimmed}")
            });
        }
    }
    None
}

fn current_video_shot_stage_name(stages: &[&serde_json::Value]) -> Option<String> {
    for wanted in ["running", "pending", "done"] {
        if let Some(name) = stages.iter().find_map(|entry| {
            let status = entry.get("status").and_then(|value| value.as_str())?;
            if pipeline_like_stage_state(status) != wanted {
                return None;
            }
            entry
                .get("name")
                .and_then(|value| value.as_str())
                .map(|value| value.to_string())
        }) {
            return Some(name);
        }
    }
    None
}

fn pipeline_like_stage_state(status: &str) -> &'static str {
    let upper = status.to_uppercase();
    if upper.contains("FAIL")
        || upper.contains("ERROR")
        || upper.contains("CANCEL")
        || upper.contains("TIMEOUT")
    {
        return "canceled";
    }
    if is_done(status) {
        return "done";
    }
    if is_pending(status) {
        return "pending";
    }
    "running"
}

fn current_video_segment_summary(
    storyboard_json: Option<&serde_json::Value>,
    rendered_media_json: Option<&serde_json::Value>,
    segment_timeline_json: Option<&serde_json::Value>,
    current_shot_id: Option<&str>,
    completed_shots: i64,
) -> serde_json::Value {
    let segments = storyboard_json
        .and_then(|value| value.get("segments"))
        .and_then(|value| value.as_array())
        .cloned()
        .or_else(|| {
            rendered_media_json
                .and_then(|value| value.get("segmentTimeline"))
                .and_then(|value| value.as_array())
                .cloned()
        })
        .or_else(|| {
            segment_timeline_json
                .and_then(|value| value.as_array())
                .cloned()
        })
        .unwrap_or_default();

    if segments.is_empty() {
        return json!({});
    }

    let current_segment = current_shot_id
        .and_then(|shot_id| {
            segments.iter().find(|segment| {
                segment
                    .get("shot_id")
                    .or_else(|| segment.get("shotId"))
                    .and_then(|value| value.as_str())
                    .map(|value| value == shot_id)
                    .unwrap_or(false)
            })
        })
        .cloned()
        .or_else(|| {
            let index = completed_shots.max(0) as usize;
            segments
                .get(index.min(segments.len().saturating_sub(1)))
                .cloned()
        });

    let Some(segment) = current_segment else {
        return json!({});
    };

    json!({
        "shot_id": segment.get("shot_id").or_else(|| segment.get("shotId")).cloned().unwrap_or(serde_json::Value::Null),
        "scene_id": segment.get("scene_id").or_else(|| segment.get("sceneId")).cloned().unwrap_or(serde_json::Value::Null),
        "label": segment.get("label").cloned().unwrap_or(serde_json::Value::Null),
        "structure_role": segment.get("structure_role").or_else(|| segment.get("structureRole")).cloned().unwrap_or(serde_json::Value::Null),
        "structure_path": segment.get("structure_path").or_else(|| segment.get("structurePath")).cloned().unwrap_or_else(|| json!([])),
        "motif_callback": segment.get("motif_callback").or_else(|| segment.get("motifCallback")).cloned().unwrap_or(serde_json::Value::Null),
        "relationship_arc": segment.get("relationship_arc").or_else(|| segment.get("relationshipArc")).cloned().unwrap_or(serde_json::Value::Null)
    })
}

fn segment_summary_for_scene_id(
    segments: &[serde_json::Value],
    scene_id: Option<&str>,
) -> serde_json::Value {
    let current_segment = scene_id
        .and_then(|target| {
            segments.iter().find(|segment| {
                segment
                    .get("scene_id")
                    .or_else(|| segment.get("sceneId"))
                    .and_then(|value| value.as_str())
                    .map(|value| value == target)
                    .unwrap_or(false)
            })
        })
        .cloned()
        .or_else(|| segments.first().cloned());
    let Some(segment) = current_segment else {
        return json!({});
    };
    json!({
        "scene_id": segment.get("scene_id").or_else(|| segment.get("sceneId")).cloned().unwrap_or(serde_json::Value::Null),
        "label": segment.get("label").cloned().unwrap_or(serde_json::Value::Null),
        "structure_role": segment.get("structure_role").or_else(|| segment.get("structureRole")).cloned().unwrap_or(serde_json::Value::Null),
        "structure_path": segment.get("structure_path").or_else(|| segment.get("structurePath")).cloned().unwrap_or_else(|| json!([])),
        "motif_callback": segment.get("motif_callback").or_else(|| segment.get("motifCallback")).cloned().unwrap_or(serde_json::Value::Null),
        "relationship_arc": segment.get("relationship_arc").or_else(|| segment.get("relationshipArc")).cloned().unwrap_or(serde_json::Value::Null)
    })
}

fn cue_summary_for_music(
    music_plan_json: Option<&serde_json::Value>,
    rendered_media_json: Option<&serde_json::Value>,
    segment_timeline_json: Option<&serde_json::Value>,
    completed_stage_count: i64,
) -> serde_json::Value {
    let cues = music_plan_json
        .and_then(|value| value.get("cues"))
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default();
    if cues.is_empty() {
        return json!({});
    }
    let cue_index = completed_stage_count.max(0) as usize;
    let cue = cues
        .get(cue_index.min(cues.len().saturating_sub(1)))
        .cloned()
        .unwrap_or_else(|| json!({}));
    let segments = rendered_media_json
        .and_then(|value| value.get("segmentTimeline"))
        .and_then(|value| value.as_array())
        .cloned()
        .or_else(|| {
            segment_timeline_json
                .and_then(|value| value.as_array())
                .cloned()
        })
        .unwrap_or_default();
    let scene_summary = segment_summary_for_scene_id(
        &segments,
        cue.get("targetSceneId").and_then(|value| value.as_str()),
    );
    json!({
        "cue_id": cue.get("cueId").cloned().unwrap_or(serde_json::Value::Null),
        "cue_label": cue.get("label").cloned().unwrap_or(serde_json::Value::Null),
        "target_scene_id": cue.get("targetSceneId").cloned().unwrap_or(serde_json::Value::Null),
        "label": scene_summary.get("label").cloned().unwrap_or(serde_json::Value::Null),
        "structure_role": scene_summary.get("structure_role").cloned().unwrap_or(serde_json::Value::Null),
        "structure_path": scene_summary.get("structure_path").cloned().unwrap_or_else(|| json!([])),
        "motif_callback": scene_summary.get("motif_callback").cloned().unwrap_or(serde_json::Value::Null),
        "relationship_arc": scene_summary.get("relationship_arc").cloned().unwrap_or(serde_json::Value::Null)
    })
}

fn cue_summary_for_kara(
    rendered_media_json: Option<&serde_json::Value>,
    segment_timeline_json: Option<&serde_json::Value>,
    completed_stage_count: i64,
) -> serde_json::Value {
    let segments = rendered_media_json
        .and_then(|value| value.get("segmentTimeline"))
        .and_then(|value| value.as_array())
        .cloned()
        .or_else(|| {
            segment_timeline_json
                .and_then(|value| value.as_array())
                .cloned()
        })
        .unwrap_or_default();
    if segments.is_empty() {
        return json!({});
    }
    let segment_index = completed_stage_count.max(0) as usize;
    let segment = segments
        .get(segment_index.min(segments.len().saturating_sub(1)))
        .cloned()
        .unwrap_or_else(|| json!({}));
    json!({
        "scene_id": segment.get("scene_id").or_else(|| segment.get("sceneId")).cloned().unwrap_or(serde_json::Value::Null),
        "label": segment.get("label").cloned().unwrap_or(serde_json::Value::Null),
        "structure_role": segment.get("structure_role").or_else(|| segment.get("structureRole")).cloned().unwrap_or(serde_json::Value::Null),
        "structure_path": segment.get("structure_path").or_else(|| segment.get("structurePath")).cloned().unwrap_or_else(|| json!([])),
        "motif_callback": segment.get("motif_callback").or_else(|| segment.get("motifCallback")).cloned().unwrap_or(serde_json::Value::Null),
        "relationship_arc": segment.get("relationship_arc").or_else(|| segment.get("relationshipArc")).cloned().unwrap_or(serde_json::Value::Null)
    })
}

pub fn build_status_json(state_path: &Path) -> anyhow::Result<serde_json::Value> {
    let s = fs::read_to_string(state_path)?;
    let state: serde_json::Value = serde_json::from_str(&s)?;
    let dag = cssmv_dag_active();
    let run_dir = state_path.parent().unwrap_or_else(|| Path::new("."));

    let ready = ready_queue(&dag, &state);
    let storyboard_path = run_dir.join("build").join("video").join("storyboard.json");
    let scene_plan_path = run_dir.join("build").join("scene.plan.json");
    let music_plan_path = run_dir.join("build").join("music.plan.json");
    let rendered_media_path = run_dir.join("build").join("rendered.media.json");
    let segment_timeline_path = run_dir.join("build").join("segment-timeline.json");

    let storyboard_json = read_json_file(&storyboard_path);
    let scene_plan_json = read_json_file(&scene_plan_path);
    let music_plan_json = read_json_file(&music_plan_path);
    let rendered_media_json = read_json_file(&rendered_media_path);
    let segment_timeline_json = read_json_file(&segment_timeline_path);
    let structure_plan_json = structure_plan_value(&state, run_dir);

    let mut stage_names = dag
        .nodes
        .iter()
        .map(|node| node.name.to_string())
        .collect::<Vec<_>>();
    if let Some(stage_map) = state.get("stages").and_then(|value| value.as_object()) {
        let known = stage_names.iter().cloned().collect::<BTreeSet<_>>();
        let mut extras = stage_map
            .keys()
            .filter(|name| !known.contains(*name))
            .cloned()
            .collect::<Vec<_>>();
        extras.sort();
        stage_names.extend(extras);
    }
    let stages = stage_names
        .iter()
        .map(|name| {
            let deps = dag
                .nodes
                .iter()
                .find(|node| node.name == name.as_str())
                .map(|node| {
                    node.deps
                        .iter()
                        .map(|dep| dep.to_string())
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            json!({
                "name": name,
                "deps": deps,
                "status": stage_status(&state, name),
            })
        })
        .collect::<Vec<_>>();

    let shot_stage_entries = stages
        .iter()
        .filter_map(|entry| {
            let name = entry.get("name").and_then(|value| value.as_str())?;
            if !(name.starts_with("video_shot_")
                || name.starts_with("shot.")
                || name.starts_with("video_shot."))
            {
                return None;
            }
            Some(entry)
        })
        .collect::<Vec<_>>();

    let completed_shots = shot_stage_entries
        .iter()
        .filter(|entry| {
            entry
                .get("status")
                .and_then(|value| value.as_str())
                .map(is_done)
                .unwrap_or(false)
        })
        .count() as i64;
    let running_shots = shot_stage_entries
        .iter()
        .filter(|entry| {
            entry
                .get("status")
                .and_then(|value| value.as_str())
                .map(|status| !is_done(status) && !is_pending(status))
                .unwrap_or(false)
        })
        .count() as i64;
    let failed_shots = shot_stage_entries
        .iter()
        .filter(|entry| {
            entry
                .get("status")
                .and_then(|value| value.as_str())
                .map(|status| {
                    let upper = status.to_uppercase();
                    upper.contains("FAIL")
                        || upper.contains("ERROR")
                        || upper.contains("CANCEL")
                        || upper.contains("TIMEOUT")
                })
                .unwrap_or(false)
        })
        .count() as i64;
    let current_shot_stage_name = current_video_shot_stage_name(&shot_stage_entries);
    let current_shot_id = current_shot_stage_name
        .as_deref()
        .and_then(normalize_shot_id_from_stage_name);

    let shots_n = artifact_stage_value(&state, "video.shots_count")
        .and_then(|value| value.parse::<i64>().ok())
        .or_else(|| {
            array_len_at(
                &storyboard_json.clone().unwrap_or_else(|| json!({})),
                &["shots"],
            )
        });

    let storyboard = artifact_stage_value(&state, "video.storyboard").or_else(|| {
        if storyboard_path.exists() {
            Some(storyboard_path.display().to_string())
        } else {
            None
        }
    });

    let scene_count = array_len_at(
        &scene_plan_json.clone().unwrap_or_else(|| json!({})),
        &["scenes"],
    )
    .or_else(|| {
        rendered_media_json
            .as_ref()
            .and_then(|value| value.get("segmentTimeline"))
            .and_then(unique_scene_count_from_segments)
    })
    .or_else(|| {
        segment_timeline_json
            .as_ref()
            .and_then(unique_scene_count_from_segments)
    });

    let segment_count = rendered_media_json
        .as_ref()
        .and_then(|value| array_len_at(value, &["segmentTimeline"]))
        .or_else(|| {
            segment_timeline_json
                .as_ref()
                .and_then(|value| value.as_array().map(|items| items.len() as i64))
        });

    let structure_node_count = storyboard_json
        .as_ref()
        .and_then(|value| {
            value
                .get("structure_tree")
                .or_else(|| value.get("structureTree"))
        })
        .map(count_structure_nodes)
        .filter(|count| *count > 0)
        .or_else(|| {
            rendered_media_json
                .as_ref()
                .and_then(|value| value.get("structureTree"))
                .map(count_structure_nodes)
                .filter(|count| *count > 0)
        })
        .or_else(|| {
            scene_plan_json
                .as_ref()
                .and_then(|value| {
                    value
                        .get("structureTree")
                        .or_else(|| value.get("structure_tree"))
                })
                .map(count_structure_nodes)
                .filter(|count| *count > 0)
        })
        .or_else(|| {
            segment_timeline_json
                .as_ref()
                .and_then(|value| {
                    value
                        .get("structureTree")
                        .or_else(|| value.get("structure_tree"))
                })
                .map(count_structure_nodes)
                .filter(|count| *count > 0)
        })
        .or_else(|| {
            rendered_media_json
                .as_ref()
                .and_then(|value| value.get("structureTree"))
                .map(count_structure_nodes)
                .filter(|count| *count > 0)
        })
        .or_else(|| {
            state
                .get("commands")
                .and_then(|value| value.get("creative"))
                .and_then(|value| value.get("structure_tree"))
                .map(count_structure_nodes)
                .filter(|count| *count > 0)
        });

    let track_count = music_plan_json
        .as_ref()
        .and_then(|value| array_len_at(value, &["tracks"]));
    let cue_count = music_plan_json
        .as_ref()
        .and_then(|value| array_len_at(value, &["cues"]));
    let subtitle_cues_count = rendered_media_json
        .as_ref()
        .and_then(|value| array_len_at(value, &["subtitleCues"]));
    let music_stage_entries = stages
        .iter()
        .filter_map(|entry| {
            let name = entry.get("name").and_then(|value| value.as_str())?;
            if !matches!(
                name,
                "music"
                    | "music_plan"
                    | "music_compose"
                    | "vocals"
                    | "vocals_align"
                    | "mix"
                    | "master"
            ) {
                return None;
            }
            Some(entry)
        })
        .collect::<Vec<_>>();
    let kara_stage_entries = stages
        .iter()
        .filter_map(|entry| {
            let name = entry.get("name").and_then(|value| value.as_str())?;
            if !(name == "subtitles"
                || name == "lyrics_timing"
                || name == "localize"
                || name == "render_lang_pack"
                || name == "publish"
                || name.starts_with("subtitles.")
                || name.starts_with("karaoke_ass.")
                || name.starts_with("lyrics_lrc.")
                || name.starts_with("render_karaoke_mv."))
            {
                return None;
            }
            Some(entry)
        })
        .collect::<Vec<_>>();
    let completed_music_stages = music_stage_entries
        .iter()
        .filter(|entry| {
            entry
                .get("status")
                .and_then(|value| value.as_str())
                .map(is_done)
                .unwrap_or(false)
        })
        .count() as i64;
    let completed_kara_stages = kara_stage_entries
        .iter()
        .filter(|entry| {
            entry
                .get("status")
                .and_then(|value| value.as_str())
                .map(is_done)
                .unwrap_or(false)
        })
        .count() as i64;
    let current_video_segment = current_video_segment_summary(
        storyboard_json.as_ref(),
        rendered_media_json.as_ref(),
        segment_timeline_json.as_ref(),
        current_shot_id.as_deref(),
        completed_shots,
    );
    let current_music_cue = cue_summary_for_music(
        music_plan_json.as_ref(),
        rendered_media_json.as_ref(),
        segment_timeline_json.as_ref(),
        completed_music_stages,
    );
    let current_kara_cue = cue_summary_for_kara(
        rendered_media_json.as_ref(),
        segment_timeline_json.as_ref(),
        completed_kara_stages,
    );
    let runtime_structure = structure_runtime_summary(structure_plan_json.as_ref());
    let (music_root_title, music_container_title) = structure_path_titles(&current_music_cue);
    let (video_root_title, video_container_title) = structure_path_titles(&current_video_segment);
    let (kara_root_title, kara_container_title) = structure_path_titles(&current_kara_cue);

    Ok(json!({
        "schema": "css.pipeline.status.v1",
        "run_state_path": state_path.display().to_string(),
        "worker": {
            "concurrency": run_worker::concurrency() as i64,
            "running": run_worker::running_count() as i64,
            "queued": run_worker::queued_count() as i64
        },
        "ready": ready,
        "stages": stages,
        "music": {
            "tracks_count": track_count,
            "cues_count": cue_count,
            "current_cue_id": current_music_cue.get("cue_id").cloned().unwrap_or(serde_json::Value::Null),
            "current_cue_label": current_music_cue.get("cue_label").cloned().unwrap_or(serde_json::Value::Null),
            "current_scene_id": current_music_cue.get("target_scene_id").cloned().unwrap_or(serde_json::Value::Null),
            "current_label": current_music_cue.get("label").cloned().unwrap_or(serde_json::Value::Null),
            "current_structure_role": current_music_cue.get("structure_role").cloned().unwrap_or(serde_json::Value::Null),
            "current_structure_path": current_music_cue.get("structure_path").cloned().unwrap_or_else(|| json!([])),
            "current_motif_callback": current_music_cue.get("motif_callback").cloned().unwrap_or(serde_json::Value::Null),
            "current_relationship_arc": current_music_cue.get("relationship_arc").cloned().unwrap_or(serde_json::Value::Null),
            "root_title": music_root_title,
            "current_container_title": music_container_title,
            "planned_work_type": runtime_structure.get("planned_work_type").cloned().unwrap_or(serde_json::Value::Null),
            "planned_total_parts": runtime_structure.get("planned_total_parts").cloned().unwrap_or(serde_json::Value::Null),
            "planned_total_acts": runtime_structure.get("planned_total_acts").cloned().unwrap_or(serde_json::Value::Null),
            "planned_scenes_per_act": runtime_structure.get("planned_scenes_per_act").cloned().unwrap_or(serde_json::Value::Null),
            "planned_total_scenes": runtime_structure.get("planned_total_scenes").cloned().unwrap_or(serde_json::Value::Null),
            "current_part_number": runtime_structure.get("current_part_number").cloned().unwrap_or(serde_json::Value::Null),
            "current_act_number": runtime_structure.get("current_act_number").cloned().unwrap_or(serde_json::Value::Null),
            "current_scene_start": runtime_structure.get("current_scene_start").cloned().unwrap_or(serde_json::Value::Null),
            "current_scene_end": runtime_structure.get("current_scene_end").cloned().unwrap_or(serde_json::Value::Null)
        },
        "video": {
            "shots_count": shots_n,
            "completed_shots": completed_shots,
            "running_shots": running_shots,
            "failed_shots": failed_shots,
            "scenes_count": scene_count,
            "segments_count": segment_count,
            "structure_nodes_count": structure_node_count,
            "current_shot_stage": current_shot_stage_name,
            "current_shot_id": current_video_segment.get("shot_id").cloned().unwrap_or(serde_json::Value::Null),
            "current_scene_id": current_video_segment.get("scene_id").cloned().unwrap_or(serde_json::Value::Null),
            "current_label": current_video_segment.get("label").cloned().unwrap_or(serde_json::Value::Null),
            "current_structure_role": current_video_segment.get("structure_role").cloned().unwrap_or(serde_json::Value::Null),
            "current_structure_path": current_video_segment.get("structure_path").cloned().unwrap_or_else(|| json!([])),
            "current_motif_callback": current_video_segment.get("motif_callback").cloned().unwrap_or(serde_json::Value::Null),
            "current_relationship_arc": current_video_segment.get("relationship_arc").cloned().unwrap_or(serde_json::Value::Null),
            "root_title": video_root_title,
            "current_container_title": video_container_title,
            "planned_work_type": runtime_structure.get("planned_work_type").cloned().unwrap_or(serde_json::Value::Null),
            "planned_total_parts": runtime_structure.get("planned_total_parts").cloned().unwrap_or(serde_json::Value::Null),
            "planned_total_acts": runtime_structure.get("planned_total_acts").cloned().unwrap_or(serde_json::Value::Null),
            "planned_scenes_per_act": runtime_structure.get("planned_scenes_per_act").cloned().unwrap_or(serde_json::Value::Null),
            "planned_total_scenes": runtime_structure.get("planned_total_scenes").cloned().unwrap_or(serde_json::Value::Null),
            "current_part_number": runtime_structure.get("current_part_number").cloned().unwrap_or(serde_json::Value::Null),
            "current_act_number": runtime_structure.get("current_act_number").cloned().unwrap_or(serde_json::Value::Null),
            "current_scene_start": runtime_structure.get("current_scene_start").cloned().unwrap_or(serde_json::Value::Null),
            "current_scene_end": runtime_structure.get("current_scene_end").cloned().unwrap_or(serde_json::Value::Null),
            "storyboard": storyboard
        },
        "kara": {
            "subtitle_cues_count": subtitle_cues_count,
            "current_scene_id": current_kara_cue.get("scene_id").cloned().unwrap_or(serde_json::Value::Null),
            "current_label": current_kara_cue.get("label").cloned().unwrap_or(serde_json::Value::Null),
            "current_structure_role": current_kara_cue.get("structure_role").cloned().unwrap_or(serde_json::Value::Null),
            "current_structure_path": current_kara_cue.get("structure_path").cloned().unwrap_or_else(|| json!([])),
            "current_motif_callback": current_kara_cue.get("motif_callback").cloned().unwrap_or(serde_json::Value::Null),
            "current_relationship_arc": current_kara_cue.get("relationship_arc").cloned().unwrap_or(serde_json::Value::Null),
            "root_title": kara_root_title,
            "current_container_title": kara_container_title,
            "planned_work_type": runtime_structure.get("planned_work_type").cloned().unwrap_or(serde_json::Value::Null),
            "planned_total_parts": runtime_structure.get("planned_total_parts").cloned().unwrap_or(serde_json::Value::Null),
            "planned_total_acts": runtime_structure.get("planned_total_acts").cloned().unwrap_or(serde_json::Value::Null),
            "planned_scenes_per_act": runtime_structure.get("planned_scenes_per_act").cloned().unwrap_or(serde_json::Value::Null),
            "planned_total_scenes": runtime_structure.get("planned_total_scenes").cloned().unwrap_or(serde_json::Value::Null),
            "current_part_number": runtime_structure.get("current_part_number").cloned().unwrap_or(serde_json::Value::Null),
            "current_act_number": runtime_structure.get("current_act_number").cloned().unwrap_or(serde_json::Value::Null),
            "current_scene_start": runtime_structure.get("current_scene_start").cloned().unwrap_or(serde_json::Value::Null),
            "current_scene_end": runtime_structure.get("current_scene_end").cloned().unwrap_or(serde_json::Value::Null)
        }
    }))
}

#[cfg(test)]
mod tests {
    use super::build_status_json;
    use serde_json::json;
    use std::{
        fs,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn build_status_json_exposes_stage_artifact_counts() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let run_dir = std::env::temp_dir().join(format!("cssos_pipeline_status_test_{unique}"));
        if run_dir.exists() {
            fs::remove_dir_all(&run_dir).ok();
        }
        fs::create_dir_all(&run_dir).unwrap();
        fs::create_dir_all(run_dir.join("build/video")).unwrap();

        fs::write(
            run_dir.join("run.json"),
            serde_json::to_vec_pretty(&json!({
                "schema": "css.run.v1",
                "stages": {
                    "video_plan": { "status": "SUCCEEDED", "outputs": [] },
                    "video_shot_000": { "status": "SUCCEEDED", "outputs": [] },
                    "video_shot_001": { "status": "RUNNING", "outputs": [] },
                    "video_assemble": { "status": "PENDING", "outputs": [] }
                },
                "artifacts": [],
                "commands": {
                    "creative": {
                        "structure_plan": {
                            "work_type": "opera",
                            "totalActs": 2,
                            "scenesPerAct": 6,
                            "scenesPerBatch": 3,
                            "targetActNumber": 1,
                            "sceneStart": 1,
                            "sceneEnd": 3
                        },
                        "structure_tree": [{
                            "nodeId": "opera_root",
                            "children": [{ "nodeId": "act_1", "children": [{ "nodeId": "scene_1" }, { "nodeId": "scene_2" }] }]
                        }]
                    }
                }
            }))
            .unwrap(),
        )
        .unwrap();

        fs::write(
            run_dir.join("build/video/storyboard.json"),
            serde_json::to_vec_pretty(&json!({
                "schema": "css.video.storyboard.v1",
                "shots": [{ "id": "video_shot_000" }, { "id": "video_shot_001" }, { "id": "video_shot_002" }],
                "structure_tree": [{
                    "nodeId": "opera_root",
                    "children": [{
                        "nodeId": "act_1",
                        "children": [{ "nodeId": "scene_1" }, { "nodeId": "scene_2" }, { "nodeId": "scene_3" }]
                    }]
                }]
            }))
            .unwrap(),
        )
        .unwrap();

        fs::write(
            run_dir.join("build/scene.plan.json"),
            serde_json::to_vec_pretty(&json!({
                "scenes": [{ "sceneId": "scene_1" }, { "sceneId": "scene_2" }]
            }))
            .unwrap(),
        )
        .unwrap();

        fs::write(
            run_dir.join("build/music.plan.json"),
            serde_json::to_vec_pretty(&json!({
                "tracks": [{ "trackId": "t1" }],
                "cues": [
                    { "cueId": "c1", "label": "Cue 1", "targetSceneId": "scene_1" },
                    { "cueId": "c2", "label": "Cue 2", "targetSceneId": "scene_2" },
                    { "cueId": "c3", "label": "Cue 3", "targetSceneId": "scene_2" }
                ]
            }))
            .unwrap(),
        )
        .unwrap();

        fs::write(
            run_dir.join("build/rendered.media.json"),
            serde_json::to_vec_pretty(&json!({
                "segmentTimeline": [
                    { "sceneId": "scene_1", "shotId": "video_shot_000", "label": "Scene 1", "structurePath": ["中国大型神话歌剧《封神榜》", "中国大型神话歌剧《封神榜》 · 第1幕", "Scene 1"] },
                    { "sceneId": "scene_2", "shotId": "video_shot_001", "label": "Scene 2", "structurePath": ["中国大型神话歌剧《封神榜》", "中国大型神话歌剧《封神榜》 · 第1幕", "Scene 2"] },
                    { "sceneId": "scene_2", "shotId": "video_shot_002", "label": "Scene 2b", "structurePath": ["中国大型神话歌剧《封神榜》", "中国大型神话歌剧《封神榜》 · 第1幕", "Scene 2b"] }
                ],
                "subtitleCues": ["a", "b", "c", "d"]
            }))
            .unwrap(),
        )
        .unwrap();

        let status = build_status_json(&run_dir.join("run.json")).unwrap();
        assert_eq!(status["music"]["tracks_count"], 1);
        assert_eq!(status["music"]["cues_count"], 3);
        assert_eq!(status["music"]["current_scene_id"], "scene_1");
        assert_eq!(status["music"]["current_structure_path"][2], "Scene 1");
        assert_eq!(status["music"]["root_title"], "中国大型神话歌剧《封神榜》");
        assert_eq!(
            status["music"]["current_container_title"],
            "中国大型神话歌剧《封神榜》 · 第1幕"
        );
        assert_eq!(status["music"]["planned_work_type"], "opera");
        assert_eq!(status["video"]["shots_count"], 3);
        assert_eq!(status["video"]["completed_shots"], 1);
        assert_eq!(status["video"]["running_shots"], 1);
        assert_eq!(status["video"]["scenes_count"], 2);
        assert_eq!(status["video"]["segments_count"], 3);
        assert_eq!(status["video"]["structure_nodes_count"], 5);
        assert_eq!(status["video"]["current_shot_id"], "video_shot_001");
        assert_eq!(status["video"]["current_scene_id"], "scene_2");
        assert_eq!(status["video"]["current_label"], "Scene 2");
        assert_eq!(
            status["video"]["current_structure_path"][1],
            "中国大型神话歌剧《封神榜》 · 第1幕"
        );
        assert_eq!(status["video"]["root_title"], "中国大型神话歌剧《封神榜》");
        assert_eq!(
            status["video"]["current_container_title"],
            "中国大型神话歌剧《封神榜》 · 第1幕"
        );
        assert_eq!(status["video"]["planned_work_type"], "opera");
        assert_eq!(status["video"]["planned_total_acts"], 2);
        assert_eq!(status["video"]["planned_scenes_per_act"], 6);
        assert_eq!(status["video"]["current_act_number"], 1);
        assert_eq!(status["video"]["current_scene_start"], 1);
        assert_eq!(status["video"]["current_scene_end"], 3);
        assert_eq!(status["kara"]["subtitle_cues_count"], 4);
        assert_eq!(status["kara"]["current_structure_path"][2], "Scene 1");
        assert_eq!(status["kara"]["root_title"], "中国大型神话歌剧《封神榜》");
        assert_eq!(
            status["kara"]["current_container_title"],
            "中国大型神话歌剧《封神榜》 · 第1幕"
        );
        assert_eq!(status["kara"]["planned_work_type"], "opera");
        fs::remove_dir_all(&run_dir).ok();
    }
}
