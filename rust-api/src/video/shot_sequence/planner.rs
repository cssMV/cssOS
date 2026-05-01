#[derive(Debug, Clone)]
pub enum ShotKind {
    Wide,
    Medium,
    CloseUp,
    Tracking,
    PushIn,
}

#[derive(Debug, Clone)]
pub struct ShotBeat {
    pub index: usize,
    pub shot: ShotKind,
    pub camera_prompt: String,
    pub motion_prompt: String,
}

pub fn build_shot_sequence(script: &str, frame_count: usize) -> Vec<ShotBeat> {
    let s = script.to_lowercase();

    if s.contains("追逐") || s.contains("奔跑") || s.contains("骑马") {
        return action_sequence(frame_count);
    }
    if s.contains("对视") || s.contains("凝视") || s.contains("情绪强烈") {
        return emotional_sequence(frame_count);
    }
    if s.contains("战场") || s.contains("城墙") || s.contains("广阔") {
        return epic_sequence(frame_count);
    }

    default_sequence(frame_count)
}

fn action_sequence(frame_count: usize) -> Vec<ShotBeat> {
    let beats = vec![
        (
            ShotKind::Wide,
            "wide action establishing shot, full environment visible",
            "motion beginning, subjects entering frame",
        ),
        (
            ShotKind::Tracking,
            "tracking shot following subject movement",
            "dynamic forward movement, action continuity",
        ),
        (
            ShotKind::Tracking,
            "tracking shot closer to subject",
            "speed increasing, stronger action motion",
        ),
        (
            ShotKind::Medium,
            "medium dynamic shot, readable action posture",
            "peak action moment",
        ),
        (
            ShotKind::CloseUp,
            "close-up action detail shot, emotional tension",
            "impact moment, strongest motion emphasis",
        ),
    ];

    trim_or_repeat(beats, frame_count)
}

fn emotional_sequence(frame_count: usize) -> Vec<ShotBeat> {
    let beats = vec![
        (
            ShotKind::Wide,
            "wide emotional establishing shot, both characters visible",
            "stillness before emotional movement",
        ),
        (
            ShotKind::Medium,
            "medium two-shot, clear body language",
            "subtle emotional movement",
        ),
        (
            ShotKind::PushIn,
            "slow push-in shot toward both characters",
            "emotional tension rising",
        ),
        (
            ShotKind::CloseUp,
            "close-up on faces, eye contact emphasized",
            "peak emotional moment",
        ),
        (
            ShotKind::CloseUp,
            "close-up with dramatic intimacy",
            "holding the emotional climax",
        ),
    ];

    trim_or_repeat(beats, frame_count)
}

fn epic_sequence(frame_count: usize) -> Vec<ShotBeat> {
    let beats = vec![
        (
            ShotKind::Wide,
            "grand wide shot, large scale environment visible",
            "environment reveal",
        ),
        (
            ShotKind::Wide,
            "wide shot with stronger subject emphasis",
            "subjects moving inside large environment",
        ),
        (
            ShotKind::Medium,
            "medium shot, subject and environment balance",
            "narrative advancing",
        ),
        (
            ShotKind::PushIn,
            "slow push-in to emphasize heroic scale",
            "dramatic escalation",
        ),
        (
            ShotKind::CloseUp,
            "close-up hero detail shot",
            "final emotional emphasis",
        ),
    ];

    trim_or_repeat(beats, frame_count)
}

fn default_sequence(frame_count: usize) -> Vec<ShotBeat> {
    let beats = vec![
        (
            ShotKind::Wide,
            "wide shot, clear environment",
            "beginning motion",
        ),
        (
            ShotKind::Medium,
            "medium shot, readable posture",
            "continuing motion",
        ),
        (
            ShotKind::PushIn,
            "slow push-in, cinematic emphasis",
            "building motion",
        ),
        (ShotKind::CloseUp, "close-up detail shot", "peak emphasis"),
    ];

    trim_or_repeat(beats, frame_count)
}

fn trim_or_repeat(
    beats: Vec<(ShotKind, &'static str, &'static str)>,
    frame_count: usize,
) -> Vec<ShotBeat> {
    let mut out = Vec::new();
    for index in 0..frame_count {
        let item = &beats[index.min(beats.len() - 1)];
        out.push(ShotBeat {
            index,
            shot: item.0.clone(),
            camera_prompt: item.1.to_string(),
            motion_prompt: item.2.to_string(),
        });
    }
    out
}
