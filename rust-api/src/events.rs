use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use utoipa::ToSchema;

use crate::ready::{compute_ready_view_with_dag_limited, ReadySummary};
use crate::run_state::{RunState, RunStatus};

fn default_event_kind_stage() -> EventKind {
    EventKind::Stage
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum EventKind {
    Stage,
    #[serde(rename = "voice_submitted")]
    VoiceSubmitted,
    Gate,
    Failed,
    Cancelled,
    Timeout,
    Heartbeat,
    Slowest,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct LastEvent {
    #[serde(default = "default_event_kind_stage")]
    pub kind: EventKind,
    pub stage: String,
    pub status: String,
    pub ts: String,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta: Option<serde_json::Value>,
}

pub fn bump_event(
    st: &mut crate::run_state::RunState,
    kind: EventKind,
    stage: &str,
    status: &str,
    ts: String,
    meta: Option<serde_json::Value>,
) {
    st.stage_seq = st.stage_seq.saturating_add(1);
    st.last_event = Some(LastEvent {
        kind,
        stage: stage.to_string(),
        status: status.to_string(),
        ts,
        meta,
    });
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "event", content = "data", rename_all = "snake_case")]
pub enum RunEvent {
    Snapshot(RunReadySnapshot),
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RunReadySnapshot {
    pub schema: String,
    pub run_id: String,
    pub status: RunStatus,
    pub dag: DagReadyMeta,
    pub topo_order: Vec<String>,
    pub ready: Vec<String>,
    pub running: Vec<String>,
    pub summary: ReadySummary,
    pub updated_at: String,
    pub video_shots: Option<VideoShotsMeta>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DagReadyMeta {
    pub schema: String,
    pub concurrency: usize,
    pub nodes_total: usize,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VideoShotsMeta {
    pub n: usize,
}

#[derive(Clone)]
pub struct EventBus {
    pub tx: broadcast::Sender<RunEvent>,
}

impl EventBus {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(1024);
        Self { tx }
    }

    pub fn emit(&self, ev: RunEvent) {
        let _ = self.tx.send(ev);
    }

    pub fn subscribe(&self) -> broadcast::Receiver<RunEvent> {
        self.tx.subscribe()
    }
}

static GLOBAL_BUS: Lazy<EventBus> = Lazy::new(EventBus::new);

pub fn global_bus() -> EventBus {
    GLOBAL_BUS.clone()
}

pub fn emit(ev: RunEvent) {
    GLOBAL_BUS.emit(ev);
}

pub fn subscribe() -> broadcast::Receiver<RunEvent> {
    GLOBAL_BUS.subscribe()
}

pub fn emit_snapshot(state: &RunState) {
    let dag = crate::dag::cssmv_dag_v1();
    let view = compute_ready_view_with_dag_limited(state, &dag, 64);
    let video_shots = state
        .video_shots_total
        .map(|n| VideoShotsMeta { n: n as usize });
    emit(RunEvent::Snapshot(RunReadySnapshot {
        schema: "cssapi.runs.ready.v1".to_string(),
        run_id: state.run_id.clone(),
        status: state.status.clone(),
        dag: DagReadyMeta {
            schema: state.dag.schema.clone(),
            concurrency: concurrency_limit(),
            nodes_total: view.topo_order.len(),
        },
        topo_order: view.topo_order,
        ready: view.ready,
        running: view.running,
        summary: view.summary,
        updated_at: state.updated_at.clone(),
        video_shots,
    }));
}

fn concurrency_limit() -> usize {
    std::env::var("CSS_DAG_CONCURRENCY")
        .ok()
        .and_then(|s| s.parse::<usize>().ok())
        .filter(|&n| n > 0)
        .unwrap_or(2)
}
