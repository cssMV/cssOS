use crate::engine_registry::{
    defaults::default_registry,
    registry::EngineRegistry,
    resolver::{resolve_engine_for_domain, EngineSelectionRequest},
    types::{EngineDomain, EngineProviderKind},
};

use crate::dag_v3::{
    intent::{CreativeBrief, CreativeIntent},
    matrix::{VersionKey, VersionMatrix},
    naming,
    plan::DagExecutionPlan,
    registry::register_artifacts,
    stage::{DagPlan, StageDef, StageKind, StageName},
    topo::topo_sort,
    types::{BackendKind, BackendRef, InputKind, OutputKind},
    validator::validate_stages,
};

pub struct DagBuilder {
    intent: CreativeIntent,
    #[allow(dead_code)]
    brief: CreativeBrief,
    matrix: VersionMatrix,
    stages: Vec<StageDef>,
    registry: EngineRegistry,
    selection: EngineSelectionRequest,
}

impl DagBuilder {
    pub fn new(intent: CreativeIntent, brief: CreativeBrief, matrix: VersionMatrix) -> Self {
        Self {
            intent,
            brief,
            matrix,
            stages: Vec::new(),
            registry: default_registry(),
            selection: EngineSelectionRequest::default(),
        }
    }

    pub fn new_with_engine(
        intent: CreativeIntent,
        brief: CreativeBrief,
        matrix: VersionMatrix,
        registry: EngineRegistry,
        selection: EngineSelectionRequest,
    ) -> Self {
        Self {
            intent,
            brief,
            matrix,
            stages: Vec::new(),
            registry,
            selection,
        }
    }

    pub fn build(self) -> DagPlan {
        DagPlan {
            stages: self.stages,
        }
    }

    pub fn validate(&self) -> anyhow::Result<()> {
        validate_stages(&self.stages).map_err(|e| anyhow::anyhow!("dag validation failed: {:?}", e))
    }

    pub fn topo_sorted(&self) -> anyhow::Result<Vec<StageName>> {
        topo_sort(&self.stages).map_err(|e| anyhow::anyhow!("dag topo failed: {:?}", e))
    }

    pub fn finalize(self) -> anyhow::Result<DagExecutionPlan> {
        validate_stages(&self.stages)
            .map_err(|e| anyhow::anyhow!("dag validation failed: {:?}", e))?;
        let topo_order =
            topo_sort(&self.stages).map_err(|e| anyhow::anyhow!("dag topo failed: {:?}", e))?;
        let artifacts = register_artifacts(&self.stages);
        Ok(DagExecutionPlan {
            stages: self.stages,
            topo_order,
            artifacts,
        })
    }

    fn push_stage(
        &mut self,
        name: impl Into<String>,
        kind: StageKind,
        deps: Vec<String>,
        outputs: Vec<String>,
        version: Option<VersionKey>,
        backend: Option<BackendRef>,
    ) {
        self.stages.push(StageDef {
            name: StageName(name.into()),
            kind,
            version,
            deps: deps.into_iter().map(StageName).collect(),
            outputs,
            backend,
        });
    }

    fn native_backend(&self, domain: &str) -> BackendRef {
        let d = match domain {
            "lyrics" => EngineDomain::Lyrics,
            "music" => EngineDomain::Music,
            "vocals" => EngineDomain::Vocals,
            "video" => EngineDomain::Video,
            "render" => EngineDomain::Render,
            _ => EngineDomain::Render,
        };
        let desc = resolve_engine_for_domain(&self.registry, &self.selection, d)
            .expect("engine resolution failed");
        let kind = match desc.provider_kind {
            EngineProviderKind::Native => BackendKind::Native,
            EngineProviderKind::Experimental => BackendKind::Experimental,
            EngineProviderKind::Provider => BackendKind::Provider,
        };
        BackendRef {
            engine: desc.id.name.0,
            version: desc.id.version.0,
            uri: desc.uri,
            kind,
        }
    }

