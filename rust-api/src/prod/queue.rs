use std::collections::VecDeque;

#[derive(Clone)]
pub struct Job {
    pub id: String,
    pub tenant_id: String,
    pub prompt: String,
}

pub struct JobQueue {
    pub queue: VecDeque<Job>,
}

impl JobQueue {
    pub fn new() -> Self {
        Self {
            queue: VecDeque::new(),
        }
    }

    pub fn push(&mut self, job: Job) {
        self.queue.push_back(job);
    }

    pub fn pop(&mut self) -> Option<Job> {
        self.queue.pop_front()
    }
}
