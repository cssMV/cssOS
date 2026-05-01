use crate::prod::gpu_scheduler::GPUScheduler;
use crate::prod::queue::JobQueue;

pub fn worker_loop(queue: &mut JobQueue, scheduler: &mut GPUScheduler) {
    loop {
        if let Some(job) = queue.pop() {
            if let Some(gpu_id) = scheduler.acquire() {
                println!(
                    "running job {} for tenant {} on GPU {}",
                    job.id, job.tenant_id, gpu_id
                );
                let video = crate::inference::service::run_inference(&job.prompt);
                println!("done {}", video);
                scheduler.release(gpu_id);
            } else {
                queue.push(job);
            }
        }
    }
}
