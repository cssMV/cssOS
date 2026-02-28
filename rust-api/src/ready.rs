use crate::dag::Dag;
use crate::run_state::{RunState, StageStatus};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadyView {
    pub schema: String,
    pub run_id: String,
    pub updated_at: String,
    pub dag_schema: String,
    pub topo_order: Vec<String>,
    pub ready: Vec<String>,
    pub running: Vec<String>,
    pub summary: ReadySummary,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ReadySummary {
    pub total: usize,
    pub pending: usize,
    pub running: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub skipped: usize,
}

fn deps_for_stage(dag: &Dag, st: &RunState, stage: &str) -> Vec<String> {
    if stage.starts_with("video_shot_") {
        return vec!["video_plan".to_string()];
    }
    if stage == "video_assemble" {
        let mut shots: Vec<String> = st
            .stages
            .keys()
            .filter(|k| k.starts_with("video_shot_"))
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
    let deps = deps_for_stage(dag, st, stage);
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

pub fn compute_ready_view(st: &RunState, dag: &Dag) -> ReadyView {
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
                if stage_ready(dag, st, name) {
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
        schema: "css.pipeline.ready.v1".to_string(),
        run_id: st.run_id.clone(),
        updated_at: st.updated_at.clone(),
        dag_schema: st.dag.schema.clone(),
        topo_order: st.topo_order.clone(),
        ready,
        running,
        summary,
    }
}
