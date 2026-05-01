use crate::engine_registry::registry::EngineRegistry;
use crate::engine_registry::types::*;

fn register_cssmv_version(
    reg: &mut EngineRegistry,
    version: &str,
    default_enabled: bool,
    tags: Vec<String>,
) {
    for domain in [
        EngineDomain::Lyrics,
        EngineDomain::Music,
        EngineDomain::Vocals,
        EngineDomain::Video,
        EngineDomain::Render,
    ] {
        let domain_str = match domain {
            EngineDomain::Lyrics => "lyrics",
            EngineDomain::Music => "music",
            EngineDomain::Vocals => "vocals",
            EngineDomain::Video => "video",
            EngineDomain::Render => "render",
        };

        reg.register(EngineDescriptor {
            id: EngineId {
                name: EngineName("cssmv".into()),
                version: EngineVersion(version.into()),
                domain: domain.clone(),
            },
            provider_kind: EngineProviderKind::Native,
            uri: format!("cssmv-native://{}", domain_str),
            default_enabled,
            publicly_selectable: true,
            tags: tags.clone(),
        });
    }
}

pub fn register_cssmv_v1(reg: &mut EngineRegistry) {
    register_cssmv_version(reg, "v1.0", true, vec!["stable".into(), "native".into()]);
}

pub fn register_cssmv_v2(reg: &mut EngineRegistry) {
    register_cssmv_version(reg, "v2.0", false, vec!["native".into()]);
}

pub fn register_cssmv_v3(reg: &mut EngineRegistry) {
    register_cssmv_version(
        reg,
        "v3.0",
        false,
        vec!["native".into(), "multi-lang".into(), "multi-voice".into()],
    );
}

