use tokio::task::JoinHandle;

use crate::jobs::queue;
use crate::metrics;
use crate::run_state::{RunStatus, StageStatus};

pub async fn start_workers(n: usize) -> Vec<JoinHandle<()>> {
    let mut hs = Vec::new();
    if queue::global_sem().await.is_none() {
        return hs;
    }
    let lease_retry_delay_ms = std::env::var("CSS_LEASE_RETRY_DELAY_MS")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(2000);

    for _ in 0..n.max(1) {
        let lease_retry_delay_ms = lease_retry_delay_ms;
        hs.push(tokio::spawn(async move {
            loop {
                let Some(run_id) = queue::pop_run().await else {
                    if !queue::uses_blocking_pop().await {
                        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
                    }
                    continue;
                };
                if !queue::try_acquire_run_lease(&run_id).await {
                    if let Ok(st) = crate::run_store::read_run_state(&crate::run_store::run_state_path(&run_id)) {
                        let _ = queue::defer_run(run_id.clone(), st.tier.clone(), lease_retry_delay_ms).await;
                    }
                    continue;
                }
                let Some(permit) = queue::acquire_global().await else {
                    tokio::time::sleep(std::time::Duration::from_millis(200)).await;
                    queue::release_run_lease(&run_id).await;
                    if let Ok(st) = crate::run_store::read_run_state(&crate::run_store::run_state_path(&run_id)) {
                        let _ = queue::defer_run(run_id.clone(), st.tier.clone(), lease_retry_delay_ms).await;
                    }
                    continue;
                };
                metrics::RUNS_RUNNING.inc();
                metrics::RUNS_GLOBAL_SLOTS_USED.inc();

                let ttl = queue::lease_ttl_seconds().await.max(5);
                let heartbeat_every = std::time::Duration::from_secs((ttl / 3).max(1));
                let lease_run_id = run_id.clone();
                let (stop_tx, mut stop_rx) = tokio::sync::oneshot::channel::<()>();
                let lease_task = tokio::spawn(async move {
                    loop {
                        tokio::select! {
                            _ = tokio::time::sleep(heartbeat_every) => {
                                if !queue::renew_run_lease(&lease_run_id).await {
                                    break;
                                }
                            }
                            _ = &mut stop_rx => break,
                        }
                    }
                });

                let state_path = crate::run_store::run_state_path(&run_id);
                let state = crate::run_store::read_run_state(&state_path);
                let compiled = crate::run_store::read_compiled_commands(&run_id);
                match (state, compiled) {
                    (Ok(state), Ok(compiled)) => {
                        let _ =
                            crate::runner::run_pipeline_dag_concurrent(&state_path, state, compiled)
                                .await;
                    }
                    (Err(e), _) | (_, Err(e)) => {
                        if let Ok(mut s) = crate::run_store::read_run_state(&state_path) {
                            s.status = crate::run_state::RunStatus::FAILED;
                            s.updated_at = crate::runner::now_rfc3339();
                            s.set_artifact_path(
                                "worker.error",
                                serde_json::json!(format!("worker load failed: {}", e)),
                            );
                            let _ = crate::run_store::write_run_state(&state_path, &s);
                            crate::events::emit_snapshot(&s);
                        }
                    }
                }
                let _ = stop_tx.send(());
                let _ = lease_task.await;
                queue::release_run_lease(&run_id).await;

                metrics::RUNS_RUNNING.dec();
                metrics::RUNS_GLOBAL_SLOTS_USED.dec();
                drop(permit);
                queue::release_run(&run_id).await;
            }
        }));
    }

    hs
}

pub async fn restore_incomplete_runs() -> anyhow::Result<usize> {
    let mut restored = 0usize;
    let root = crate::run_store::runs_root();
    let rd = std::fs::read_dir(&root)?;
    for ent in rd.flatten() {
        let run_json = ent.path().join("run.json");
        if !run_json.exists() {
            continue;
        }
        let mut st = match crate::run_store::read_run_state(&run_json) {
            Ok(v) => v,
            Err(_) => continue,
        };
        if !matches!(st.status, RunStatus::RUNNING) {
            continue;
        }

        for rec in st.stages.values_mut() {
            if matches!(rec.status, StageStatus::RUNNING) {
                rec.status = StageStatus::PENDING;
                rec.started_at = None;
                rec.ended_at = None;
                rec.exit_code = None;
                rec.error = None;
            }
        }

        st.updated_at = crate::runner::now_rfc3339();
        crate::run_store::write_run_state(&run_json, &st)?;
        crate::events::emit_snapshot(&st);

        if queue::claim_run(&st.run_id).await {
            queue::push_run(st.run_id.clone(), st.tier.clone()).await?;
            restored += 1;
        }
    }
    Ok(restored)
}
