use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum InputKind {
    Click,
    Text,
    Voice,
    Midi,
    MusicXml,
    ScorePdf,
    Image,
    DryVocal,
    SourceMusic,
    SourceVideo,
    SourceLyrics,
    SourceSubtitles,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum ProjectMode {
    #[default]
    FromScratch,
    MusicToMv,
    VocalToSong,
    VideoToKaraoke,
    Remix,
    MultiVersion,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Default)]
pub struct LangCode(pub String);

impl LangCode {
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Default)]
pub struct VoiceId(pub String);

impl VoiceId {
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum OutputKind {
    Mv,
    KaraokeMv,
    AudioOnly,
    Instrumental,
    Preview15s,
    Preview30s,
    MarketPack,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BackendKind {
    Native,
    Experimental,
    Provider,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BackendRef {
    pub engine: String,
    pub version: String,
    pub uri: String,
    pub kind: BackendKind,
}
