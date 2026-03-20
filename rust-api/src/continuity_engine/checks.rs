use crate::continuity_engine::types::{ContinuityCode, ContinuityIssue, ContinuitySeverity};

pub fn check_time_continuity(
    events: &[crate::event_engine::types::EngineEvent],
) -> Vec<ContinuityIssue> {
    let mut out = Vec::new();
    let mut last_level: Option<usize> = None;
    for (idx, ev) in events.iter().enumerate() {
        let Some(label) = ev.payload.get("time_of_day").and_then(|x| x.as_str()) else {
            continue;
        };
        let level = time_level(label);
        if let Some(prev) = last_level {
            if level.abs_diff(prev) > crate::continuity_engine::rules::MAX_TIME_JUMP_LEVELS {
                out.push(ContinuityIssue {
                    code: ContinuityCode::TimeJumpUnexplained,
                    severity: ContinuitySeverity::Info,
                    message: "时间段跳变过大，建议检查是否缺少时间过渡。".into(),
                    scene_id: ev.meta.scene_id.clone(),
                    event_index: Some(idx),
                });
                break;
            }
        }
        last_level = Some(level);
    }
    out
}

pub fn check_location_continuity(
    snapshot: &crate::film_runtime::snapshot::FilmRuntimeSnapshot,
    run_state: &crate::run_state::RunState,
) -> Vec<ContinuityIssue> {
    let mut out = Vec::new();
    let Some(scene_id) = snapshot.current_scene.as_deref() else {
        return out;
    };
    let location = run_state
        .immersion
        .anchor
        .location_id
        .clone()
        .unwrap_or_else(|| "unknown".into())
        .to_lowercase();
    if scene_id.contains("rooftop") && !location.contains("roof") && location != "unknown" {
        out.push(ContinuityIssue {
            code: ContinuityCode::LocationJumpUnexplained,
            severity: ContinuitySeverity::Warning,
            message: "当前场景指向屋顶，但记录中的空间锚点位置与之不一致。".into(),
            scene_id: Some(scene_id.to_string()),
            event_index: None,
        });
    }
    out
}

pub fn check_character_position_continuity(
    events: &[crate::event_engine::types::EngineEvent],
) -> Vec<ContinuityIssue> {
    let mut out = Vec::new();
    let mut positions =
        std::collections::BTreeMap::<String, crate::physics_engine::types::Vec3>::new();
    for (idx, ev) in events.iter().enumerate() {
        if !matches!(ev.kind, crate::event_engine::types::EventKind::PhysicsMoved) {
            continue;
        }
        let Some(actor) = ev
            .payload
            .get("actor_id")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string())
        else {
            continue;
        };
        let Some(pos) = ev.payload.get("position") else {
            continue;
        };
        let next = crate::physics_engine::types::Vec3::new(
            pos.get("x").and_then(|x| x.as_f64()).unwrap_or_default() as f32,
            pos.get("y").and_then(|x| x.as_f64()).unwrap_or_default() as f32,
            pos.get("z").and_then(|x| x.as_f64()).unwrap_or_default() as f32,
        );
        if let Some(prev) = positions.get(&actor) {
            let jump = crate::physics_engine::queries::distance(*prev, next);
            if jump > crate::continuity_engine::rules::MAX_POSITION_JUMP_METERS {
                out.push(ContinuityIssue {
                    code: ContinuityCode::CharacterPositionMismatch,
                    severity: ContinuitySeverity::Info,
                    message: "角色空间位置跳变较大，建议检查场景切换是否缺少位置过渡。".into(),
                    scene_id: ev.meta.scene_id.clone(),
                    event_index: Some(idx),
                });
                break;
            }
        }
        positions.insert(actor, next);
    }
    out
}

pub fn check_object_state_continuity(
    events: &[crate::event_engine::types::EngineEvent],
) -> Vec<ContinuityIssue> {
    let mut out = Vec::new();
    for (idx, ev) in events.iter().enumerate() {
        if !matches!(
            ev.kind,
            crate::event_engine::types::EventKind::ObjectChanged
        ) {
            continue;
        }
        let state = ev
            .payload
            .get("state")
            .and_then(|x| x.as_str())
            .unwrap_or_default();
        let holder = ev.payload.get("holder").and_then(|x| x.as_str());
        if state == "open" && holder.is_some() {
            out.push(ContinuityIssue {
                code: ContinuityCode::ObjectStateMismatch,
                severity: ContinuitySeverity::Error,
                message: "物体同时处于打开状态且被持有，状态存在明显矛盾。".into(),
                scene_id: ev.meta.scene_id.clone(),
                event_index: Some(idx),
            });
        } else if state == "picked" && holder.is_none() {
            out.push(ContinuityIssue {
                code: ContinuityCode::ObjectStateMismatch,
                severity: ContinuitySeverity::Warning,
                message: "物体已被拾取，但未记录持有者。".into(),
                scene_id: ev.meta.scene_id.clone(),
                event_index: Some(idx),
            });
        }
    }
    out
}

pub fn check_camera_continuity(
    semantics: &crate::scene_semantics_engine::runtime::SceneSemanticsEngine,
    snapshot: &crate::film_runtime::snapshot::FilmRuntimeSnapshot,
) -> Vec<ContinuityIssue> {
    let mut out = Vec::new();
    let Some(scene_id) = snapshot.current_scene.as_deref() else {
        return out;
    };
    let Some(ss) = semantics.state.get(scene_id) else {
        return out;
    };
    if matches!(
        ss.semantic,
        crate::scene_semantics_engine::types::SceneSemanticKind::Confession
    ) && matches!(snapshot.camera_mode.as_deref(), Some("immersive360"))
    {
        out.push(ContinuityIssue {
            code: ContinuityCode::CameraAxisBreak,
            severity: ContinuitySeverity::Warning,
            message: "告白场景使用全景沉浸镜头，建议检查是否削弱了情感对焦与镜头连续性。".into(),
            scene_id: Some(scene_id.to_string()),
            event_index: None,
        });
    }
    out
}

fn time_level(label: &str) -> usize {
    match label {
        "dawn" => 0,
        "morning" => 1,
        "noon" => 2,
        "afternoon" => 3,
        "evening" => 4,
        "night" => 5,
        "midnight" => 6,
        _ => 0,
    }
}
