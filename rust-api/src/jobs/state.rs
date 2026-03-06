use crate::run_state::{RunState, RunStatus};
use crate::{run_state_io, run_store};
use anyhow::Context;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};
use tokio::task::JoinHandle;
use tokio::time::{self, Duration};

#[derive(Clone)]
pub struct Jobs {
    inner: Arc<JobsInner>,
}

struct JobsInner {
    running: Mutex<HashMap<String, JoinHandle<()>>>,
    states: RwLock<HashMap<String, Arc<RwLock<RunState>>>>,
}

impl Jobs {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(JobsInner {
                running: Mutex::new(HashMap::new()),
                states: RwLock::new(HashMap::new()),
            }),
        }
    }

    pub async fn put_state(&self, st: RunState) -> Arc<RwLock<RunState>> {
        let run_id = st.run_id.clone();
        let arc = Arc::new(RwLock::new(st));
        self.inner.states.write().await.insert(run_id, arc.clone());
        arc
    }

    pub async fn get_state(&self, run_id: &str) -> Option<Arc<RwLock<RunState>>> {
        self.inner.states.read().await.get(run_id).cloned()
    }

    pub async fn ensure_loaded(&self, run_id: &str) -> anyhow::Result<Arc<RwLock<RunState>>> {
        if let Some(s) = self.get_state(run_id).await {
            return Ok(s);
        }
        let st = run_store::load_run_state(run_id)?;
        Ok(self.put_state(st).await)
    }

    pub async fn spawn_run<F, Fut>(
        &self,
        run_id: String,
        state: Arc<RwLock<RunState>>,
        f: F,
    ) -> anyhow::Result<()>
    where
        F: FnOnce(Arc<RwLock<RunState>>) -> Fut + Send + 'static,
        Fut: std::future::Future<Output = anyhow::Result<()>> + Send + 'static,
    {
        let mut running = self.inner.running.lock().await;
        if running.contains_key(&run_id) {
            return Ok(());
        }

        let hb_state = state.clone();
        let hb_run_id = run_id.clone();
        let hb = tokio::spawn(async move {
            let mut t = time::interval(Duration::from_secs(1));
            loop {
                t.tick().await;
                let mut s = hb_state.write().await;
                if matches!(
                    s.status,
                    RunStatus::SUCCEEDED | RunStatus::FAILED | RunStatus::CANCELLED
                ) {
                    let p = run_store::run_state_path(&hb_run_id);
                    let _ = run_state_io::save_state_atomic(&p, &*s);
                    break;
                }
                s.updated_at = crate::timeutil::now_rfc3339();
                let p = run_store::run_state_path(&hb_run_id);
                let _ = run_state_io::save_state_atomic(&p, &*s);
            }
        });

        let job_state = state.clone();
        let job_run_id = run_id.clone();
        let handle = tokio::spawn(async move {
            let res = f(job_state.clone()).await;
            {
                let mut s = job_state.write().await;
                s.updated_at = crate::timeutil::now_rfc3339();
                match res {
                    Ok(_) => {
                        if !matches!(s.status, RunStatus::FAILED | RunStatus::CANCELLED) {
                            s.status = RunStatus::SUCCEEDED;
                        }
                    }
                    Err(e) => {
                        s.status = RunStatus::FAILED;
                        if s.stages.values().all(|r| r.error.is_none()) {
                            if let Some((_k, v)) = s.stages.iter_mut().next() {
                                v.error = Some(e.to_string());
                            }
                        }
                    }
                }
                let p = run_store::run_state_path(&job_run_id);
                let _ = run_state_io::save_state_atomic(&p, &*s);
            }
            hb.abort();
        });

        running.insert(run_id, handle);
        Ok(())
    }

    pub async fn is_running(&self, run_id: &str) -> bool {
        self.inner.running.lock().await.contains_key(run_id)
    }
}

pub async fn init_state_and_persist(mut st: RunState) -> anyhow::Result<()> {
    run_store::ensure_dir(&st.run_id)?;
    st.created_at = crate::timeutil::now_rfc3339();
    st.updated_at = st.created_at.clone();
    let p = run_store::run_state_path(&st.run_id);
    run_state_io::save_state_atomic(&p, &st).context("save run.json")?;
    Ok(())
}
