use crate::narrative_qa::types::{NarrativeQaReport, QaCode, QaIssue, QaSeverity};

pub fn check_relationship_contradictions(
    events: &[crate::event_engine::types::EngineEvent],
    snapshot: &crate::film_runtime::snapshot::FilmRuntimeSnapshot,
) -> Vec<QaIssue> {
    let mut out = Vec::new();
    let Some(node) = snapshot.current_story_node.as_deref() else {
        return out;
    };
    let harmful = node.contains("kill") || node.contains("harm") || node.contains("betray");
    let love = max_metric(events, "love");
    let loyalty = max_metric(events, "loyalty");

    if harmful
        && (love >= crate::narrative_qa::rules::LOVE_BLOCK_HARM_THRESHOLD
            || loyalty >= crate::narrative_qa::rules::LOYALTY_BLOCK_HARM_THRESHOLD)
    {
        out.push(QaIssue {
            code: QaCode::RelationshipContradiction,
            severity: QaSeverity::Error,
            message: "角色关系指标已显示高爱/高忠诚，却进入了明显伤害对方的叙事节点。".into(),
            scene_id: snapshot.current_scene.clone(),
            event_index: None,
        });
    }

    out
}

pub fn check_emotion_jump(events: &[crate::event_engine::types::EngineEvent]) -> Vec<QaIssue> {
    let mut out = Vec::new();
    let mut last_intensity: Option<i32> = None;
    for (idx, ev) in events.iter().enumerate() {
        if !matches!(
            ev.kind,
            crate::event_engine::types::EventKind::EmotionChanged
        ) {
            continue;
        }
        let intensity = ev
            .payload
            .get("intensity")
            .and_then(|x| x.as_i64())
            .unwrap_or_default() as i32;
        if let Some(prev) = last_intensity {
            if (intensity - prev).abs() >= 60 {
                out.push(QaIssue {
                    code: QaCode::EmotionJumpTooLarge,
                    severity: QaSeverity::Warning,
                    message: "角色情绪强度跳变过大，建议检查此前是否存在充分触发事件。".into(),
                    scene_id: ev.meta.scene_id.clone(),
                    event_index: Some(idx),
                });
                break;
            }
        }
        last_intensity = Some(intensity);
    }
    out
}

pub fn check_scene_semantic_match(
    semantics: &crate::scene_semantics_engine::runtime::SceneSemanticsEngine,
    snapshot: &crate::film_runtime::snapshot::FilmRuntimeSnapshot,
) -> Vec<QaIssue> {
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
    ) && !matches!(
        snapshot.camera_mode.as_deref(),
        Some("dialoguetwoshot" | "overshoulder" | "cinematic")
    ) {
        out.push(QaIssue {
            code: QaCode::SceneSemanticMismatch,
            severity: QaSeverity::Warning,
            message: "告白场景的镜头语言与场景语义不够匹配。".into(),
            scene_id: Some(scene_id.to_string()),
            event_index: None,
        });
    }

    out
}

pub fn check_ending_setup(
    events: &[crate::event_engine::types::EngineEvent],
    snapshot: &crate::film_runtime::snapshot::FilmRuntimeSnapshot,
) -> Vec<QaIssue> {
    let mut out = Vec::new();
    let Some(node) = snapshot.current_story_node.as_deref() else {
        return out;
    };
    if node != "ending_reunion" {
        return out;
    }
    let trust = max_metric(events, "trust");
    let has_setup = events.iter().any(|ev| {
        ev.payload
            .get("node_id")
            .and_then(|x| x.as_str())
            .map(|s| s.contains("confession") || s.contains("reunion") || s.contains("help"))
            .unwrap_or(false)
    });
    if trust < crate::narrative_qa::rules::TRUST_REQUIRED_FOR_REUNION_ENDING && !has_setup {
        out.push(QaIssue {
            code: QaCode::EndingInsufficientSetup,
            severity: QaSeverity::Warning,
            message: "重逢结局缺少足够的信任/情感铺垫。".into(),
            scene_id: snapshot.current_scene.clone(),
            event_index: None,
        });
    }
    out
}

pub fn check_character_motivation_break(
    commands: &serde_json::Value,
    snapshot: &crate::film_runtime::snapshot::FilmRuntimeSnapshot,
) -> Vec<QaIssue> {
    let mut out = Vec::new();
    let Some(node) = snapshot.current_story_node.as_deref() else {
        return out;
    };
    let creative_blob = commands
        .get("creative")
        .map(|v| v.to_string().to_lowercase())
        .unwrap_or_default();
    if creative_blob.contains("truth") && node.contains("abandon_truth") {
        out.push(QaIssue {
            code: QaCode::CharacterMotivationBreak,
            severity: QaSeverity::Error,
            message: "角色长期目标指向真相追寻，但当前叙事节点出现了无铺垫的目标放弃。".into(),
            scene_id: snapshot.current_scene.clone(),
            event_index: None,
        });
    }
    out
}

pub fn passed_from_issues(issues: &[QaIssue]) -> bool {
    !issues
        .iter()
        .any(|x| matches!(x.severity, QaSeverity::Error))
}

fn max_metric(events: &[crate::event_engine::types::EngineEvent], key: &str) -> i32 {
    events
        .iter()
        .filter_map(|ev| ev.payload.get(key).and_then(|x| x.as_i64()))
        .max()
        .unwrap_or_default() as i32
}

pub fn empty_report() -> NarrativeQaReport {
    NarrativeQaReport {
        passed: true,
        issues: Vec::new(),
    }
}
