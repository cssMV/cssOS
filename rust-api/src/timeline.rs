use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct TimelineStageView {
    pub name: String,
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub started_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub finished_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct TimelineSlowestStage {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct RunTimelineView {
    #[serde(default)]
    pub stages: Vec<TimelineStageView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub total_wall_time_ms: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub critical_path_ms: Option<u64>,
    #[serde(default)]
    pub slowest_stage: TimelineSlowestStage,
}

fn parse_ts(s: &Option<String>) -> Option<DateTime<Utc>> {
    s.as_ref()
        .and_then(|x| chrono::DateTime::parse_from_rfc3339(x).ok())
        .map(|x| x.with_timezone(&Utc))
}

fn stage_duration_ms(started_at: &Option<String>, finished_at: &Option<String>) -> Option<u64> {
    let start = parse_ts(started_at)?;
    let end = parse_ts(finished_at)?;
    let ms = end.signed_duration_since(start).num_milliseconds();
    if ms < 0 {
        None
    } else {
        Some(ms as u64)
    }
}

pub fn build_stage_timeline(
    st: &crate::run_state::RunState,
    topo_order: &[String],
) -> Vec<TimelineStageView> {
    topo_order
        .iter()
        .map(|name| {
            let rec = st.stages.get(name);
            let started_at = rec.and_then(|r| r.started_at.clone());
            let finished_at = rec.and_then(|r| r.ended_at.clone());
            let status = rec
                .map(|r| format!("{:?}", r.status).to_lowercase())
                .unwrap_or_else(|| "pending".to_string());
            TimelineStageView {
                name: name.clone(),
                status,
                duration_ms: stage_duration_ms(&started_at, &finished_at),
                started_at,
                finished_at,
            }
        })
        .collect()
}

pub fn total_wall_time_ms(stages: &[TimelineStageView]) -> Option<u64> {
    let starts: Vec<_> = stages
        .iter()
        .filter_map(|s| parse_ts(&s.started_at))
        .collect();
    let ends: Vec<_> = stages
        .iter()
        .filter_map(|s| parse_ts(&s.finished_at))
        .collect();
    if starts.is_empty() || ends.is_empty() {
        return None;
    }
    let min_start = starts.iter().min()?;
    let max_end = ends.iter().max()?;
    let ms = max_end.signed_duration_since(*min_start).num_milliseconds();
    if ms < 0 {
        None
    } else {
        Some(ms as u64)
    }
}

pub fn slowest_stage(stages: &[TimelineStageView]) -> TimelineSlowestStage {
    if let Some((name, duration_ms)) = stages
        .iter()
        .filter_map(|s| s.duration_ms.map(|d| (s.name.clone(), d)))
        .max_by_key(|(_, d)| *d)
    {
        return TimelineSlowestStage {
            name: Some(name),
            duration_ms: Some(duration_ms),
        };
    }
    TimelineSlowestStage::default()
}

pub fn critical_path_ms(
    plan: &crate::dag_v3::plan::DagExecutionPlan,
    stages: &[TimelineStageView],
) -> Option<u64> {
    let dur_map: BTreeMap<String, u64> = stages
        .iter()
        .map(|s| (s.name.clone(), s.duration_ms.unwrap_or(0)))
        .collect();

    let mut best = BTreeMap::<String, u64>::new();
    let stage_map: BTreeMap<String, &crate::dag_v3::stage::StageDef> =
        plan.stages.iter().map(|s| (s.name.0.clone(), s)).collect();

    let order: Vec<String> = if !plan.topo_order.is_empty() {
        plan.topo_order.iter().map(|x| x.0.clone()).collect()
    } else {
        plan.stages.iter().map(|x| x.name.0.clone()).collect()
    };

    for name in order {
        let stage = stage_map.get(&name)?;
        let own = dur_map.get(&name).copied().unwrap_or(0);
        let dep_best = stage
            .deps
            .iter()
            .filter_map(|d| best.get(&d.0).copied())
            .max()
            .unwrap_or(0);
        best.insert(name, dep_best + own);
    }

    best.values().copied().max()
}

pub fn build_run_timeline(
    st: &crate::run_state::RunState,
    topo_order: &[String],
    plan: Option<&crate::dag_v3::plan::DagExecutionPlan>,
) -> RunTimelineView {
    let stages = build_stage_timeline(st, topo_order);
    let total = total_wall_time_ms(&stages);
    let slowest = slowest_stage(&stages);
    let critical = plan.and_then(|p| critical_path_ms(p, &stages));

    RunTimelineView {
        stages,
        total_wall_time_ms: total,
        critical_path_ms: critical,
        slowest_stage: slowest,
    }
}
