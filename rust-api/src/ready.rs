use crate::dag::Dag;
use crate::run_state::{RunState, StageStatus};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadyView {
    pub topo_order: Vec<String>,
    pub ready: Vec<String>,
    pub running: Vec<String>,
    pub summary: ReadySummary,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct ReadySummary {
    pub total: usize,
    pub pending: usize,
    pub running: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub skipped: usize,
}

fn deps_for_stage(dag: &Dag, st: &RunState, stage: &str) -> Vec<String> {
    if stage.starts_with("video_shot_") || stage.starts_with("video.shot:") {
        return vec!["video_plan".to_string()];
    }
    if stage == "video_assemble" {
        let mut shots: Vec<String> = st
            .stages
            .keys()
            .filter(|k| k.starts_with("video_shot_") || k.starts_with("video.shot:"))
            .cloned()
            .collect();
        shots.sort();
        if shots.is_empty() {
            return vec!["video_plan".to_string()];
        }
        return shots;
    }

    if let Some(node) = dag.nodes.iter().find(|n| n.name == stage) {
        return node.deps.iter().map(|d| (*d).to_string()).collect();
    }
    Vec::new()
}

fn deps_satisfied(dag: &Dag, st: &RunState, stage: &str) -> bool {
    if stage.starts_with("video_shot_") || stage.starts_with("video.shot:") {
        if let Some(rec) = st.stages.get("video_plan") {
            return rec.outputs.iter().all(|p| p.exists());
        }
        return false;
    }
    if stage == "video_assemble" {
        let shots: Vec<&String> = st
            .stages
            .keys()
            .filter(|k| k.starts_with("video_shot_") || k.starts_with("video.shot:"))
            .collect();
        if shots.is_empty() {
            return false;
        }
        for k in shots {
            let Some(rec) = st.stages.get(k) else {
                return false;
            };
            if !matches!(rec.status, StageStatus::SUCCEEDED) {
                return false;
            }
            if !rec.outputs.iter().all(|p| p.exists()) {
                return false;
            }
        }
        return true;
    }
    if stage == "render" {
        let ok = |k: &str| {
            st.stages
                .get(k)
                .map(|r| r.outputs.iter().all(|p| p.exists()))
                .unwrap_or(false)
        };
        return ok("lyrics") && ok("music") && ok("vocals") && ok("video_assemble");
    }

    let deps = st
        .dag_edges
        .get(stage)
        .cloned()
        .unwrap_or_else(|| deps_for_stage(dag, st, stage));
    deps.iter().all(|dep| {
        st.stages
            .get(dep)
            .map(|r| {
                matches!(r.status, StageStatus::SUCCEEDED | StageStatus::SKIPPED)
                    && r.outputs.iter().all(|p| p.exists())
            })
            .unwrap_or(false)
    })
}

pub fn stage_ready(dag: &Dag, st: &RunState, stage: &str) -> bool {
    let rec = match st.stages.get(stage) {
        Some(r) => r,
        None => return false,
    };
    if !matches!(rec.status, StageStatus::PENDING) {
        return false;
    }
    deps_satisfied(dag, st, stage)
}

pub fn compute_ready_view(st: &RunState) -> ReadyView {
    compute_ready_view_limited(st, 64)
}

pub fn compute_ready_view_limited(st: &RunState, limit: usize) -> ReadyView {
    let dag = crate::dag::cssmv_dag_v1();
    compute_ready_view_with_dag_limited(st, &dag, limit)
}

pub fn compute_ready_view_with_dag(st: &RunState, dag: &Dag) -> ReadyView {
    compute_ready_view_with_dag_limited(st, dag, 64)
}

pub fn compute_ready_view_with_dag_limited(st: &RunState, dag: &Dag, limit: usize) -> ReadyView {
    let mut running: Vec<String> = Vec::new();
    let mut ready: Vec<String> = Vec::new();
    let mut summary = ReadySummary {
        total: st.topo_order.len(),
        ..ReadySummary::default()
    };

    for name in &st.topo_order {
        let rec = match st.stages.get(name) {
            Some(r) => r,
            None => continue,
        };

        match rec.status {
            StageStatus::PENDING => {
                summary.pending += 1;
                if ready.len() < limit && !st.cancel_requested && deps_satisfied(dag, st, name) {
                    ready.push(name.clone());
                }
            }
            StageStatus::RUNNING => {
                summary.running += 1;
                running.push(name.clone());
            }
            StageStatus::SUCCEEDED => summary.succeeded += 1,
            StageStatus::FAILED => summary.failed += 1,
            StageStatus::SKIPPED => summary.skipped += 1,
        }
    }

    ReadyView {
        topo_order: st.topo_order.clone(),
        ready,
        running,
        summary,
    }
}

pub fn any_failed(st: &RunState) -> bool {
    st.stages
        .values()
        .any(|r| matches!(r.status, StageStatus::FAILED))
}

pub fn all_done(st: &RunState) -> bool {
    st.stages.values().all(|r| {
        matches!(
            r.status,
            StageStatus::SUCCEEDED | StageStatus::FAILED | StageStatus::SKIPPED
        )
    })
}
