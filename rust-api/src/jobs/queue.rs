use std::collections::{HashMap, HashSet};
use std::env;
use std::sync::Arc;
use std::time::Instant;

use once_cell::sync::Lazy;
use tokio::sync::{Mutex, OwnedSemaphorePermit, Semaphore};

use crate::distributed::local_queue::LocalQueue;
use crate::distributed::queue::DistributedQueue;
use crate::distributed::redis_queue::RedisQueue;
use crate::metrics;

#[derive(Clone)]
pub struct JobQueueHandle {
    _dummy: (),
}

struct EnqueuedMeta {
    tier: String,
    enqueued_at: Instant,
}

struct QueueInner {
    dq: Arc<dyn DistributedQueue>,
    queued_meta: Arc<Mutex<HashMap<String, EnqueuedMeta>>>,
    queued_or_running: Arc<Mutex<HashSet<String>>>,
    global_sem: Arc<Semaphore>,
    worker_id: String,
    lease_ttl_seconds: u64,
}

static QUEUE: Lazy<Mutex<Option<QueueInner>>> = Lazy::new(|| Mutex::new(None));

pub async fn init(capacity: usize) {
    let mut g = QUEUE.lock().await;
    if g.is_some() {
        return;
    }
    let backend = env::var("CSS_QUEUE_BACKEND").unwrap_or_else(|_| "local".to_string());
    let dq: Arc<dyn DistributedQueue> = if backend.eq_ignore_ascii_case("redis") {
        let redis_url =
            env::var("CSS_REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1/".to_string());
        let redis_key =
            env::var("CSS_REDIS_QUEUE_KEY").unwrap_or_else(|_| "cssmv_queue".to_string());
        match RedisQueue::new(&redis_url, &redis_key) {
            Ok(q) => Arc::new(q),
            Err(_) => Arc::new(LocalQueue::new(capacity.max(1))),
        }
    } else {
        Arc::new(LocalQueue::new(capacity.max(1)))
    };

    let worker_id = env::var("CSS_WORKER_ID").unwrap_or_else(|_| {
        format!(
            "{}-{}",
            std::process::id(),
            uuid::Uuid::new_v4().simple()
        )
    });
    let lease_ttl_seconds = env::var("CSS_WORKER_LEASE_TTL_SECONDS")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .filter(|v| *v >= 5)
        .unwrap_or(30);

    *g = Some(QueueInner {
        dq,
        queued_meta: Arc::new(Mutex::new(HashMap::new())),
        queued_or_running: Arc::new(Mutex::new(HashSet::new())),
        global_sem: Arc::new(Semaphore::new(capacity.max(1))),
        worker_id,
        lease_ttl_seconds,
    });
    metrics::RUNS_QUEUE.set(0);
}

pub async fn handle() -> Option<JobQueueHandle> {
    let g = QUEUE.lock().await;
    g.as_ref().map(|_| JobQueueHandle { _dummy: () })
}

pub async fn global_sem() -> Option<Arc<Semaphore>> {
    let sem = {
        let g = QUEUE.lock().await;
        let inner = g.as_ref()?;
        inner.global_sem.clone()
    };
    Some(sem)
}

pub async fn uses_blocking_pop() -> bool {
    let g = QUEUE.lock().await;
    let Some(inner) = g.as_ref() else {
        return false;
    };
    inner.dq.uses_blocking_pop()
}

pub async fn claim_run(run_id: &str) -> bool {
    let set = {
        let g = QUEUE.lock().await;
        let Some(inner) = g.as_ref() else {
            return false;
        };
        inner.queued_or_running.clone()
    };
    let mut set = set.lock().await;
    if set.contains(run_id) {
        return false;
    }
    set.insert(run_id.to_string());
    true
}

pub async fn release_run(run_id: &str) {
    let set = {
        let g = QUEUE.lock().await;
        let Some(inner) = g.as_ref() else {
            return;
        };
        inner.queued_or_running.clone()
    };
    let mut set = set.lock().await;
    set.remove(run_id);
}

