use crate::run_state::RunState;
use serde_json::to_vec_pretty;
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use tokio::io::AsyncWriteExt;

fn ensure_parent_dir(path: &Path) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    Ok(())
}

pub fn save_state_atomic(path: &Path, state: &RunState) -> std::io::Result<()> {
    ensure_parent_dir(path)?;

    let tmp_path = tmp_path(path);
    let bytes = to_vec_pretty(state).map_err(std::io::Error::other)?;

    {
        let mut f = File::create(&tmp_path)?;
        f.write_all(&bytes)?;
        f.sync_all()?;
    }

    fs::rename(&tmp_path, path)?;

    if let Some(parent) = path.parent() {
        let dir = File::open(parent)?;
        dir.sync_all()?;
    }

    Ok(())
}

pub fn load_state(path: &Path) -> std::io::Result<RunState> {
    let data = fs::read(path)?;
    let state: RunState = serde_json::from_slice(&data).map_err(std::io::Error::other)?;
    Ok(state)
}

pub fn read_run_state(path: &Path) -> std::io::Result<RunState> {
    load_state(path)
}

pub fn write_run_state_atomic(path: &Path, state: &RunState) -> std::io::Result<()> {
    save_state_atomic(path, state)
}

pub async fn load_run_state(path: &Path) -> anyhow::Result<RunState> {
    let data = tokio::fs::read(path).await?;
    let st: RunState = serde_json::from_slice(&data)?;
    Ok(st)
}

pub async fn save_run_state_atomic(path: &Path, st: &RunState) -> anyhow::Result<()> {
    if let Some(parent) = path.parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }
    let tmp = tmp_path(path);
    let data = serde_json::to_vec_pretty(st)?;
    let mut f = tokio::fs::File::create(&tmp).await?;
    f.write_all(&data).await?;
    let _ = f.sync_all().await;
    drop(f);
    tokio::fs::rename(&tmp, path).await?;
    Ok(())
}

pub async fn atomic_write_run_state(path: &Path, st: &RunState) -> anyhow::Result<()> {
    save_run_state_atomic(path, st).await
}

pub async fn read_run_state_async(path: &Path) -> anyhow::Result<RunState> {
    load_run_state(path).await
}

fn tmp_path(path: &Path) -> PathBuf {
    let mut p = path.to_path_buf();
    let file_name = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("run.json");
    p.set_file_name(format!("{file_name}.tmp"));
    p
}
