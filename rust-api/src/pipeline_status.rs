use crate::dag::{cssmv_dag_v1, Dag};
use crate::run_worker;
use serde_json::json;
use std::{fs, path::Path};

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
        let st = stage_status(state, d);
        if !is_done(&st) {
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

fn artifacts_get<'a>(v: &'a serde_json::Value, path: &str) -> Option<&'a serde_json::Value> {
    let mut cur = v;
    for p in path.split('.').filter(|x| !x.is_empty()) {
        cur = cur.get(p)?;
    }
    Some(cur)
}

pub fn build_status_json(state_path: &Path) -> anyhow::Result<serde_json::Value> {
    let s = fs::read_to_string(state_path)?;
    let state: serde_json::Value = serde_json::from_str(&s)?;
    let dag = cssmv_dag_v1();

    let ready = ready_queue(&dag, &state);
    let artifacts = state.get("artifacts").cloned().unwrap_or_else(|| json!({}));

    let shots_n = artifacts_get(&artifacts, "video.shots_count")
        .and_then(|v| v.as_u64())
        .map(|n| n as i64);

    let storyboard = artifacts_get(&artifacts, "video.storyboard")
        .and_then(|v| v.as_str())
        .map(|x| x.to_string());

    Ok(json!({
        "schema": "css.pipeline.status.v1",
        "run_state_path": state_path.display().to_string(),
        "worker": {
            "concurrency": run_worker::concurrency() as i64,
            "running": run_worker::running_count() as i64,
            "queued": run_worker::queued_count() as i64
        },
        "ready": ready,
        "stages": dag.nodes.iter().map(|n| json!({
            "name": n.name,
            "deps": n.deps,
            "status": stage_status(&state, n.name),
        })).collect::<Vec<_>>(),
        "video": {
            "shots_count": shots_n,
            "storyboard": storyboard
        }
    }))
}
