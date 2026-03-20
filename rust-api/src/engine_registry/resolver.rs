use crate::engine_registry::registry::EngineRegistry;
use crate::engine_registry::types::*;

#[derive(Debug, Clone)]
pub struct EngineSelectionRequest {
    pub engine: Option<EngineName>,
    pub version: Option<EngineVersion>,
}

impl Default for EngineSelectionRequest {
    fn default() -> Self {
        Self {
            engine: Some(EngineName("cssmv".into())),
            version: Some(EngineVersion("v3.0".into())),
        }
    }
}

pub fn resolve_engine_for_domain(
    reg: &EngineRegistry,
    req: &EngineSelectionRequest,
    domain: EngineDomain,
) -> anyhow::Result<EngineDescriptor> {
    let name = req.engine.clone().unwrap_or(EngineName("cssmv".into()));
    let version = req.version.clone().unwrap_or(EngineVersion("v3.0".into()));

    let id = EngineId {
        name,
        version,
        domain,
    };

    reg.get(&id)
        .cloned()
        .ok_or_else(|| anyhow::anyhow!("engine not found"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_can_resolve_cssmv_v3_music() {
        let reg = crate::engine_registry::defaults::default_registry();
        let req = EngineSelectionRequest {
            engine: Some(EngineName("cssmv".into())),
            version: Some(EngineVersion("v3.0".into())),
        };

        let desc = resolve_engine_for_domain(&reg, &req, EngineDomain::Music).unwrap();
        assert_eq!(desc.uri, "cssmv-native://music");
    }
}
