use crate::run_worker;
use std::sync::atomic::{AtomicU64, Ordering};

static RUNS_CREATED_TOTAL: AtomicU64 = AtomicU64::new(0);

pub fn incr_runs_created() {
    RUNS_CREATED_TOTAL.fetch_add(1, Ordering::Relaxed);
}

pub fn render_prometheus() -> String {
    let runs = RUNS_CREATED_TOTAL.load(Ordering::Relaxed);
    let running = run_worker::running_count() as u64;
    let queued = run_worker::queued_count() as u64;
    let concurrency = run_worker::concurrency() as u64;

    format!(
        "# HELP css_runs_created_total Total runs created\n\
# TYPE css_runs_created_total counter\n\
css_runs_created_total {runs}\n\
# HELP css_worker_running Worker running count\n\
# TYPE css_worker_running gauge\n\
css_worker_running {running}\n\
# HELP css_worker_queued Worker queued count\n\
# TYPE css_worker_queued gauge\n\
css_worker_queued {queued}\n\
# HELP css_worker_concurrency Worker concurrency\n\
# TYPE css_worker_concurrency gauge\n\
css_worker_concurrency {concurrency}\n"
    )
}
