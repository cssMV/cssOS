#[derive(Debug, Clone)]
pub struct StyleProfile {
    pub name: String,
    pub color_grading: String,
    pub lighting: String,
    pub texture: String,
    pub camera: String,
}

pub fn build_style_profile(style_hint: Option<&str>) -> StyleProfile {
    match style_hint.unwrap_or("cinematic_dark") {
        "epic" => StyleProfile {
            name: "epic".into(),
            color_grading: "high contrast cinematic color grading, rich shadows".into(),
            lighting: "dramatic lighting, strong highlights and shadows".into(),
            texture: "film grain, detailed texture".into(),
            camera: "anamorphic lens, cinematic depth of field".into(),
        },
        "romantic" => StyleProfile {
            name: "romantic".into(),
            color_grading: "soft warm tones, pastel color grading".into(),
            lighting: "soft diffused lighting, gentle highlights".into(),
            texture: "smooth texture, soft focus".into(),
            camera: "shallow depth of field, soft lens".into(),
        },
        _ => StyleProfile {
            name: "cinematic_dark".into(),
            color_grading: "dark cinematic color grading, desaturated tones".into(),
            lighting: "low-key lighting, strong contrast".into(),
            texture: "film grain, sharp detail".into(),
            camera: "35mm lens, cinematic depth of field".into(),
        },
    }
}
