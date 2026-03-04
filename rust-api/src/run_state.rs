use serde::Deserializer;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::path::PathBuf;
use utoipa::ToSchema;

fn default_heartbeat_interval_seconds() -> u64 {
    2
}

fn default_stage_timeout_seconds() -> u64 {
    1800
}

fn default_stuck_timeout_seconds() -> u64 {
    120
}

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
    pub dag_edges: BTreeMap<String, Vec<String>>,
    #[serde(default)]
    pub commands: serde_json::Value,

    #[serde(default, deserialize_with = "deserialize_artifacts")]
    pub artifacts: Vec<Artifact>,

    #[serde(default)]
    pub heartbeat_at: Option<String>,

    #[serde(default)]
    pub last_heartbeat_at: Option<String>,

    #[serde(default)]
    pub stuck_timeout_seconds: Option<u64>,

    #[serde(default)]
    pub cancel_requested: bool,

    #[serde(default)]
    pub cancel_requested_at: Option<String>,

    pub stages: BTreeMap<String, StageRecord>,

    #[serde(default)]
    pub video_shots_total: Option<u32>,

    #[serde(default)]
    pub total_duration_seconds: Option<f64>,

    #[serde(default)]
    pub stage_seq: u64,

    #[serde(default)]
    pub slowest_leader: Option<String>,

    #[serde(default)]
    pub slowest_tick: Option<u64>,

    #[serde(default)]
    pub last_event: Option<crate::events::LastEvent>,
}

fn deserialize_artifacts<'de, D>(deserializer: D) -> Result<Vec<Artifact>, D::Error>
where
    D: Deserializer<'de>,
{
    let v = Value::deserialize(deserializer)?;
    match v {
        Value::Array(arr) => {
            let mut out = Vec::new();
            for item in arr {
                if let Ok(a) = serde_json::from_value::<Artifact>(item) {
                    out.push(a);
                }
            }
            Ok(out)
        }
        _ => Ok(Vec::new()),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct Artifact {
    pub kind: String,
    pub path: PathBuf,
    pub stage: String,
    pub mime: Option<String>,
}

impl RunState {
    pub fn set_artifact_path(&mut self, path: &str, value: serde_json::Value) {
        let (kind, p, mime) = if let Some(obj) = value.as_object() {
            let kind = obj
                .get("kind")
                .and_then(|v| v.as_str())
                .unwrap_or("artifact")
                .to_string();
            let p = obj
                .get("path")
                .and_then(|v| v.as_str())
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from(""));
            let mime = obj
                .get("mime")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            (kind, p, mime)
        } else {
            let v = value
                .as_str()
                .map(|s| s.to_string())
                .unwrap_or_else(|| value.to_string());
            ("meta".to_string(), PathBuf::from(v), None)
        };

        self.artifacts.retain(|a| a.stage != path);
        self.artifacts.push(Artifact {
            kind,
            path: p,
            stage: path.to_string(),
            mime,
        });
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunConfig {
    pub out_dir: PathBuf,
    pub wiki_enabled: bool,
    pub civ_linked: bool,

    #[serde(default = "default_heartbeat_interval_seconds")]
    pub heartbeat_interval_seconds: u64,

    #[serde(default = "default_stage_timeout_seconds")]
    pub stage_timeout_seconds: u64,

    #[serde(default = "default_stuck_timeout_seconds")]
    pub stuck_timeout_seconds: u64,
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
    #[serde(default)]
    pub nodes: Vec<DagNodeMeta>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DagNodeMeta {
    pub name: String,
    #[serde(default)]
    pub deps: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
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

    #[serde(default)]
    pub heartbeat_at: Option<String>,

    #[serde(default)]
    pub last_heartbeat_at: Option<String>,

    #[serde(default)]
    pub timeout_seconds: Option<u64>,

    #[serde(default)]
    pub error_code: Option<String>,

    #[serde(default)]
    pub pid: Option<i32>,

    #[serde(default)]
    pub pgid: Option<i32>,

    #[serde(default)]
    pub meta: Value,

    #[serde(default)]
    pub duration_seconds: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GateMeta {
    #[serde(default)]
    pub gate_code: String,
    #[serde(default)]
    pub base_stage: String,
    #[serde(default)]
    pub base_s: f64,
    #[serde(default)]
    pub got_s: f64,
    #[serde(default)]
    pub min_ratio: f64,
    #[serde(default)]
    pub min_duration_s: f64,
    #[serde(default)]
    pub file: Option<String>,
    #[serde(default)]
    pub file_bytes: Option<u64>,
}
