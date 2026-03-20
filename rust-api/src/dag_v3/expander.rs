use crate::dag_v3::{
    artifacts::{collect_artifacts_from_stages, ArtifactIndex},
    builder::DagBuilder,
    intent::{CreativeBrief, CreativeIntent, Intent},
    matrix::{build_version_matrix, VersionMatrix},
    stage::StageDef,
    types::{BackendKind, BackendRef, ProjectMode},
};

pub fn expand_dag_v3(
    intent: &CreativeIntent,
    brief: &CreativeBrief,
    matrix: &VersionMatrix,
) -> crate::dag_v3::plan::DagExecutionPlan {
    DagBuilder::new(intent.clone(), brief.clone(), matrix.clone())
        .add_input_layer()
        .add_understanding_layer()
        .add_lyrics_layer()
        .add_music_layer()
        .add_video_layer()
        .add_sync_layer()
        .add_output_layer()
        .finalize()
        .unwrap_or_else(|_| crate::dag_v3::plan::DagExecutionPlan {
            stages: vec![],
            topo_order: vec![],
            artifacts: crate::dag_v3::artifacts::ArtifactIndex { items: vec![] },
        })
}

pub fn expand_stages(intent: &Intent, matrix: &VersionMatrix) -> Vec<StageDef> {
    let ci = CreativeIntent {
        mode: intent.mode.clone(),
        primary_lang: matrix.primary_lang.clone(),
        target_langs: matrix.langs.clone(),
        target_voices: matrix.voices.clone(),
        outputs: matrix.outputs.clone(),
        karaoke: intent.karaoke,
        auto_mv: true,
        market_ready: true,
        source_assets: vec![],
    };
    let brief = CreativeBrief {
        title: "Untitled".to_string(),
        style: "pop".to_string(),
        mood: "dreamy".to_string(),
        tempo: "medium".to_string(),
        prompt: "".to_string(),
        visual_prompt: "".to_string(),
    };
    expand_dag_v3(&ci, &brief, matrix).stages
}

pub fn default_matrix_from_intent(intent: &Intent) -> VersionMatrix {
    build_version_matrix(intent)
}

pub fn default_intent_from_lang(lang: &str) -> Intent {
    Intent {
        mode: ProjectMode::FromScratch,
        primary_lang: if lang.trim().is_empty() {
            "en".to_string()
        } else {
            lang.to_string()
        },
        target_langs: vec![if lang.trim().is_empty() {
            "en".to_string()
        } else {
            lang.to_string()
        }],
        target_voices: vec!["female".to_string()],
        karaoke: true,
    }
}

pub fn collect_stable_artifacts(stages: &[StageDef]) -> ArtifactIndex {
    collect_artifacts_from_stages(stages)
}

pub fn primary_only_filter(stages: &mut Vec<StageDef>, matrix: &VersionMatrix) {
    stages.retain(|s| {
        let n = &s.name.0;
        let parts: Vec<&str> = n.split('.').collect();
        if parts.len() < 2 {
            return true;
        }
        let pl = matrix.primary_lang.as_str();
        let pv = matrix.primary_voice.as_str();
        match parts[0] {
            "lyrics_adapt" | "lyrics_timing" | "subtitles" | "karaoke_ass" | "lyrics_lrc" => {
                parts.get(1).copied() == Some(pl)
            }
            "vocals" | "mix" | "render_mv" | "render_karaoke_mv" => {
                parts.get(1).copied() == Some(pl) && parts.get(2).copied() == Some(pv)
            }
            _ => true,
        }
    });
}

pub fn fallback_chain_for_stage(stage_name: &str) -> Vec<BackendRef> {
    if stage_name.starts_with("render_") {
        return vec![
            crate::dag_v3::engine_registry::backend_ref(
                "provider",
                "v1",
                BackendKind::Provider,
                "provider://render/default".to_string(),
            ),
            crate::dag_v3::engine_registry::backend_ref(
                "cssmv",
                &crate::dag_v3::engine_registry::default_cssmv_version(),
                BackendKind::Native,
                "cssmv-native://render".to_string(),
            ),
        ];
    }
    vec![crate::dag_v3::engine_registry::backend_ref(
        "cssmv",
        &crate::dag_v3::engine_registry::default_cssmv_version(),
        BackendKind::Native,
        "cssmv-native://default".to_string(),
    )]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dag_v3_finalize_smoke() {
        let intent = default_intent_from_lang("en");
        let matrix = default_matrix_from_intent(&intent);
        let ci = CreativeIntent {
            mode: intent.mode.clone(),
            primary_lang: matrix.primary_lang.clone(),
            target_langs: matrix.langs.clone(),
            target_voices: matrix.voices.clone(),
            outputs: matrix.outputs.clone(),
            karaoke: intent.karaoke,
            auto_mv: true,
            market_ready: true,
            source_assets: vec![],
        };
        let brief = CreativeBrief {
            title: "demo".into(),
            style: "pop".into(),
            mood: "dreamy".into(),
            tempo: "medium".into(),
            prompt: "demo".into(),
            visual_prompt: "demo".into(),
        };

        let plan = DagBuilder::new(ci, brief, matrix)
            .add_input_layer()
            .add_understanding_layer()
            .add_lyrics_layer()
            .add_music_layer()
            .add_video_layer()
            .add_sync_layer()
            .add_output_layer()
            .finalize()
            .expect("finalize failed");

        assert!(!plan.stages.is_empty());
        assert!(!plan.topo_order.is_empty());
        assert!(!plan.artifacts.items.is_empty());
    }
}
