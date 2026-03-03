use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    response::IntoResponse,
};
use futures::StreamExt;
use serde::Deserialize;

use crate::events::RunEvent;
use crate::routes::AppState;

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: AppState) {
    let mut rx = state.event_bus.subscribe();
    let mut subscribed_run_id: Option<String> = None;

    loop {
        tokio::select! {
            Ok(ev) = rx.recv() => {
                if let Some(run_id) = subscribed_run_id.as_ref() {
                    let event_run_id = match &ev {
                        RunEvent::Snapshot(s) => &s.run_id,
                    };
                    if event_run_id != run_id {
                        continue;
                    }
                }
                let msg = match serde_json::to_string(&ev) {
                    Ok(v) => v,
                    Err(_) => continue,
                };
                if socket.send(Message::Text(msg.into())).await.is_err() {
                    break;
                }
            }
            Some(incoming) = socket.next() => {
                let Ok(msg) = incoming else {
                    break;
                };
                if let Message::Text(t) = msg {
                    if let Ok(sub) = serde_json::from_str::<SubscribeMsg>(&t) {
                        subscribed_run_id = Some(sub.run_id.clone());
                        let p = crate::run_store::run_state_path(&sub.run_id);
                        if let Ok(st) = crate::run_store::read_run_state(&p) {
                            let snapshot = crate::events::RunEvent::Snapshot(snapshot_from_state(&st));
                            let payload = match serde_json::to_string(&snapshot) {
                                Ok(v) => v,
                                Err(_) => continue,
                            };
                            if socket.send(Message::Text(payload.into())).await.is_err() {
                                break;
                            }
                        }
                    }
                }
            }
            else => break,
        }
    }
}

#[derive(Debug, Deserialize)]
struct SubscribeMsg {
    run_id: String,
}

fn snapshot_from_state(st: &crate::run_state::RunState) -> crate::events::RunReadySnapshot {
    let dag = crate::dag::cssmv_dag_v1();
    let view = crate::ready::compute_ready_view_with_dag_limited(st, &dag, 64);
    crate::events::RunReadySnapshot {
        schema: "cssapi.runs.ready.v1".to_string(),
        run_id: st.run_id.clone(),
        status: st.status.clone(),
        dag: crate::events::DagReadyMeta {
            schema: st.dag.schema.clone(),
            concurrency: std::env::var("CSS_DAG_CONCURRENCY")
                .ok()
                .and_then(|s| s.parse::<usize>().ok())
                .filter(|&n| n > 0)
                .unwrap_or(2),
            nodes_total: view.topo_order.len(),
        },
        topo_order: view.topo_order,
        ready: view.ready,
        running: view.running,
        summary: view.summary,
        updated_at: st.updated_at.clone(),
        video_shots: st
            .video_shots_total
            .map(|n| crate::events::VideoShotsMeta { n: n as usize }),
    }
}
