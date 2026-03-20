#[derive(Debug, Clone)]
pub struct QualityGateConfig {
    pub min_audio_duration_s: f64,
    pub min_video_duration_s: f64,
    pub min_lyrics_nonempty_lines: usize,
    pub min_subtitle_dialogues: usize,
    pub min_mix_peak_db: f64,
    pub max_av_duration_delta_s: f64,
    pub max_subtitles_audio_delta_s: f64,
}

impl Default for QualityGateConfig {
    fn default() -> Self {
        Self {
            min_audio_duration_s: 2.0,
            min_video_duration_s: 1.0,
            min_lyrics_nonempty_lines: 2,
            min_subtitle_dialogues: 1,
            min_mix_peak_db: -50.0,
            max_av_duration_delta_s: 0.5,
            max_subtitles_audio_delta_s: 1.0,
        }
    }
}

pub fn load_quality_config() -> QualityGateConfig {
    let d = QualityGateConfig::default();
    QualityGateConfig {
        min_audio_duration_s: std::env::var("CSS_GATE_MIN_AUDIO_DURATION_S")
            .ok()
            .and_then(|x| x.parse().ok())
            .unwrap_or(d.min_audio_duration_s),
        min_video_duration_s: std::env::var("CSS_GATE_MIN_VIDEO_DURATION_S")
            .ok()
            .and_then(|x| x.parse().ok())
            .unwrap_or(d.min_video_duration_s),
        min_lyrics_nonempty_lines: std::env::var("CSS_GATE_MIN_LYRICS_NONEMPTY_LINES")
            .ok()
            .and_then(|x| x.parse().ok())
            .unwrap_or(d.min_lyrics_nonempty_lines),
        min_subtitle_dialogues: std::env::var("CSS_GATE_MIN_SUBTITLE_DIALOGUES")
            .ok()
            .and_then(|x| x.parse().ok())
            .unwrap_or(d.min_subtitle_dialogues),
        min_mix_peak_db: std::env::var("CSS_GATE_MIN_MIX_PEAK_DB")
            .ok()
            .and_then(|x| x.parse().ok())
            .unwrap_or(d.min_mix_peak_db),
        max_av_duration_delta_s: std::env::var("CSS_GATE_MAX_AV_DURATION_DELTA_S")
            .ok()
            .and_then(|x| x.parse().ok())
            .unwrap_or(d.max_av_duration_delta_s),
        max_subtitles_audio_delta_s: std::env::var("CSS_GATE_MAX_SUBTITLES_AUDIO_DELTA_S")
            .ok()
            .and_then(|x| x.parse().ok())
            .unwrap_or(d.max_subtitles_audio_delta_s),
    }
}
