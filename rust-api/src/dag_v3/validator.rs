use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

use crate::dag_v3::stage::{StageDef, StageKind};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DagValidationError {
    DuplicateStageName(String),
    MissingDependency {
        stage: String,
        dep: String,
    },
    DuplicateOutputPath {
        path: String,
        stage_a: String,
        stage_b: String,
    },
    MissingBackend {
        stage: String,
    },
}

pub fn validate_stages(stages: &[StageDef]) -> Result<(), DagValidationError> {
    let mut names = BTreeSet::<String>::new();
    let mut outputs = BTreeMap::<String, String>::new();

    for st in stages {
        let n = st.name.0.clone();
        if !names.insert(n.clone()) {
            return Err(DagValidationError::DuplicateStageName(n));
        }
        for out in &st.outputs {
            if let Some(prev) = outputs.get(out) {
                return Err(DagValidationError::DuplicateOutputPath {
                    path: out.clone(),
                    stage_a: prev.clone(),
                    stage_b: st.name.0.clone(),
                });
            }
            outputs.insert(out.clone(), st.name.0.clone());
        }
    }

    let name_set: BTreeSet<String> = stages.iter().map(|s| s.name.0.clone()).collect();
    for st in stages {
        for dep in &st.deps {
            if !name_set.contains(&dep.0) {
                return Err(DagValidationError::MissingDependency {
                    stage: st.name.0.clone(),
                    dep: dep.0.clone(),
                });
            }
        }
        if requires_backend(&st.kind) && st.backend.is_none() {
            return Err(DagValidationError::MissingBackend {
                stage: st.name.0.clone(),
            });
        }
    }

    Ok(())
}

fn requires_backend(kind: &StageKind) -> bool {
    use StageKind::*;
    matches!(
        kind,
        LyricsSeed
            | LyricsPrimary
            | LyricsAdapt
            | LyricsTiming
            | MusicPlan
            | MusicCompose
            | MusicStems
            | MusicMidiExport
            | VocalPlan
            | VocalsGenerate
            | VocalsAlign
            | Mix
            | Master
            | VideoConcept
            | VideoPlan
            | VideoShot
            | VideoMotionRefine
            | VideoAssemble
            | VideoCover
            | RenderMv
            | RenderKaraokeMv
            | RenderAudioOnly
            | RenderInstrumental
    )
}
