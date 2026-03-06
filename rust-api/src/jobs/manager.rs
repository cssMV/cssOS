use crate::run_state::RunStatus;
use crate::{run_state_io, runner};
use dashmap::DashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::task::JoinHandle;
use tokio::time::{self, Duration};

#[derive(Clone, Default)]
pub struct JobManager {
    inner: Arc<DashMap<String, JobEntry>>,
}

struct JobEntry {
    run_id: String,
    state_path: PathBuf,
    handle: JoinHandle<()>,
}

impl JobManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn is_running(&self, run_id: &str) -> bool {
        self.inner.contains_key(run_id)
    }

    pub fn spawn_run(&self, run_id: String, state_path: PathBuf) {
        if self.inner.contains_key(&run_id) {
            return;
        }

        let inner = self.inner.clone();
        let run_id2 = run_id.clone();
        let state_path2 = state_path.clone();

        let handle = tokio::spawn(async move {
            if let Ok(mut st) = run_state_io::read_run_state(&state_path2) {
                st.status = RunStatus::RUNNING;
                st.heartbeat_at = Some(runner::now_rfc3339());
                st.updated_at = runner::now_rfc3339();
                let _ = run_state_io::write_run_state_atomic(&state_path2, &st);
            }

            let hb_state_path = state_path2.clone();
            let hb_run_id = run_id2.clone();
            let hb_inner = inner.clone();
            let heartbeat = tokio::spawn(async move {
                let mut tick = time::interval(Duration::from_millis(800));
                loop {
                    tick.tick().await;
                    if !hb_inner.contains_key(&hb_run_id) {
                        break;
                    }
                    if let Ok(mut st) = run_state_io::read_run_state(&hb_state_path) {
                        if matches!(st.status, RunStatus::RUNNING) {
                            st.heartbeat_at = Some(runner::now_rfc3339());
                            st.updated_at = runner::now_rfc3339();
                            let _ = run_state_io::write_run_state_atomic(&hb_state_path, &st);
                        }
                    }
                }
            });

            let _ = runner::run_pipeline_async(&state_path2).await;

            inner.remove(&run_id2);
            let _ = heartbeat.await;
        });

        self.inner.insert(
            run_id.clone(),
            JobEntry {
                run_id,
                state_path,
                handle,
            },
        );
    }

    pub fn get_state_path(&self, run_id: &str) -> Option<PathBuf> {
        self.inner.get(run_id).map(|e| e.state_path.clone())
    }

    pub fn get_run_id(&self, run_id: &str) -> Option<String> {
        self.inner.get(run_id).map(|e| e.run_id.clone())
    }

    pub fn has_handle(&self, run_id: &str) -> bool {
        self.inner
            .get(run_id)
            .map(|e| !e.handle.is_finished())
            .unwrap_or(false)
    }
}
