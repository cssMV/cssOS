use ndarray::ArrayD;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VideoModelProvider {
    SelfHosted,
    OpenAiVideo,
    Runway,
    Pika,
    Unknown,
}

impl VideoModelProvider {
    pub fn from_env_value(value: &str) -> Self {
        match value.trim().to_ascii_lowercase().as_str() {
            "" | "self" | "self_hosted" | "cssmv" | "native" => Self::SelfHosted,
            "openai_video" | "sora" | "openai" => Self::OpenAiVideo,
            "runway" => Self::Runway,
            "pika" => Self::Pika,
            _ => Self::Unknown,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::SelfHosted => "self_hosted",
            Self::OpenAiVideo => "openai_video",
            Self::Runway => "runway",
            Self::Pika => "pika",
            Self::Unknown => "unknown",
        }
    }
}

#[derive(Debug, Clone)]
pub struct VideoCondition {
    pub prompt: String,
    pub duration: f32,
    pub fps: usize,
}

#[derive(Debug, Clone)]
pub struct LatentVideo {
    pub data: ArrayD<f32>,
}

#[derive(Debug, Clone)]
pub struct SpacetimeTokens {
    pub tokens: ArrayD<f32>,
}

pub struct VideoOutput {
    pub path: String,
}
