use crate::dsl::compile::CompiledCommands;
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

pub fn compiled_commands_path(run_id: &str) -> PathBuf {
    run_dir(run_id).join("compiled.commands.json")
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
    let mut next = state.clone();
    if let Ok(prev) = load_state(path) {
        if prev.cancel_requested {
            next.cancel_requested = true;
            if next.cancel_requested_at.is_none() {
                next.cancel_requested_at = prev.cancel_requested_at.clone();
            }
        }
    }
    save_state_atomic(path, &next)
}

pub fn read_run_state(path: &Path) -> io::Result<RunState> {
    load_state(path)
}

pub fn write_compiled_commands(run_id: &str, compiled: &CompiledCommands) -> io::Result<()> {
    let p = compiled_commands_path(run_id);
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent)?;
    }
    let bytes = serde_json::to_vec_pretty(compiled)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;
    fs::write(p, bytes)
}

pub fn read_compiled_commands(run_id: &str) -> io::Result<CompiledCommands> {
    let p = compiled_commands_path(run_id);
    let bytes = fs::read(p)?;
    serde_json::from_slice::<CompiledCommands>(&bytes)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))
}

pub fn run_plan_v3_path(run_id: &str) -> PathBuf {
    run_dir(run_id).join("dag_v3_plan.json")
}

pub fn run_artifacts_index_path(run_id: &str) -> PathBuf {
    run_dir(run_id).join("artifacts_index.json")
}

pub fn film_runtime_snapshot_path(run_id: &str) -> PathBuf {
    run_dir(run_id).join("film_runtime_snapshot.json")
}

pub fn film_runtime_events_path(run_id: &str) -> PathBuf {
    run_dir(run_id).join("film_runtime_events.json")
}

pub fn list_run_files(run_id: &str) -> anyhow::Result<Vec<String>> {
    fn walk(dir: &Path, out: &mut Vec<String>) -> anyhow::Result<()> {
        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                walk(&path, out)?;
            } else if path.is_file() {
                out.push(path.to_string_lossy().to_string());
            }
        }
        Ok(())
    }

    let root = run_dir(run_id);
    if !root.exists() {
        return Ok(Vec::new());
    }

    let mut out = Vec::new();
    walk(&root, &mut out)?;
    out.sort();
    Ok(out)
}

pub fn save_film_runtime_snapshot(
    run_id: &str,
    snapshot: &crate::film_runtime::snapshot::FilmRuntimeSnapshot,
) -> anyhow::Result<()> {
    let dir = run_dir(run_id);
    fs::create_dir_all(&dir)?;
    let data = serde_json::to_vec_pretty(snapshot)?;
    fs::write(film_runtime_snapshot_path(run_id), data)?;
    Ok(())
}

pub fn load_film_runtime_snapshot(
    run_id: &str,
) -> anyhow::Result<crate::film_runtime::snapshot::FilmRuntimeSnapshot> {
    let data = fs::read(film_runtime_snapshot_path(run_id))?;
    Ok(serde_json::from_slice(&data)?)
}

pub fn save_film_runtime_events(
    run_id: &str,
    events: &[crate::event_engine::types::EngineEvent],
) -> anyhow::Result<()> {
    let dir = run_dir(run_id);
    fs::create_dir_all(&dir)?;
    let data = serde_json::to_vec_pretty(events)?;
    fs::write(film_runtime_events_path(run_id), data)?;
    Ok(())
}

pub fn save_run_plan_v3(
    run_id: &str,
    plan: &crate::dag_v3::plan::DagExecutionPlan,
) -> io::Result<()> {
    let p = run_plan_v3_path(run_id);
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent)?;
    }
    let bytes = serde_json::to_vec_pretty(plan)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;
    fs::write(p, bytes)
}

pub fn load_run_plan_v3(run_id: &str) -> io::Result<crate::dag_v3::plan::DagExecutionPlan> {
    let p = run_plan_v3_path(run_id);
    let bytes = fs::read(p)?;
    serde_json::from_slice::<crate::dag_v3::plan::DagExecutionPlan>(&bytes)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))
}

pub fn save_run_artifacts_index(
    run_id: &str,
    idx: &crate::dag_v3::artifacts::ArtifactIndex,
) -> io::Result<()> {
    let p = run_artifacts_index_path(run_id);
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent)?;
    }
    let bytes = serde_json::to_vec_pretty(idx)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;
    fs::write(p, bytes)
}

pub fn load_run_artifacts_index(
    run_id: &str,
) -> io::Result<crate::dag_v3::artifacts::ArtifactIndex> {
    let p = run_artifacts_index_path(run_id);
    let bytes = fs::read(p)?;
    serde_json::from_slice::<crate::dag_v3::artifacts::ArtifactIndex>(&bytes)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))
}
