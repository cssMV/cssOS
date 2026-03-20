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

pub fn default_registry() -> EngineRegistry {
    let mut reg = EngineRegistry::new();
    register_cssmv_v1(&mut reg);
    register_cssmv_v2(&mut reg);
    register_cssmv_v3(&mut reg);
    reg
}
