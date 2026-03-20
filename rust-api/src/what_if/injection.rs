pub fn replace_event_at(
    events: &[crate::event_engine::types::EngineEvent],
    idx: usize,
    injected: crate::event_engine::types::EngineEvent,
) -> Vec<crate::event_engine::types::EngineEvent> {
    let mut out = events.to_vec();
    if idx < out.len() {
        out[idx] = injected;
    }
    out
}

pub fn insert_event_at(
    events: &[crate::event_engine::types::EngineEvent],
    idx: usize,
    injected: crate::event_engine::types::EngineEvent,
) -> Vec<crate::event_engine::types::EngineEvent> {
    let mut out = events.to_vec();
    let pos = idx.min(out.len());
    out.insert(pos, injected);
    out
}

pub fn apply_injection(
    events: &[crate::event_engine::types::EngineEvent],
    injection: &crate::what_if::types::WhatIfInjection,
) -> Vec<crate::event_engine::types::EngineEvent> {
    match injection.kind {
        crate::what_if::types::WhatIfInjectionKind::ReplaceEvent
        | crate::what_if::types::WhatIfInjectionKind::ReplaceChoice
        | crate::what_if::types::WhatIfInjectionKind::ReplaceIntent => replace_event_at(
            events,
            injection.cursor.event_index,
            injection.injected_event.clone(),
        ),
        crate::what_if::types::WhatIfInjectionKind::InsertEvent => insert_event_at(
            events,
            injection.cursor.event_index,
            injection.injected_event.clone(),
        ),
    }
}

#[cfg(test)]
mod tests {
    use crate::event_engine::types::{EngineEvent, EventDomain, EventId, EventKind, EventMeta};
    use crate::what_if::injection::{apply_injection, insert_event_at, replace_event_at};
    use crate::what_if::types::{WhatIfCursor, WhatIfInjection, WhatIfInjectionKind};

    fn ev(id: &str, node_id: &str) -> EngineEvent {
        EngineEvent {
            id: EventId(id.to_string()),
            domain: EventDomain::Story,
            kind: EventKind::StoryNodeEntered,
            meta: EventMeta {
                ts: "2026-03-12T00:00:00Z".into(),
                scene_id: None,
                branch_id: None,
                actor_id: None,
                target_id: None,
            },
            payload: serde_json::json!({ "node_id": node_id }),
        }
    }

    #[test]
    fn v147_replace_and_insert_injection_work() {
        let events = vec![ev("1", "a"), ev("2", "b")];
        let replaced = replace_event_at(&events, 1, ev("3", "c"));
        assert_eq!(replaced[1].payload["node_id"], "c");

        let inserted = insert_event_at(&events, 1, ev("4", "x"));
        assert_eq!(inserted.len(), 3);
        assert_eq!(inserted[1].payload["node_id"], "x");

        let applied = apply_injection(
            &events,
            &WhatIfInjection {
                kind: WhatIfInjectionKind::ReplaceEvent,
                cursor: WhatIfCursor { event_index: 0 },
                injected_event: ev("5", "z"),
            },
        );
        assert_eq!(applied[0].payload["node_id"], "z");
    }
}