// CSSOS_PHASE2_3P_ENGINES 20260417 — register the third-party engines that
// drive the browser-orchestrated MV pipeline. Each one is provider_kind
// = Provider (not Native), publicly_selectable = true, default_enabled follows
// whether we have the API key in the process env.
fn register_third_party(reg: &mut EngineRegistry) {
    let musicgpt_enabled = std::env::var("MUSICGPT_API_KEY")
        .map(|k| !k.trim().is_empty())
        .unwrap_or(false);
    // CSSOS_PHASE2_SUNO 20260419 — Suno v5 is gated on SUNO_API_KEY. When
    // both SUNO_API_KEY and MUSICGPT_API_KEY are set, the music handler in
    // pipeline_mv_api.rs prefers whichever engine the caller selected via the
    // `/api/mv/engines` catalog; Suno is marked as the catalog default in
    // billing_matrix::builtin_registry so new users land on it automatically.
    //
    // CSSOS_PHASE2_KIE_PIVOT 20260429 #204 — KIE_API_KEY is accepted as an
    // alias because we deploy via the kie.ai gateway and the env file uses
    // that name; the suno.rs adapter checks both names too.
    let suno_enabled = std::env::var("SUNO_API_KEY")
        .or_else(|_| std::env::var("KIE_API_KEY"))
        .map(|k| !k.trim().is_empty())
        .unwrap_or(false);
    let runway_enabled = std::env::var("RUNWAY_API_KEY")
        .map(|k| !k.trim().is_empty())
        .unwrap_or(false);
    let stability_enabled = std::env::var("STABILITY_API_KEY")
        .map(|k| !k.trim().is_empty())
        .unwrap_or(false);
    // CSSOS_PHASE2_MUSIC_MULTIPROVIDER 20260419 — ElevenLabs Music gates on
    // ELEVEN_API_KEY (legacy ELEVENLABS_API_KEY accepted as an alias). The
    // same flag gates both the music adapter and any future ElevenLabs
    // voice / TTS engines — one org key unlocks their whole stack.
    let elevenlabs_enabled = std::env::var("ELEVEN_API_KEY")
        .or_else(|_| std::env::var("ELEVENLABS_API_KEY"))
        .map(|k| !k.trim().is_empty())
        .unwrap_or(false);

    reg.register(EngineDescriptor {
        id: EngineId {
            name: EngineName("suno".into()),
            version: EngineVersion("v5".into()),
            domain: EngineDomain::Music,
        },
        provider_kind: EngineProviderKind::Provider,
        uri: "suno://api/v1/generate".into(),
        default_enabled: suno_enabled,
        publicly_selectable: true,
        tags: vec![
            "third-party".into(),
            "music".into(),
            "vocals".into(),
            "commercial".into(),
        ],
    });

    // CSSOS_PHASE2_MUSIC_VERSIONING 20260419 — Suno v4 is exposed as a
    // separately-selectable version; it shares SUNO_API_KEY with v5 and the
    // adapter routes to the right upstream model via the per-request
    // `version` field added in MusicGenRequest.
    reg.register(EngineDescriptor {
        id: EngineId {
            name: EngineName("suno".into()),
            version: EngineVersion("v4".into()),
            domain: EngineDomain::Music,
        },
        provider_kind: EngineProviderKind::Provider,
        uri: "suno://api/v1/generate".into(),
        default_enabled: suno_enabled,
        publicly_selectable: true,
        tags: vec![
            "third-party".into(),
            "music".into(),
            "vocals".into(),
            "commercial".into(),
            "stable".into(),
        ],
    });

    reg.register(EngineDescriptor {
        id: EngineId {
            name: EngineName("musicgpt".into()),
            version: EngineVersion("v1.0".into()),
            domain: EngineDomain::Music,
        },
        provider_kind: EngineProviderKind::Provider,
        uri: "musicgpt://api/public/v1/MusicAI".into(),
        default_enabled: musicgpt_enabled,
        publicly_selectable: true,
        tags: vec!["third-party".into(), "music".into()],
    });

    // CSSOS_PHASE2_MUSIC_MULTIPROVIDER 20260419 — ElevenLabs Music v1.
    // Prompt-driven, synchronous audio-bytes response; the adapter caches
    // the clip to the local work_assets dir and returns a file:// URL.
    reg.register(EngineDescriptor {
        id: EngineId {
            name: EngineName("elevenlabs".into()),
            version: EngineVersion("v1".into()),
            domain: EngineDomain::Music,
        },
        provider_kind: EngineProviderKind::Provider,
        uri: "elevenlabs://v1/music".into(),
        default_enabled: elevenlabs_enabled,
        publicly_selectable: true,
        tags: vec![
            "third-party".into(),
            "music".into(),
            "prompt-only".into(),
            "commercial".into(),
        ],
    });

    // CSSOS_PHASE2_MUSIC_MULTIPROVIDER 20260419 — Stability Stable Audio 2.0.
    // Instrumental-leaning (no vocals); reuses STABILITY_API_KEY so the same
    // org key unlocks both the SDXL cover engine and the audio service.
    reg.register(EngineDescriptor {
        id: EngineId {
            name: EngineName("stability".into()),
            version: EngineVersion("2.0".into()),
            domain: EngineDomain::Music,
        },
        provider_kind: EngineProviderKind::Provider,
        uri: "stability://v2beta/audio/stable-audio-2/text-to-audio".into(),
        default_enabled: stability_enabled,
        publicly_selectable: true,
        tags: vec![
            "third-party".into(),
            "music".into(),
            "instrumental".into(),
            "commercial".into(),
        ],
    });

    reg.register(EngineDescriptor {
        id: EngineId {
            name: EngineName("runway".into()),
            version: EngineVersion("gen3".into()),
            domain: EngineDomain::Video,
        },
        provider_kind: EngineProviderKind::Provider,
        uri: "runway://v1/image_to_video".into(),
        default_enabled: runway_enabled,
        publicly_selectable: true,
        tags: vec!["third-party".into(), "video".into()],
    });

    reg.register(EngineDescriptor {
        id: EngineId {
            name: EngineName("runway".into()),
            version: EngineVersion("gen4-image".into()),
            domain: EngineDomain::Render,
        },
        provider_kind: EngineProviderKind::Provider,
        uri: "runway://v1/text_to_image".into(),
        default_enabled: runway_enabled,
        publicly_selectable: true,
        tags: vec!["third-party".into(), "cover".into()],
    });

    reg.register(EngineDescriptor {
        id: EngineId {
            name: EngineName("stability".into()),
            version: EngineVersion("sdxl".into()),
            domain: EngineDomain::Render,
        },
        provider_kind: EngineProviderKind::Provider,
        uri: "stability://v2beta/stable-image/generate".into(),
        default_enabled: stability_enabled,
        publicly_selectable: true,
        tags: vec!["third-party".into(), "cover".into(), "fallback".into()],
    });
}

pub fn default_registry() -> EngineRegistry {
    let mut reg = EngineRegistry::new();
    register_cssmv_v1(&mut reg);
    register_cssmv_v2(&mut reg);
    register_cssmv_v3(&mut reg);
    register_third_party(&mut reg);
    reg
}
