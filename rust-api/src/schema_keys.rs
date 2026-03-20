use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

pub const STABLE_KEYS_V46: [&str; 5] = [
    "final.mv",
    "subtitles.ass",
    "mix.wav",
    "lyrics.json",
    "video.mp4",
];

pub const VIDEO_PLAN_STAGE: &str = "video_plan";
pub const VIDEO_ASSEMBLE_STAGE: &str = "video_assemble";
pub const VIDEO_SHOT_PREFIX: &str = "video_shot_";
pub const VIDEO_SHOT_WIDTH: usize = 3;
pub const VIDEO_SHOT_LEGACY_PREFIX: &str = "video.shot:";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VideoProgressReason {
    Pending,
    Running,
    Failed,
    Cancelled,
    Timeout,
    Succeeded,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VideoReasonStage {
    VideoPlan,
    VideoAssemble,
}

impl VideoReasonStage {
    pub fn as_stage_name(self) -> &'static str {
        match self {
            Self::VideoPlan => VIDEO_PLAN_STAGE,
            Self::VideoAssemble => VIDEO_ASSEMBLE_STAGE,
        }
    }
}

pub fn stable_keys_v46() -> &'static [&'static str] {
    &STABLE_KEYS_V46
}

pub fn stable_keys_v46_vec() -> Vec<String> {
    STABLE_KEYS_V46.iter().map(|s| (*s).to_string()).collect()
}

pub fn video_shot_stage_key(idx: usize) -> String {
    format!("{VIDEO_SHOT_PREFIX}{idx:0width$}", width = VIDEO_SHOT_WIDTH)
}

pub fn is_video_plan_stage(name: &str) -> bool {
    name == VIDEO_PLAN_STAGE
}

pub fn is_video_assemble_stage(name: &str) -> bool {
    name == VIDEO_ASSEMBLE_STAGE
}

pub fn is_video_shot_stage(name: &str) -> bool {
    name.starts_with(VIDEO_SHOT_PREFIX) || name.starts_with(VIDEO_SHOT_LEGACY_PREFIX)
}

pub fn is_video_stage(name: &str) -> bool {
    is_video_plan_stage(name) || is_video_assemble_stage(name) || is_video_shot_stage(name)
}

pub fn video_reason_stage_from_name(name: &str) -> Option<VideoReasonStage> {
    if is_video_plan_stage(name) {
        Some(VideoReasonStage::VideoPlan)
    } else if is_video_assemble_stage(name) {
        Some(VideoReasonStage::VideoAssemble)
    } else {
        None
    }
}

pub fn is_video_reason_stage(name: &str) -> bool {
    video_reason_stage_from_name(name).is_some()
}

pub fn present_keys_ordered(stable: &[&str], present_set: &BTreeSet<String>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for k in stable {
        if present_set.contains(*k) {
            out.push((*k).to_string());
        }
    }
    let mut rest: Vec<String> = present_set
        .iter()
        .filter(|k| !stable.iter().any(|s| *s == k.as_str()))
        .cloned()
        .collect();
    rest.sort();
    out.extend(rest);
    out
}

pub fn ordered_keys_stable_first(stable: &[&str], keys: &BTreeSet<String>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for k in stable {
        if keys.contains(*k) {
            out.push((*k).to_string());
        }
    }
    let mut rest: Vec<String> = keys
        .iter()
        .filter(|k| !stable.iter().any(|s| *s == k.as_str()))
        .cloned()
        .collect();
    rest.sort();
    out.extend(rest);
    out
}

pub fn ordered_map_keys_stable_first<T>(stable: &[&str], map: &BTreeMap<String, T>) -> Vec<String> {
    let keys: BTreeSet<String> = map.keys().cloned().collect();
    ordered_keys_stable_first(stable, &keys)
}
