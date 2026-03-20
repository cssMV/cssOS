use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RuntimeCheckpoint {
    pub event_index: usize,
    pub snapshot: crate::film_runtime::snapshot::FilmRuntimeSnapshot,
}

pub fn save_checkpoint(run_id: &str, checkpoint: &RuntimeCheckpoint) -> anyhow::Result<()> {
    let dir = crate::run_store::run_dir(run_id);
    std::fs::create_dir_all(&dir)?;
    let path = dir.join(format!(
        "film_runtime_checkpoint_{}.json",
        checkpoint.event_index
    ));
    let data = serde_json::to_vec_pretty(checkpoint)?;
    std::fs::write(path, data)?;
    Ok(())
}
