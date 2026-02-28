use crate::run_state::RunState;
use crate::run_state_io::{load_state, save_state_atomic};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

pub fn runs_root() -> PathBuf {
    std::env::var("CSS_RUNS_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/srv/cssos/shared/runs"))
}

pub fn run_dir(run_id: &str) -> PathBuf {
    runs_root().join(run_id)
}

pub fn run_state_path(run_id: &str) -> PathBuf {
    run_dir(run_id).join("run.json")
}

pub fn load_run_state(run_id: &str) -> anyhow::Result<RunState> {
    let p = run_state_path(run_id);
    Ok(load_state(&p)?)
}

pub fn exists(run_id: &str) -> bool {
    run_state_path(run_id).exists()
}

pub fn ensure_dir(run_id: &str) -> anyhow::Result<PathBuf> {
    let d = run_dir(run_id);
    fs::create_dir_all(&d)?;
    Ok(d)
}

pub fn ensure_dir_path(p: &Path) -> anyhow::Result<()> {
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent)?;
    }
    Ok(())
}

pub fn ensure_run_dir(run_id: &str) -> io::Result<()> {
    fs::create_dir_all(run_dir(run_id))
}

pub fn write_run_state(path: &Path, state: &RunState) -> io::Result<()> {
    save_state_atomic(path, state)
}

pub fn read_run_state(path: &Path) -> io::Result<RunState> {
    load_state(path)
}
