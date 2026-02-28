use crate::dag::Dag;
use serde_json::json;
use std::{fs, path::Path};

pub fn write_dag_json<P: AsRef<Path>>(
    out_path: P,
    dag: &Dag,
    run_state_json: &serde_json::Value,
) -> anyhow::Result<()> {
    let mut nodes = Vec::new();
    for n in &dag.nodes {
        let status = run_state_json
            .get("stages")
            .and_then(|v| v.get(n.name))
            .and_then(|v| v.get("status"))
            .and_then(|v| v.as_str())
            .unwrap_or("UNKNOWN")
            .to_string();

        let started_at = run_state_json
            .get("stages")
            .and_then(|v| v.get(n.name))
            .and_then(|v| v.get("started_at"))
            .cloned()
            .unwrap_or(serde_json::Value::Null);

        let ended_at = run_state_json
            .get("stages")
            .and_then(|v| v.get(n.name))
            .and_then(|v| v.get("ended_at"))
            .cloned()
            .unwrap_or(serde_json::Value::Null);

        let duration_ms = run_state_json
            .get("stages")
            .and_then(|v| v.get(n.name))
            .and_then(|v| v.get("duration_ms"))
            .cloned()
            .unwrap_or(serde_json::Value::Null);

        nodes.push(json!({
            "id": n.name,
            "deps": n.deps,
            "status": status,
            "started_at": started_at,
            "ended_at": ended_at,
            "duration_ms": duration_ms
        }));
    }

    let mut edges = Vec::new();
    for n in &dag.nodes {
        for d in n.deps {
            edges.push(json!({"from": d, "to": n.name}));
        }
    }

    let out = json!({
        "schema": "css.pipeline.dag_export.v1",
        "nodes": nodes,
        "edges": edges,
        "artifacts": run_state_json.get("artifacts").cloned().unwrap_or(json!({}))
    });

    if let Some(parent) = out_path.as_ref().parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(out_path, serde_json::to_vec_pretty(&out)?)?;
    Ok(())
}
