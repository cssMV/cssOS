pub mod context;
pub mod executor;
pub mod pipeline;

use anyhow::Result;

use crate::engine::context::ContentContext;
use crate::engine::executor::{
    CharacterStep, ComposeStep, DirectorStep, MemoryStep, RenderAdapterStep, RenderStep,
};
use crate::engine::pipeline::Pipeline;

pub fn run_content_engine(mut ctx: ContentContext) -> Result<ContentContext> {
    let pipeline = Pipeline::new()
        .add_step(Box::new(DirectorStep))
        .add_step(Box::new(MemoryStep))
        .add_step(Box::new(CharacterStep))
        .add_step(Box::new(RenderAdapterStep))
        .add_step(Box::new(RenderStep))
        .add_step(Box::new(ComposeStep));
    pipeline.run(&mut ctx)?;
    Ok(ctx)
}