    pub fn add_input_layer(mut self) -> Self {
        self.push_stage(
            "input_detect",
            StageKind::InputDetect,
            vec![],
            vec!["intent/input_detect.json".into()],
            None,
            None,
        );
        self.push_stage(
            "input_normalize",
            StageKind::InputNormalize,
            vec!["input_detect".into()],
            vec!["normalized/index.json".into()],
            None,
            None,
        );
        if self
            .intent
            .source_assets
            .iter()
            .any(|a| matches!(a.kind, InputKind::Voice | InputKind::SourceVideo))
        {
            self.push_stage(
                "input_transcribe",
                StageKind::InputTranscribe,
                vec!["input_normalize".into()],
                vec!["transcript.json".into()],
                None,
                None,
            );
        }
        self
    }

    pub fn add_understanding_layer(mut self) -> Self {
        self.push_stage(
            "intent_build",
            StageKind::IntentBuild,
            vec!["input_detect".into(), "input_normalize".into()],
            vec!["intent.json".into()],
            None,
            None,
        );
        self.push_stage(
            "brief_build",
            StageKind::BriefBuild,
            vec!["intent_build".into()],
            vec!["creative_brief.json".into()],
            None,
            None,
        );
        self.push_stage(
            "version_matrix_build",
            StageKind::VersionMatrixBuild,
            vec!["brief_build".into()],
            vec!["version_matrix.json".into()],
            None,
            None,
        );
        self
    }

    pub fn add_lyrics_layer(mut self) -> Self {
        self.push_stage(
            "lyrics_seed",
            StageKind::LyricsSeed,
            vec!["brief_build".into()],
            vec!["lyrics_seed.json".into()],
            None,
            Some(self.native_backend("lyrics")),
        );
        let primary = self.matrix.primary_lang.0.clone();
        self.push_stage(
            format!("lyrics_primary.{}", primary),
            StageKind::LyricsPrimary,
            vec!["lyrics_seed".into()],
            vec![naming::lyrics_path(&primary)],
            Some(VersionKey {
                lang: Some(self.matrix.primary_lang.clone()),
                voice: None,
                output: None,
            }),
            Some(self.native_backend("lyrics")),
        );
        for lang in self.matrix.langs.clone() {
            if lang.0 != primary {
                self.push_stage(
                    format!("lyrics_adapt.{}", lang.0),
                    StageKind::LyricsAdapt,
                    vec![format!("lyrics_primary.{}", primary)],
                    vec![naming::lyrics_path(&lang.0)],
                    Some(VersionKey {
                        lang: Some(lang.clone()),
                        voice: None,
                        output: None,
                    }),
                    Some(self.native_backend("lyrics")),
                );
            }
            let dep = if lang.0 == primary {
                format!("lyrics_primary.{}", lang.0)
            } else {
                format!("lyrics_adapt.{}", lang.0)
            };
            self.push_stage(
                format!("lyrics_timing.{}", lang.0),
                StageKind::LyricsTiming,
                vec![dep],
                vec![format!("lyrics_timed/{}.json", lang.0)],
                Some(VersionKey {
                    lang: Some(lang),
                    voice: None,
                    output: None,
                }),
                Some(self.native_backend("lyrics")),
            );
        }
        self
    }

    pub fn add_music_layer(mut self) -> Self {
        self.push_stage(
            "music_plan",
            StageKind::MusicPlan,
            vec!["brief_build".into()],
            vec!["music_plan.json".into()],
            None,
            Some(self.native_backend("music")),
        );
        self.push_stage(
            "music_compose",
            StageKind::MusicCompose,
            vec!["music_plan".into()],
            vec!["music/master_instrumental.wav".into()],
            None,
            Some(self.native_backend("music")),
        );
        self.push_stage(
            "vocal_plan",
            StageKind::VocalPlan,
            vec!["music_compose".into()],
            vec!["vocal_plan.json".into()],
            None,
            Some(self.native_backend("vocals")),
        );
        for lang in self.matrix.langs.clone() {
            for voice in self.matrix.voices.clone() {
                let vk = VersionKey {
                    lang: Some(lang.clone()),
                    voice: Some(voice.clone()),
                    output: None,
                };
                self.push_stage(
                    naming::stage_lang_voice("vocals", &lang.0, &voice.0),
                    StageKind::VocalsGenerate,
                    vec![format!("lyrics_timing.{}", lang.0), "vocal_plan".into()],
                    vec![naming::vocals_path(&lang.0, &voice.0)],
                    Some(vk.clone()),
                    Some(self.native_backend("vocals")),
                );
                self.push_stage(
                    naming::stage_lang_voice("mix", &lang.0, &voice.0),
                    StageKind::Mix,
                    vec![
                        "music_compose".into(),
                        naming::stage_lang_voice("vocals", &lang.0, &voice.0),
                    ],
                    vec![naming::mix_path(&lang.0, &voice.0)],
                    Some(vk),
                    Some(self.native_backend("vocals")),
                );
            }
        }
        self
    }

