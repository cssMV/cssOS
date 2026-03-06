use std::sync::Arc;
use tokio::sync::Semaphore;

#[derive(Clone)]
pub struct Scheduler {
    pub cpu_sem: Arc<Semaphore>,
    pub ffmpeg_sem: Arc<Semaphore>,
}

impl Scheduler {
    pub fn new() -> Self {
        let cores = num_cpus::get().max(1);
        let cpu_limit = (cores as f32 * 1.5).ceil() as usize;
        let ffmpeg_limit = cores.max(2);
        Self {
            cpu_sem: Arc::new(Semaphore::new(cpu_limit.max(1))),
            ffmpeg_sem: Arc::new(Semaphore::new(ffmpeg_limit.max(1))),
        }
    }
}
