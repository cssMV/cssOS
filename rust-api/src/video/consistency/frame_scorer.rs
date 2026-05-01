use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Default)]
pub struct FrameScore {
    pub exists_score: f32,
    pub size_score: f32,
    pub keyword_score: f32,
    pub overall: f32,
}

pub fn score_frame(path: &str, expected_keywords: &[&str]) -> FrameScore {
    let path_ref = Path::new(path);
    if !path_ref.exists() {
        return FrameScore::default();
    }

    let mut result = FrameScore {
        exists_score: 0.2,
        ..FrameScore::default()
    };

    if let Ok(meta) = fs::metadata(path_ref) {
        result.size_score = match meta.len() {
            0..=20_000 => 0.05,
            20_001..=50_000 => 0.15,
            50_001..=120_000 => 0.25,
            _ => 0.30,
        };
    }

    let haystack = path_ref
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.to_ascii_lowercase())
        .unwrap_or_default();
    let keyword_hits = expected_keywords
        .iter()
        .filter(|kw| haystack.contains(&kw.to_ascii_lowercase()))
        .count();
    if !expected_keywords.is_empty() {
        result.keyword_score =
            (keyword_hits as f32 / expected_keywords.len() as f32).clamp(0.0, 1.0) * 0.5;
    }

    result.overall =
        (result.exists_score + result.size_score + result.keyword_score).clamp(0.0, 1.0);
    result
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::score_frame;

    #[test]
    fn missing_frame_scores_zero() {
        let score = score_frame("/tmp/this-frame-should-not-exist.png", &["character"]);
        assert_eq!(score.overall, 0.0);
    }

    #[test]
    fn existing_frame_scores_positive() {
        let path = format!("/tmp/frame-score-{}.png", std::process::id());
        fs::write(&path, vec![1_u8; 60_000]).expect("write temp image");
        let score = score_frame(&path, &[]);
        assert!(score.overall > 0.2);
        let _ = fs::remove_file(path);
    }
}