pub async fn push_run(run_id: String, tier: String) -> anyhow::Result<()> {
    let (dq, qm) = {
        let g = QUEUE.lock().await;
        let Some(inner) = g.as_ref() else {
            anyhow::bail!("job queue not initialized");
        };
        (inner.dq.clone(), inner.queued_meta.clone())
    };

    {
        let mut qm_guard = qm.lock().await;
        qm_guard.entry(run_id.clone()).or_insert_with(|| EnqueuedMeta {
            tier,
            enqueued_at: Instant::now(),
        });
        metrics::RUNS_QUEUE.set(qm_guard.len() as i64);
    }

    dq.push(run_id).await;
    Ok(())
}

pub async fn defer_run(run_id: String, tier: String, delay_ms: u64) -> anyhow::Result<()> {
    let (dq, qm) = {
        let g = QUEUE.lock().await;
        let Some(inner) = g.as_ref() else {
            anyhow::bail!("job queue not initialized");
        };
        (inner.dq.clone(), inner.queued_meta.clone())
    };

    {
        let mut qm_guard = qm.lock().await;
        qm_guard.entry(run_id.clone()).or_insert_with(|| EnqueuedMeta {
            tier,
            enqueued_at: Instant::now(),
        });
        metrics::RUNS_QUEUE.set(qm_guard.len() as i64);
    }

    dq.defer(run_id, delay_ms).await;
    Ok(())
}

pub async fn pop_run() -> Option<String> {
    let (dq, qm) = {
        let g = QUEUE.lock().await;
        let inner = g.as_ref()?;
        (inner.dq.clone(), inner.queued_meta.clone())
    };
    let run_id = dq.pop().await?;

    let meta = {
        let mut qm_guard = qm.lock().await;
        let m = qm_guard.remove(&run_id);
        metrics::RUNS_QUEUE.set(qm_guard.len() as i64);
        m
    };
    if let Some(m) = meta {
        metrics::RUNS_QUEUE_WAIT_SECONDS
            .with_label_values(&[m.tier.as_str()])
            .observe(m.enqueued_at.elapsed().as_secs_f64());
    }
    Some(run_id)
}

pub async fn acquire_global() -> Option<OwnedSemaphorePermit> {
    let sem = global_sem().await?;
    sem.acquire_owned().await.ok()
}

pub async fn queued_or_running_count() -> usize {
    let set = {
        let g = QUEUE.lock().await;
        let Some(inner) = g.as_ref() else {
            return 0;
        };
        inner.queued_or_running.clone()
    };
    let n = set.lock().await.len();
    n
}

pub async fn try_acquire_run_lease(run_id: &str) -> bool {
    let (dq, worker_id, ttl) = {
        let g = QUEUE.lock().await;
        let Some(inner) = g.as_ref() else {
            return true;
        };
        (
            inner.dq.clone(),
            inner.worker_id.clone(),
            inner.lease_ttl_seconds,
        )
    };
    dq.try_acquire_lease(run_id, &worker_id, ttl).await
}

pub async fn renew_run_lease(run_id: &str) -> bool {
    let (dq, worker_id, ttl) = {
        let g = QUEUE.lock().await;
        let Some(inner) = g.as_ref() else {
            return true;
        };
        (
            inner.dq.clone(),
            inner.worker_id.clone(),
            inner.lease_ttl_seconds,
        )
    };
    dq.renew_lease(run_id, &worker_id, ttl).await
}

pub async fn release_run_lease(run_id: &str) {
    let (dq, worker_id) = {
        let g = QUEUE.lock().await;
        let Some(inner) = g.as_ref() else {
            return;
        };
        (inner.dq.clone(), inner.worker_id.clone())
    };
    dq.release_lease(run_id, &worker_id).await;
}

pub async fn lease_ttl_seconds() -> u64 {
    let g = QUEUE.lock().await;
    let Some(inner) = g.as_ref() else {
        return 30;
    };
    inner.lease_ttl_seconds
}
