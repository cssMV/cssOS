use crate::dag::cssmv_dag_v1;
use crate::routes::AppState;
use crate::run_state::{RunState, RunStatus, StageStatus};
use crate::run_state_io::read_run_state_async;
use crate::run_store::run_state_path;
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadySummary {
    pub stages_total: usize,
    pub pending: usize,
    pub running: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub skipped: usize,
    pub video_shots_total: usize,
    pub video_shots_pending: usize,
    pub video_shots_ready: usize,
    pub video_shots_running: usize,
    pub video_shots_succeeded: usize,
    pub video_shots_failed: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadyView {
    pub schema: String,
    pub run_id: String,
    pub status: RunStatus,
    pub updated_at: String,
    pub dag: serde_json::Value,
    pub topo_order: Vec<String>,
    pub ready: Vec<String>,
    pub running: Vec<String>,
    pub summary: ReadySummary,
}

pub fn compute_ready_view(st: &RunState) -> ReadyView {
    let dag = cssmv_dag_v1();
    let mut ready = Vec::<String>::new();
    let mut running = Vec::<String>::new();

    for name in &st.topo_order {
        let Some(rec) = st.stages.get(name) else {
            continue;
        };
        if matches!(rec.status, StageStatus::RUNNING) {
            running.push(name.clone());
            continue;
        }
        if matches!(rec.status, StageStatus::PENDING) && deps_satisfied(name, st, &dag) {
            ready.push(name.clone());
        }
    }

    ready.sort();
    ready.dedup();
    running.sort();
    running.dedup();

    let mut pending = 0usize;
    let mut running_n = 0usize;
    let mut succeeded = 0usize;
    let mut failed = 0usize;
    let mut skipped = 0usize;

    let mut video_shots_total = 0usize;
    let mut video_shots_pending = 0usize;
    let mut video_shots_ready = 0usize;
    let mut video_shots_running = 0usize;
    let mut video_shots_succeeded = 0usize;
    let mut video_shots_failed = 0usize;

    for (name, rec) in &st.stages {
        let is_shot = name.starts_with("video_shot_");
        if is_shot {
            video_shots_total += 1;
        }

        match rec.status {
            StageStatus::PENDING => {
                pending += 1;
                if is_shot {
                    video_shots_pending += 1;
                    if ready.iter().any(|s| s == name) {
                        video_shots_ready += 1;
                    }
                }
            }
            StageStatus::RUNNING => {
                running_n += 1;
                if is_shot {
                    video_shots_running += 1;
                }
            }
            StageStatus::SUCCEEDED => {
                succeeded += 1;
                if is_shot {
                    video_shots_succeeded += 1;
                }
            }
            StageStatus::FAILED => {
                failed += 1;
                if is_shot {
                    video_shots_failed += 1;
                }
            }
            StageStatus::SKIPPED => skipped += 1,
        }
    }

    let summary = ReadySummary {
        stages_total: st.stages.len(),
        pending,
        running: running_n,
        succeeded,
        failed,
        skipped,
        video_shots_total,
        video_shots_pending,
        video_shots_ready,
        video_shots_running,
        video_shots_succeeded,
        video_shots_failed,
    };

    ReadyView {
        schema: "css.run.ready.v1".into(),
        run_id: st.run_id.clone(),
        status: st.status.clone(),
        updated_at: st.updated_at.clone(),
        dag: json!({
            "schema":"css.pipeline.dag.v1",
            "nodes": st.dag.nodes,
            "topo_order": st.topo_order
        }),
        topo_order: st.topo_order.clone(),
        ready,
        running,
        summary,
    }
}

fn deps_satisfied(stage: &str, st: &RunState, _dag: &crate::dag::Dag) -> bool {
    if stage.starts_with("video_shot_") {
        if let Some(rec) = st.stages.get("video_plan") {
            return rec.outputs.iter().all(|p| {
                let abs = if p.is_absolute() {
                    p.clone()
                } else {
                    st.config.out_dir.join(p)
                };
                abs.exists()
            });
        }
        return false;
    }

    if stage == "video_assemble" {
        let shots_total = st
            .commands
            .get("video")
            .and_then(|v| v.get("shots_n"))
            .and_then(|v| v.as_u64())
            .unwrap_or(8) as usize;

        for i in 0..shots_total {
            let k = format!("video_shot_{:03}", i);
            match st.stages.get(&k) {
                Some(rec) => {
                    if !rec.outputs.iter().all(|p| {
                        let abs = if p.is_absolute() {
                            p.clone()
                        } else {
                            st.config.out_dir.join(p)
                        };
                        abs.exists()
                    }) {
                        return false;
                    }
                }
                None => return false,
            }
        }
        return true;
    }

    let node = cssmv_dag_v1().nodes.into_iter().find(|n| n.name == stage);
    let Some(node) = node else {
        return false;
    };

    node.deps.iter().all(|dep| {
        if let Some(dep_rec) = st.stages.get(*dep) {
            dep_rec.outputs.iter().all(|p| {
                let abs = if p.is_absolute() {
                    p.clone()
                } else {
                    st.config.out_dir.join(p)
                };
                abs.exists()
            })
        } else {
            false
        }
    })
}

pub fn ready_json(st: &RunState) -> serde_json::Value {
    serde_json::to_value(compute_ready_view(st))
        .unwrap_or_else(|_| json!({"schema":"css.error.v1","code":"READY_SERIALIZE_FAILED"}))
}

pub async fn compute_ready_view_async(app: AppState, run_id: String) -> Result<ReadyView, String> {
    let path = run_state_path(&app.config.runs_dir, &run_id);
    let st = read_run_state_async(&path)
        .await
        .map_err(|e| format!("{e}"))?;
    Ok(compute_ready_view(&st))
}

pub fn compute_ready_view_from_state_only(st: &RunState) -> ReadyView {
    compute_ready_view(st)
}

pub async fn compute_ready_view_by_id(
    runs_root: std::path::PathBuf,
    run_id: String,
) -> Result<ReadyView, String> {
    let path = crate::run_store::run_state_path(&runs_root, &run_id);
    let st = crate::run_state_io::read_run_state_async(&path)
        .await
        .map_err(|e| format!("{e}"))?;
    Ok(compute_ready_view(&st))
}

pub fn compute_ready_view_from_state(_app: &crate::routes::AppState, st: &RunState) -> ReadyView {
    compute_ready_view(st)
}
