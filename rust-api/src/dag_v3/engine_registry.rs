use std::collections::BTreeMap;

use crate::dag_v3::types::{BackendKind, BackendRef};

#[derive(Debug, Clone)]
pub struct EngineVersionInfo {
    pub engine: String,
    pub version: String,
    pub price_usd: f64,
}

pub fn default_cssmv_version() -> String {
    std::env::var("CSSMV_ENGINE_VERSION").unwrap_or_else(|_| "v3.0".to_string())
}

pub fn supported_cssmv_versions() -> Vec<&'static str> {
    vec!["v1.0", "v2.0", "v3.0", "v4.0", "v5.0"]
}

pub fn pricing_table() -> BTreeMap<String, EngineVersionInfo> {
    let mut m = BTreeMap::new();
    m.insert(
        "v1.0".to_string(),
        EngineVersionInfo {
            engine: "cssmv".to_string(),
            version: "v1.0".to_string(),
            price_usd: 0.05,
        },
    );
    m.insert(
        "v2.0".to_string(),
        EngineVersionInfo {
            engine: "cssmv".to_string(),
            version: "v2.0".to_string(),
            price_usd: 0.10,
        },
    );
    m.insert(
        "v3.0".to_string(),
        EngineVersionInfo {
            engine: "cssmv".to_string(),
            version: "v3.0".to_string(),
            price_usd: 0.20,
        },
    );
    m.insert(
        "v4.0".to_string(),
        EngineVersionInfo {
            engine: "cssmv".to_string(),
            version: "v4.0".to_string(),
            price_usd: 0.50,
        },
    );
    m.insert(
        "v5.0".to_string(),
        EngineVersionInfo {
            engine: "cssmv".to_string(),
            version: "v5.0".to_string(),
            price_usd: 1.00,
        },
    );
    m
}

pub fn backend_ref(engine: &str, version: &str, kind: BackendKind, uri: String) -> BackendRef {
    BackendRef {
        engine: engine.to_string(),
        version: version.to_string(),
        uri,
        kind,
    }
}
