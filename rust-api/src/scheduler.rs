use crate::immersion_engine::runtime::ImmersionSnapshot;
use std::sync::Arc;
use tokio::sync::Semaphore;

#[derive(Clone)]
pub struct Scheduler {
    pub cpu_sem: Arc<Semaphore>,
    pub ffmpeg_sem: Arc<Semaphore>,
    pub immersion: ImmersionSnapshot,
}

impl Scheduler {
    pub fn new() -> Self {
        Self::from_immersion(ImmersionSnapshot::default())
    }

    pub fn from_immersion(immersion: ImmersionSnapshot) -> Self {
        let cores = num_cpus::get().max(1);
        let mut cpu_limit = (cores as f32 * 1.5).ceil() as usize;
        let mut ffmpeg_limit = cores.max(2);

        if immersion.preserve_director_focus {
            cpu_limit = cpu_limit.saturating_sub(1).max(1);
        }
        if immersion.in_focus_zone || immersion.in_trigger_zone {
            ffmpeg_limit = ffmpeg_limit.saturating_sub(1).max(1);
        }

        Self {
            cpu_sem: Arc::new(Semaphore::new(cpu_limit.max(1))),
            ffmpeg_sem: Arc::new(Semaphore::new(ffmpeg_limit.max(1))),
            immersion,
        }
    }
}
