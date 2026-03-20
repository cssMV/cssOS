use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Default)]
pub struct ArtifactVersionViewKey {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lang: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub voice: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtifactVersionItem {
    pub key: ArtifactVersionViewKey,
    pub stable_key: String,
    pub present: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stage: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mime: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ArtifactVersionGroup {
    pub stable_key: String,
    pub items: Vec<ArtifactVersionItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ArtifactVersionsView {
    pub groups: Vec<ArtifactVersionGroup>,
}

fn output_kind_str(v: &crate::dag_v3::types::OutputKind) -> String {
    use crate::dag_v3::types::OutputKind::*;
    match v {
        Mv => "mv".into(),
        KaraokeMv => "karaoke_mv".into(),
        AudioOnly => "audio_only".into(),
        Instrumental => "instrumental".into(),
        Preview15s => "preview_15s".into(),
        Preview30s => "preview_30s".into(),
        MarketPack => "market_pack".into(),
    }
}

fn version_to_view_key(v: &Option<crate::dag_v3::matrix::VersionKey>) -> ArtifactVersionViewKey {
    if let Some(vk) = v {
        ArtifactVersionViewKey {
            lang: vk.lang.as_ref().map(|x| x.0.clone()),
            voice: vk.voice.as_ref().map(|x| x.0.clone()),
            output: vk.output.as_ref().map(output_kind_str),
        }
    } else {
        ArtifactVersionViewKey::default()
    }
}

fn file_ok(p: &Path) -> bool {
    std::fs::metadata(p).map(|m| m.len() > 0).unwrap_or(false)
}

fn as_abs(run_dir: &Path, path: &str) -> PathBuf {
    let p = PathBuf::from(path);
    if p.is_absolute() {
        p
    } else {
        run_dir.join(p)
    }
}

pub fn build_versions_view(
    run_dir: &Path,
    expected: &crate::dag_v3::artifacts::ArtifactIndex,
) -> ArtifactVersionsView {
    let mut groups = BTreeMap::<String, Vec<ArtifactVersionItem>>::new();

    for a in &expected.items {
        let key = version_to_view_key(&a.version);
        let present = file_ok(&as_abs(run_dir, &a.path));
        groups
            .entry(a.stable_key.clone())
            .or_default()
            .push(ArtifactVersionItem {
                key,
                stable_key: a.stable_key.clone(),
                present,
                stage: a.stage.clone(),
                path: Some(a.path.clone()),
                mime: Some(a.mime.clone()),
            });
    }

    let mut out = ArtifactVersionsView {
        groups: groups
            .into_iter()
            .map(|(stable_key, mut items)| {
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
                ArtifactVersionGroup { stable_key, items }
            })
            .collect(),
    };
    out.groups.sort_by(|a, b| a.stable_key.cmp(&b.stable_key));
    out
}
