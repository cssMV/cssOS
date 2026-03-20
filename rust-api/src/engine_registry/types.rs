use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub struct EngineName(pub String);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub struct EngineVersion(pub String);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum EngineDomain {
    Lyrics,
    Music,
    Vocals,
    Video,
    Render,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EngineProviderKind {
    Native,
    Experimental,
    Provider,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub struct EngineId {
    pub name: EngineName,
    pub version: EngineVersion,
    pub domain: EngineDomain,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineDescriptor {
    pub id: EngineId,
    pub provider_kind: EngineProviderKind,
    pub uri: String,
    pub default_enabled: bool,
    pub publicly_selectable: bool,
    #[serde(default)]
    pub tags: Vec<String>,
}
