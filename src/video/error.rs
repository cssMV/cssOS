use std::path::PathBuf;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum VideoEngineError {
    #[error("ffmpeg binary was not found in PATH")]
    FfmpegUnavailable,
    #[error("ffprobe binary was not found in PATH")]
    FfprobeUnavailable,
    #[error("invalid thumbnail duration {requested_secs:.2}s; expected 3.0-5.0s")]
    InvalidThumbnailDuration { requested_secs: f32 },
    #[error("scene {scene_id} has invalid duration {duration_secs:.3}s")]
    InvalidSceneDuration {
        scene_id: String,
        duration_secs: f32,
    },
    #[error("project contains no scenes")]
    EmptyScenes,
    #[error("music audio path does not exist: {path}")]
    MissingAudioPath { path: String },
    #[error(
        "audio duration mismatch; expected {expected_secs:.3}s but actual file is {actual_secs:.3}s"
    )]
    AudioDurationMismatch {
        expected_secs: f32,
        actual_secs: f32,
    },
    #[error(
        "scene total duration mismatch; expected {expected_secs:.3}s but scenes sum to {actual_secs:.3}s"
    )]
    SceneDurationMismatch {
        expected_secs: f32,
        actual_secs: f32,
    },
    #[error("ffmpeg command failed for {step}: {message}")]
    FfmpegCommandFailed { step: String, message: String },
    #[error("expected playable media output was not created: {path}")]
    MissingOutputPath { path: PathBuf },
    #[error("generated media is too small to be considered valid: {path}")]
    OutputTooSmall { path: PathBuf },
}
