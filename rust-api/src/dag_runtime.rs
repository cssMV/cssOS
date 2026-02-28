use crate::run_state::{RunState, StageRecord, StageStatus};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Debug, Clone)]
pub struct ReadyView {
    pub ready: Vec<String>,
    pub running: Vec<String>,
    pub blocked: Vec<String>,
    pub done: Vec<String>,
}

pub fn compute_ready_view(state: &RunState, deps: &BTreeMap<String, Vec<String>>) -> ReadyView {
    let mut ready = Vec::new();
    let mut running = Vec::new();
    let mut blocked = Vec::new();
    let mut done = Vec::new();

    for (name, rec) in &state.stages {
        match rec.status {
            StageStatus::RUNNING => running.push(name.clone()),
            StageStatus::SUCCEEDED | StageStatus::SKIPPED | StageStatus::FAILED => done.push(name.clone()),
            StageStatus::PENDING => {
                if deps_satisfied(name, state, deps) {
                    ready.push(name.clone());
                } else {
                    blocked.push(name.clone());
                }
            }
        }
    }

    ready.sort();
    running.sort();
    blocked.sort();
    done.sort();

    ReadyView { ready, running, blocked, done }
}

fn deps_satisfied(stage: &str, state: &RunState, deps: &BTreeMap<String, Vec<String>>) -> bool {
    let ds = deps.get(stage).cloned().unwrap_or_default();
    for d in ds {
        let Some(r) = state.stages.get(&d) else { return false; };
        match r.status {
            StageStatus::SUCCEEDED | StageStatus::SKIPPED => {}
            _ => return false,
        }
    }
    true
}

pub fn ensure_stage(state: &mut RunState, name: &str) {
    if state.stages.contains_key(name) {
        return;
    }
    state.stages.insert(
        name.to_string(),
        StageRecord {
            status: StageStatus::PENDING,
            started_at: None,
            ended_at: None,
            exit_code: None,
            command: None,
            outputs: vec![],
            retries: 0,
            error: None,
            heartbeat_at: None,
            meta: None,
        },
    );
}

pub fn set_downstream_pending(state: &mut RunState, start: &str, deps: &BTreeMap<String, Vec<String>>) {
    let mut rev: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for (k, ds) in deps {
        for d in ds {
            rev.entry(d.clone()).or_default().push(k.clone());
        }
    }

    let mut q = vec![start.to_string()];
    let mut seen = BTreeSet::new();
    seen.insert(start.to_string());

    while let Some(cur) = q.pop() {
        let children = rev.get(&cur).cloned().unwrap_or_default();
        for c in children {
            if seen.insert(c.clone()) {
                if let Some(r) = state.stages.get_mut(&c) {
                    if !matches!(r.status, StageStatus::RUNNING) {
                        r.status = StageStatus::PENDING;
                        r.started_at = None;
                        r.ended_at = None;
                        r.exit_code = None;
                        r.error = None;
                        r.outputs.clear();
                    }
                }
                q.push(c);
            }
        }
    }
}
