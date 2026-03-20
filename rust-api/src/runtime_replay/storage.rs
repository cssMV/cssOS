use crate::event_engine::types::EngineEvent;
use crate::runtime_replay::types::ReplayManifest;
use std::fs;
use std::path::PathBuf;

pub fn replay_events_path(run_id: &str) -> PathBuf {
    crate::run_store::run_dir(run_id).join("film_runtime_events.json")
}

pub fn replay_manifest_path(run_id: &str) -> PathBuf {
    crate::run_store::run_dir(run_id).join("film_runtime_replay_manifest.json")
}

pub fn load_runtime_events(run_id: &str) -> anyhow::Result<Vec<EngineEvent>> {
    let data = fs::read(replay_events_path(run_id))?;
    Ok(serde_json::from_slice(&data)?)
}

pub fn save_runtime_events(run_id: &str, events: &[EngineEvent]) -> anyhow::Result<()> {
    let dir = crate::run_store::run_dir(run_id);
    fs::create_dir_all(&dir)?;
    let data = serde_json::to_vec_pretty(events)?;
    fs::write(replay_events_path(run_id), data)?;
    Ok(())
}

pub fn save_replay_manifest(run_id: &str, manifest: &ReplayManifest) -> anyhow::Result<()> {
    let dir = crate::run_store::run_dir(run_id);
    fs::create_dir_all(&dir)?;
    let data = serde_json::to_vec_pretty(manifest)?;
    fs::write(replay_manifest_path(run_id), data)?;
    Ok(())
}

pub fn load_replay_manifest(run_id: &str) -> anyhow::Result<ReplayManifest> {
    let data = fs::read(replay_manifest_path(run_id))?;
    Ok(serde_json::from_slice(&data)?)
}
