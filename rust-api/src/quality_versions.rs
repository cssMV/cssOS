use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use utoipa::ToSchema;

#[derive(
    Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Default, ToSchema,
)]
pub struct QualityVersionKey {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lang: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub voice: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct QualityGateView {
    pub code: String,
    pub ok: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(default)]
    pub metrics: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct QualityVersionItem {
    pub key: QualityVersionKey,
    #[serde(default)]
    pub gates: Vec<QualityGateView>,
    pub ok: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub blocking_gate: Option<String>,
    pub milestone_ready: bool,
    #[serde(default)]
    pub primary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct QualityVersionsView {
    pub items: Vec<QualityVersionItem>,
}

fn key_from_version_obj(
    v: Option<&serde_json::Map<String, serde_json::Value>>,
) -> QualityVersionKey {
    QualityVersionKey {
        lang: v
            .and_then(|x| x.get("lang"))
            .and_then(|x| x.as_str())
            .map(|s| s.to_string()),
        voice: v
            .and_then(|x| x.get("voice"))
            .and_then(|x| x.as_str())
            .map(|s| s.to_string()),
        output: v
            .and_then(|x| x.get("output"))
            .and_then(|x| x.as_str())
            .map(|s| s.to_string()),
    }
}

fn primary_from_state(st: &crate::run_state::RunState) -> (Option<String>, Option<String>) {
    let primary_lang = st
        .commands
        .get("matrix")
        .and_then(|m| m.get("primary_lang"))
        .and_then(|x| x.as_str())
        .map(|s| s.to_string());
    let primary_voice = st
        .commands
        .get("matrix")
        .and_then(|m| m.get("primary_voice"))
        .and_then(|x| x.as_str())
        .map(|s| s.to_string());
    (primary_lang, primary_voice)
}

pub fn build_quality_versions_view(
    st: &crate::run_state::RunState,
    _plan: Option<&crate::dag_v3::plan::DagExecutionPlan>,
) -> QualityVersionsView {
    let mut map = BTreeMap::<QualityVersionKey, Vec<QualityGateView>>::new();

    for rec in st.stages.values() {
        let Some(meta) = rec.meta.as_object() else {
            continue;
        };
        let Some(gates) = meta.get("quality_gates").and_then(|x| x.as_array()) else {
            continue;
        };
        for g in gates {
            let key = key_from_version_obj(g.get("version").and_then(|x| x.as_object()));
            let gate = QualityGateView {
                code: g
                    .get("code")
                    .and_then(|x| x.as_str())
                    .unwrap_or("")
                    .to_string(),
                ok: g.get("ok").and_then(|x| x.as_bool()).unwrap_or(false),
                reason: g
                    .get("reason")
                    .and_then(|x| x.as_str())
                    .map(|s| s.to_string())
                    .filter(|s| !s.is_empty()),
                metrics: g
                    .get("metrics")
                    .cloned()
                    .unwrap_or_else(|| serde_json::json!({})),
            };
            if gate.code.is_empty() {
                continue;
            }
            map.entry(key).or_default().push(gate);
        }
    }

    let (pl, pv) = primary_from_state(st);
    let mut items: Vec<QualityVersionItem> = map
        .into_iter()
        .map(|(key, mut gates)| {
            gates.sort_by(|a, b| a.code.cmp(&b.code));
            let blocking = gates.iter().find(|g| !g.ok).map(|g| g.code.clone());
            let ok = blocking.is_none();
            let primary = key.lang.as_deref() == pl.as_deref()
                && key.voice.as_deref() == pv.as_deref()
                && key.output.as_deref() == Some("mv");
            QualityVersionItem {
                key,
                gates,
                ok,
                blocking_gate: blocking,
                milestone_ready: ok,
                primary,
            }
        })
        .collect();

    items.sort_by(|a, b| {
        (
            a.key.lang.clone(),
            a.key.voice.clone(),
            a.key.output.clone(),
        )
            .cmp(&(
                b.key.lang.clone(),
                b.key.voice.clone(),
                b.key.output.clone(),
            ))
    });

    QualityVersionsView { items }
}
