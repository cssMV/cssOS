use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Default)]
struct VersionKey {
    pub lang: Option<String>,
    pub voice: Option<String>,
    pub output: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ProductionVersionRow {
    pub lang: Option<String>,
    pub voice: Option<String>,
    pub output: Option<String>,
    pub artifact_ready: bool,
    pub quality_ok: bool,
    #[serde(default)]
    pub billing_usd: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub render_time_ms: Option<u64>,
    #[serde(default)]
    pub primary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct ProductionPipelineSummary {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub total_wall_time_ms: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub critical_path_ms: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub slowest_stage: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct ProductionTotals {
    pub versions: usize,
    pub artifacts_ready: usize,
    pub quality_passed: usize,
    pub estimated_cost_usd: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct ProductionView {
    pub pipeline: ProductionPipelineSummary,
    pub versions: Vec<ProductionVersionRow>,
    pub totals: ProductionTotals,
}

#[derive(Debug, Clone, Default)]
struct Acc {
    artifact_ready: bool,
    quality_ok: bool,
    primary: bool,
}

fn render_stage_name(key: &VersionKey) -> Option<String> {
    let lang = key.lang.as_deref()?;
    let voice = key.voice.as_deref()?;
    match key.output.as_deref() {
        Some("mv") => Some(format!("render_mv.{}.{}", lang, voice)),
        Some("karaoke_mv") => Some(format!("render_karaoke_mv.{}.{}", lang, voice)),
        Some("audio_only") => Some(format!("render_audio_only.{}.{}", lang, voice)),
        _ => None,
    }
}

fn render_time_ms_for(
    timeline: Option<&crate::timeline::RunTimelineView>,
    key: &VersionKey,
) -> Option<u64> {
    let stage = render_stage_name(key)?;
    timeline?
        .stages
        .iter()
        .find(|s| s.name == stage)
        .and_then(|s| s.duration_ms)
}

pub fn build_production_view(
    timeline: Option<&crate::timeline::RunTimelineView>,
    artifacts: Option<&crate::artifact_versions::ArtifactVersionsView>,
    quality: Option<&crate::quality_versions::QualityVersionsView>,
    billing: Option<&crate::ready::BillingSummary>,
    primary_lang: Option<&str>,
    primary_voice: Option<&str>,
) -> ProductionView {
    let mut acc = BTreeMap::<VersionKey, Acc>::new();

    if let Some(v) = artifacts {
        for g in &v.groups {
            for it in &g.items {
                if it.key.lang.is_none() && it.key.voice.is_none() && it.key.output.is_none() {
                    continue;
                }
                let key = VersionKey {
                    lang: it.key.lang.clone(),
                    voice: it.key.voice.clone(),
                    output: it.key.output.clone(),
                };
                let e = acc.entry(key).or_default();
                e.artifact_ready = e.artifact_ready || it.present;
            }
        }
    }

    if let Some(v) = quality {
        for it in &v.items {
            if it.key.lang.is_none() && it.key.voice.is_none() && it.key.output.is_none() {
                continue;
            }
            let key = VersionKey {
                lang: it.key.lang.clone(),
                voice: it.key.voice.clone(),
                output: it.key.output.clone(),
            };
            let e = acc.entry(key).or_default();
            e.quality_ok = it.ok;
            e.primary = it.primary;
        }
    }

    for (k, e) in acc.iter_mut() {
        if !e.primary {
            e.primary = k.lang.as_deref() == primary_lang
                && k.voice.as_deref() == primary_voice
                && k.output.as_deref() == Some("mv");
        }
    }

    let per_row = if let Some(b) = billing {
        if acc.is_empty() {
            0.0
        } else {
            b.total_price_usd / (acc.len() as f64)
        }
    } else {
        0.0
    };

    let mut rows: Vec<ProductionVersionRow> = acc
        .into_iter()
        .map(|(k, v)| ProductionVersionRow {
            lang: k.lang.clone(),
            voice: k.voice.clone(),
            output: k.output.clone(),
            artifact_ready: v.artifact_ready,
            quality_ok: v.quality_ok,
            billing_usd: per_row,
            render_time_ms: render_time_ms_for(timeline, &k),
            primary: v.primary,
        })
        .collect();

    rows.sort_by(|a, b| {
        (a.lang.clone(), a.voice.clone(), a.output.clone()).cmp(&(
            b.lang.clone(),
            b.voice.clone(),
            b.output.clone(),
        ))
    });

    let versions = rows.len();
    let artifacts_ready = rows.iter().filter(|x| x.artifact_ready).count();
    let quality_passed = rows.iter().filter(|x| x.quality_ok).count();
    let estimated_cost_usd = billing
        .map(|b| b.total_price_usd)
        .unwrap_or_else(|| rows.iter().map(|x| x.billing_usd).sum());

    ProductionView {
        pipeline: ProductionPipelineSummary {
            total_wall_time_ms: timeline.and_then(|t| t.total_wall_time_ms),
            critical_path_ms: timeline.and_then(|t| t.critical_path_ms),
            slowest_stage: timeline.and_then(|t| t.slowest_stage.name.clone()),
        },
        versions: rows,
        totals: ProductionTotals {
            versions,
            artifacts_ready,
            quality_passed,
            estimated_cost_usd,
        },
    }
}
