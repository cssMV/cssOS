pub struct GPU {
    pub id: usize,
    pub busy: bool,
}

pub struct GPUScheduler {
    pub gpus: Vec<GPU>,
}

impl GPUScheduler {
    pub fn new(n: usize) -> Self {
        let mut gpus = Vec::new();
        for i in 0..n {
            gpus.push(GPU { id: i, busy: false });
        }
        Self { gpus }
    }

    pub fn acquire(&mut self) -> Option<usize> {
        for gpu in &mut self.gpus {
            if !gpu.busy {
                gpu.busy = true;
                return Some(gpu.id);
            }
        }
        None
    }

    pub fn release(&mut self, id: usize) {
        if let Some(gpu) = self.gpus.iter_mut().find(|gpu| gpu.id == id) {
            gpu.busy = false;
        }
    }
}
