use std::sync::Arc;

use async_trait::async_trait;
use tokio::sync::{mpsc, Mutex};

use super::queue::DistributedQueue;

#[derive(Clone)]
pub struct LocalQueue {
    tx: mpsc::Sender<String>,
    rx: Arc<Mutex<mpsc::Receiver<String>>>,
}

impl LocalQueue {
    pub fn new(size: usize) -> Self {
        let (tx, rx) = mpsc::channel(size);
        Self {
            tx,
            rx: Arc::new(Mutex::new(rx)),
        }
    }
}

#[async_trait]
impl DistributedQueue for LocalQueue {
    async fn push(&self, run_id: String) {
        let _ = self.tx.send(run_id).await;
    }

    async fn pop(&self) -> Option<String> {
        let mut rx = self.rx.lock().await;
        rx.recv().await
    }
}
