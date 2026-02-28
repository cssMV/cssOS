use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Arc;

use once_cell::sync::Lazy;
use tokio::sync::{mpsc, Mutex};

#[derive(Clone)]
pub struct Job {
    pub run_id: String,
    pub state_path: PathBuf,
    pub state: crate::run_state::RunState,
    pub compiled: crate::dsl::compile::CompiledCommands,
}

#[derive(Clone)]
pub struct JobQueueHandle {
    tx: mpsc::Sender<Job>,
}

struct QueueInner {
    tx: mpsc::Sender<Job>,
    rx: Arc<Mutex<mpsc::Receiver<Job>>>,
    queued_or_running: Arc<Mutex<HashSet<String>>>,
}

static QUEUE: Lazy<Mutex<Option<QueueInner>>> = Lazy::new(|| Mutex::new(None));

pub async fn init(capacity: usize) {
    let mut g = QUEUE.lock().await;
    if g.is_some() {
        return;
    }
    let (tx, rx) = mpsc::channel(capacity.max(1));
    *g = Some(QueueInner {
        tx,
        rx: Arc::new(Mutex::new(rx)),
        queued_or_running: Arc::new(Mutex::new(HashSet::new())),
    });
}

pub async fn handle() -> Option<JobQueueHandle> {
    let g = QUEUE.lock().await;
    g.as_ref().map(|q| JobQueueHandle { tx: q.tx.clone() })
}

pub async fn receiver() -> Option<Arc<Mutex<mpsc::Receiver<Job>>>> {
    let g = QUEUE.lock().await;
    g.as_ref().map(|q| q.rx.clone())
}

pub async fn claim_run(run_id: &str) -> bool {
    let g = QUEUE.lock().await;
    let Some(inner) = g.as_ref() else {
        return false;
    };
    let mut set = inner.queued_or_running.lock().await;
    if set.contains(run_id) {
        return false;
    }
    set.insert(run_id.to_string());
    true
}

pub async fn release_run(run_id: &str) {
    let g = QUEUE.lock().await;
    if let Some(inner) = g.as_ref() {
        let mut set = inner.queued_or_running.lock().await;
        set.remove(run_id);
    }
}

pub async fn push(job: Job) -> anyhow::Result<()> {
    let Some(h) = handle().await else {
        anyhow::bail!("job queue not initialized");
    };
    h.tx.send(job)
        .await
        .map_err(|e| anyhow::anyhow!(e.to_string()))
}
