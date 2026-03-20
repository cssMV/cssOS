pub fn event_equivalent(
    a: &crate::event_engine::types::EngineEvent,
    b: &crate::event_engine::types::EngineEvent,
) -> bool {
    if a.kind != b.kind || a.meta.scene_id != b.meta.scene_id {
        return false;
    }
    let a_node = a.payload.get("node_id").and_then(|x| x.as_str());
    let b_node = b.payload.get("node_id").and_then(|x| x.as_str());
    a_node == b_node
}

pub fn shared_prefix_len(
    left: &[crate::event_engine::types::EngineEvent],
    right: &[crate::event_engine::types::EngineEvent],
) -> usize {
    let n = left.len().min(right.len());
    let mut i = 0usize;
    while i < n {
        if !event_equivalent(&left[i], &right[i]) {
            break;
        }
        i += 1;
    }
    i
}

pub fn extract_ending_id(
    snap: &crate::film_runtime::snapshot::FilmRuntimeSnapshot,
) -> Option<String> {
    let node = snap.current_story_node.as_deref()?;
    if node.starts_with("ending_") {
        Some(node.to_string())
    } else {
        None
    }
}

pub fn diff_snapshot_fields(
    left: &crate::film_runtime::snapshot::FilmRuntimeSnapshot,
    right: &crate::film_runtime::snapshot::FilmRuntimeSnapshot,
) -> Vec<String> {
    let mut out = Vec::new();
    if left.current_story_node != right.current_story_node {
        out.push("current_story_node".into());
    }
    if left.current_scene != right.current_scene {
        out.push("current_scene".into());
    }
    if left.camera_mode != right.camera_mode {
        out.push("camera_mode".into());
    }
    if left.immersion_mode != right.immersion_mode {
        out.push("immersion_mode".into());
    }
    if left.presence_kind != right.presence_kind {
        out.push("presence_kind".into());
    }
    out
}

#[cfg(test)]
mod tests {
    use crate::event_engine::types::{EngineEvent, EventDomain, EventId, EventKind, EventMeta};
    use crate::runtime_diff::compare::{event_equivalent, shared_prefix_len};

    fn ev(id: &str, kind: EventKind, scene_id: Option<&str>, node_id: Option<&str>) -> EngineEvent {
        EngineEvent {
            id: EventId(id.to_string()),
            domain: EventDomain::Story,
            kind,
            meta: EventMeta {
                ts: "2026-03-12T00:00:00Z".into(),
                scene_id: scene_id.map(|s| s.to_string()),
                branch_id: None,
                actor_id: None,
                target_id: None,
            },
            payload: serde_json::json!({
                "node_id": node_id
            }),
        }
    }

    #[test]
    fn v146_shared_prefix_stops_at_first_story_divergence() {
        let a = vec![
            ev(
                "1",
                EventKind::StoryNodeEntered,
                Some("scene_choice"),
                Some("scene_choice"),
            ),
            ev(
                "2",
                EventKind::StoryBranchResolved,
                None,
                Some("branch_help_her"),
            ),
        ];
        let b = vec![
            ev(
                "1",
                EventKind::StoryNodeEntered,
                Some("scene_choice"),
                Some("scene_choice"),
            ),
            ev(
                "2",
                EventKind::StoryBranchResolved,
                None,
                Some("branch_leave_her"),
            ),
        ];

        assert!(event_equivalent(&a[0], &b[0]));
        assert_eq!(shared_prefix_len(&a, &b), 1);
    }
}
