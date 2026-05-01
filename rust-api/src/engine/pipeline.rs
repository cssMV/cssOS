use anyhow::Result;

use crate::engine::context::ContentContext;

pub trait PipelineStep {
    fn name(&self) -> &'static str;
    fn execute(&self, ctx: &mut ContentContext) -> Result<()>;
}

pub struct Pipeline {
    steps: Vec<Box<dyn PipelineStep>>,
}

impl Pipeline {
    pub fn new() -> Self {
        Self { steps: Vec::new() }
    }

    pub fn add_step(mut self, step: Box<dyn PipelineStep>) -> Self {
        self.steps.push(step);
        self
    }

    pub fn run(&self, ctx: &mut ContentContext) -> Result<()> {
        for step in &self.steps {
            eprintln!("[content-engine] ▶ {}", step.name());
            step.execute(ctx)?;
        }
        Ok(())
    }
}
