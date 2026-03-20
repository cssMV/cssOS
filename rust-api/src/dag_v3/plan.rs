use serde::{Deserialize, Serialize};

use crate::dag_v3::artifacts::ArtifactIndex;
use crate::dag_v3::stage::{StageDef, StageName};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DagExecutionPlan {
    pub stages: Vec<StageDef>,
    #[serde(default)]
    pub topo_order: Vec<StageName>,
    #[serde(default)]
    pub artifacts: ArtifactIndex,
}
