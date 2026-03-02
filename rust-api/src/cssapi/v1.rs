use crate::ready::compute_ready_view;
use crate::run_state::RunState;
use serde_json::json;

pub fn ready_payload(st: &RunState) -> serde_json::Value {
    let view = compute_ready_view(st);
    let summary_text = crate::ready::build_summary(st, &view);
    let failures = crate::ready::collect_failures(st)
        .into_iter()
        .map(|(stage, error)| json!({"stage": stage, "error": error}))
        .collect::<Vec<_>>();

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
        "summary_text": summary_text,
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
        "mix": {
            "status": view.mix.status,
            "path": view.mix.path,
            "ok": view.mix.ok
        },
        "subtitles": {
            "status": view.subtitles.status,
            "path": view.subtitles.path,
            "burnin": view.subtitles.burnin,
            "format": view.subtitles.format,
            "lang": view.subtitles.lang,
            "ok": view.subtitles.ok
        },
        "video_shots": {
            "total": view.video_shots.total,
            "ready": view.video_shots.ready,
            "running": view.video_shots.running,
            "succeeded": view.video_shots.succeeded,
            "failed": view.video_shots.failed,
            "pending": view.video_shots.pending
        },
        "video": {
            "shots_total": st.video_shots_total
        },
        "artifacts": st.artifacts,
        "failures": failures,
        "blocking": view.blocking,
        "cancel_requested": st.cancel_requested,
        "cancelled_at": st.cancel_requested_at
    })
}
