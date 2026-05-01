use crate::training::stage::CurriculumStage;

pub struct CurriculumScheduler {
    pub stages: Vec<CurriculumStage>,
    pub current: usize,
    pub step: usize,
}

impl CurriculumScheduler {
    pub fn new(stages: Vec<CurriculumStage>) -> Self {
        Self {
            stages,
            current: 0,
            step: 0,
        }
    }

    pub fn current_stage(&self) -> &CurriculumStage {
        &self.stages[self.current]
    }

    pub fn update(&mut self) {
        self.step += 1;

        if self.step.is_multiple_of(10_000) && self.current < self.stages.len() - 1 {
            self.current += 1;
            println!("Enter stage: {}", self.current_stage().name);
        }
    }
}
