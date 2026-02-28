use tokio::task::JoinHandle;

use crate::jobs::queue;

pub async fn start_workers(n: usize) -> Vec<JoinHandle<()>> {
    let mut hs = Vec::new();
    let Some(rx) = queue::receiver().await else {
        return hs;
    };

    for _ in 0..n.max(1) {
        let rx2 = rx.clone();
        hs.push(tokio::spawn(async move {
            loop {
                let next = {
                    let mut guard = rx2.lock().await;
                    guard.recv().await
                };
                let Some(job) = next else { break; };

                let run_id = job.run_id.clone();
                let _ = crate::runner::run_pipeline_dag_concurrent(
                    &job.state_path,
                    job.state,
                    job.compiled,
                )
                .await;
                queue::release_run(&run_id).await;
            }
        }));
    }

    hs
}
