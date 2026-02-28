use async_trait::async_trait;

#[async_trait]
pub trait DistributedQueue: Send + Sync {
    async fn push(&self, run_id: String);
    async fn pop(&self) -> Option<String>;
    async fn defer(&self, run_id: String, _delay_ms: u64) {
        self.push(run_id).await;
    }

    fn uses_blocking_pop(&self) -> bool {
        false
    }

    async fn try_acquire_lease(&self, _run_id: &str, _worker_id: &str, _ttl_seconds: u64) -> bool {
        true
    }

    async fn renew_lease(&self, _run_id: &str, _worker_id: &str, _ttl_seconds: u64) -> bool {
        true
    }

    async fn release_lease(&self, _run_id: &str, _worker_id: &str) {}
}
