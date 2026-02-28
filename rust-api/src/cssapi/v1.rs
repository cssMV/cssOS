use crate::ready::compute_ready_view;
use crate::run_state::RunState;
use serde_json::json;

pub fn ready_payload(st: &RunState) -> serde_json::Value {
    let view = compute_ready_view(st);

    let running = view
        .running
        .into_iter()
        .map(|stage| {
            let started_at = st.stages.get(&stage).and_then(|r| r.started_at.clone());
            json!({"stage": stage, "started_at": started_at})
        })
        .collect::<Vec<_>>();

    json!({
        "schema": "cssapi.runs.ready.v1",
        "run_id": &st.run_id,
        "status": format!("{:?}", st.status),
        "updated_at": &st.updated_at,
        "dag": {
            "schema": &st.dag.schema,
            "topo_order": view.topo_order,
        },
        "ready": view.ready,
        "running": running,
        "summary": {
            "total": view.summary.total,
            "pending": view.summary.pending,
            "running": view.summary.running,
            "succeeded": view.summary.succeeded,
            "failed": view.summary.failed,
            "skipped": view.summary.skipped,
            "status": format!("{:?}", st.status),
            "updated_at": st.updated_at
        },
        "video": {
            "shots_total": st.video_shots_total
        }
    })
}
