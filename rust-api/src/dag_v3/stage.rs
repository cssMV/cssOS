use serde::{Deserialize, Serialize};

use crate::dag_v3::matrix::VersionKey;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StageKind {
    InputDetect,
    InputNormalize,
    InputTranscribe,
    InputScoreParse,
    InputMediaAnalyze,
    IntentBuild,
    BriefBuild,
    VersionMatrixBuild,
    LyricsSeed,
    LyricsPrimary,
    LyricsAdapt,
    LyricsTiming,
    MusicPlan,
    MusicCompose,
    MusicStems,
    MusicMidiExport,
    VocalPlan,
    VocalsGenerate,
    VocalsAlign,
    Mix,
    Master,
    VideoConcept,
    VideoPlan,
    VideoShot,
    VideoMotionRefine,
    VideoAssemble,
    VideoCover,
    SubtitlesGenerate,
    KaraokeMap,
    KaraokeAss,
    LyricsLrc,
    RenderMv,
    RenderKaraokeMv,
    RenderAudioOnly,
    RenderInstrumental,
    MetadataPublish,
    PreviewPack,
    MarketPack,
    ArtifactsIndex,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub struct StageName(pub String);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StageDef {
    pub name: StageName,
    pub kind: StageKind,
    #[serde(default)]
    pub version: Option<VersionKey>,
    #[serde(default)]
    pub deps: Vec<StageName>,
    #[serde(default)]
    pub outputs: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub backend: Option<crate::dag_v3::types::BackendRef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DagPlan {
    pub stages: Vec<StageDef>,
}
