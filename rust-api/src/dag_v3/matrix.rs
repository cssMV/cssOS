use serde::{Deserialize, Serialize};

use crate::dag_v3::types::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionMatrix {
    pub primary_lang: LangCode,
    pub primary_voice: VoiceId,
    pub langs: Vec<LangCode>,
    pub voices: Vec<VoiceId>,
    pub outputs: Vec<OutputKind>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub struct VersionKey {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lang: Option<LangCode>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub voice: Option<VoiceId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub output: Option<OutputKind>,
}

pub fn build_version_matrix(intent: &crate::dag_v3::intent::Intent) -> VersionMatrix {
    let primary_lang = if intent.primary_lang.trim().is_empty() {
        "en".to_string()
    } else {
        intent.primary_lang.clone()
    };
    let langs: Vec<LangCode> = if intent.target_langs.is_empty() {
        vec![LangCode(primary_lang.clone())]
    } else {
        intent
            .target_langs
            .iter()
            .map(|x| LangCode(x.clone()))
            .collect()
    };
    let voices: Vec<VoiceId> = if intent.target_voices.is_empty() {
        vec![VoiceId("female".to_string())]
    } else {
        intent
            .target_voices
            .iter()
            .map(|x| VoiceId(x.clone()))
            .collect()
    };
    let mut outputs = vec![
        OutputKind::Mv,
        OutputKind::AudioOnly,
        OutputKind::Instrumental,
    ];
    if intent.karaoke {
        outputs.push(OutputKind::KaraokeMv);
    }
    VersionMatrix {
        primary_lang: LangCode(primary_lang),
        primary_voice: voices
            .first()
            .cloned()
            .unwrap_or_else(|| VoiceId("female".to_string())),
        langs,
        voices,
        outputs,
    }
}