    pub fn add_video_layer(mut self) -> Self {
        self.push_stage(
            "video_concept",
            StageKind::VideoConcept,
            vec!["brief_build".into(), "music_compose".into()],
            vec!["video_concept.json".into()],
            None,
            Some(self.native_backend("video")),
        );
        self.push_stage(
            "video_plan",
            StageKind::VideoPlan,
            vec!["video_concept".into()],
            vec!["storyboard.json".into()],
            None,
            Some(self.native_backend("video")),
        );
        for i in 0..3 {
            let n = naming::stage_video_shot(i);
            self.push_stage(
                n.clone(),
                StageKind::VideoShot,
                vec!["video_plan".into()],
                vec![format!("video/shots/{}.mp4", n)],
                None,
                Some(self.native_backend("video")),
            );
        }
        self.push_stage(
            "video_assemble",
            StageKind::VideoAssemble,
            vec![
                naming::stage_video_shot(0),
                naming::stage_video_shot(1),
                naming::stage_video_shot(2),
            ],
            vec!["video/video.mp4".into()],
            None,
            Some(self.native_backend("video")),
        );
        self
    }

    pub fn add_sync_layer(mut self) -> Self {
        for lang in self.matrix.langs.clone() {
            self.push_stage(
                naming::stage_lang("subtitles", &lang.0),
                StageKind::SubtitlesGenerate,
                vec![format!("lyrics_timing.{}", lang.0)],
                vec![naming::subtitles_path(&lang.0)],
                Some(VersionKey {
                    lang: Some(lang.clone()),
                    voice: None,
                    output: None,
                }),
                None,
            );
            self.push_stage(
                naming::stage_lang("karaoke_ass", &lang.0),
                StageKind::KaraokeAss,
                vec![naming::stage_lang("subtitles", &lang.0)],
                vec![naming::karaoke_ass_path(&lang.0)],
                Some(VersionKey {
                    lang: Some(lang),
                    voice: None,
                    output: Some(OutputKind::KaraokeMv),
                }),
                None,
            );
        }
        self
    }

    pub fn add_output_layer(mut self) -> Self {
        for lang in self.matrix.langs.clone() {
            for voice in self.matrix.voices.clone() {
                self.push_stage(
                    format!("render_mv.{}.{}", lang.0, voice.0),
                    StageKind::RenderMv,
                    vec![
                        "video_assemble".into(),
                        naming::stage_lang_voice("mix", &lang.0, &voice.0),
                        naming::stage_lang("subtitles", &lang.0),
                    ],
                    vec![naming::render_path_mv(&lang.0, &voice.0)],
                    Some(VersionKey {
                        lang: Some(lang.clone()),
                        voice: Some(voice.clone()),
                        output: Some(OutputKind::Mv),
                    }),
                    Some(self.native_backend("render")),
                );
                self.push_stage(
                    format!("render_karaoke_mv.{}.{}", lang.0, voice.0),
                    StageKind::RenderKaraokeMv,
                    vec![
                        "video_assemble".into(),
                        naming::stage_lang_voice("mix", &lang.0, &voice.0),
                        naming::stage_lang("karaoke_ass", &lang.0),
                    ],
                    vec![naming::render_path_karaoke(&lang.0, &voice.0)],
                    Some(VersionKey {
                        lang: Some(lang.clone()),
                        voice: Some(voice.clone()),
                        output: Some(OutputKind::KaraokeMv),
                    }),
                    Some(self.native_backend("render")),
                );
            }
        }
        self.push_stage(
            "artifacts_index",
            StageKind::ArtifactsIndex,
            vec![],
            vec!["artifacts/index.json".into()],
            None,
            None,
        );
        self
    }
}
