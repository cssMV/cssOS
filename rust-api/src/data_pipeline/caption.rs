use anyhow::Result;

use crate::data_pipeline::schema::{CaptionRecord, ClipRecord};

fn simple_extract(text: &str, keywords: &[(&str, &str)]) -> Vec<String> {
    let lower = text.to_lowercase();
    let mut out = Vec::new();
    for (src, norm) in keywords {
        if lower.contains(src) {
            out.push((*norm).to_string());
        }
    }
    out
}

pub fn auto_caption_from_filename(clip: &ClipRecord) -> Result<CaptionRecord> {
    let src = clip.clip_id.to_lowercase();

    let characters = simple_extract(
        &src,
        &[
            ("man", "male"),
            ("woman", "female"),
            ("knight", "knight"),
            ("android", "android"),
            ("horse", "horse_rider"),
        ],
    );

    let actions = simple_extract(
        &src,
        &[
            ("run", "running"),
            ("walk", "walking"),
            ("ride", "riding"),
            ("talk", "talking"),
            ("fight", "fighting"),
        ],
    );

    let environment = simple_extract(
        &src,
        &[
            ("battle", "battlefield"),
            ("city", "city"),
            ("room", "room"),
            ("street", "street"),
            ("forest", "forest"),
            ("castle", "castle"),
        ],
    );

    Ok(CaptionRecord {
        clip_id: clip.clip_id.clone(),
        summary: format!("video clip {}", clip.clip_id),
        characters,
        actions,
        environment,
        emotion: None,
    })
}
