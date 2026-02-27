use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunState {
    pub schema: String,

    pub run_id: String,
    pub created_at: String,
    pub updated_at: String,

    pub status: RunStatus,

    pub ui_lang: String,
    pub tier: String,

    pub cssl: String,

    pub config: RunConfig,

    pub retry_policy: RetryPolicy,

    pub dag: DagMeta,
    pub topo_order: Vec<String>,

    #[serde(default)]
    pub artifacts: serde_json::Value,

    pub stages: BTreeMap<String, StageRecord>,
}

impl RunState {
    pub fn set_artifact_path(&mut self, path: &str, value: serde_json::Value) {
        let parts: Vec<&str> = path.split('.').filter(|x| !x.is_empty()).collect();
        if parts.is_empty() {
            return;
        }

        if !self.artifacts.is_object() {
            self.artifacts = serde_json::json!({});
        }

        let mut cur = self.artifacts.as_object_mut().expect("artifacts object");
        for key in &parts[..parts.len().saturating_sub(1)] {
            let entry = cur
                .entry((*key).to_string())
                .or_insert_with(|| serde_json::json!({}));
            if !entry.is_object() {
                *entry = serde_json::json!({});
            }
            cur = entry.as_object_mut().expect("nested artifact object");
        }

        cur.insert(parts[parts.len() - 1].to_string(), value);
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunConfig {
    pub out_dir: PathBuf,
    pub wiki_enabled: bool,
    pub civ_linked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryPolicy {
    pub max_retries: u32,
    pub backoff_base_seconds: u64,
    pub strategy: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DagMeta {
    pub schema: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RunStatus {
    INIT,
    RUNNING,
    SUCCEEDED,
    FAILED,
    CANCELLED,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StageStatus {
    PENDING,
    RUNNING,
    SUCCEEDED,
    FAILED,
    SKIPPED,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StageRecord {
    pub status: StageStatus,

    pub started_at: Option<String>,
    pub ended_at: Option<String>,

    pub exit_code: Option<i32>,
    pub command: Option<String>,

    pub outputs: Vec<PathBuf>,

    pub retries: u32,
    pub error: Option<String>,
}
