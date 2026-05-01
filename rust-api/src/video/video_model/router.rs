use super::types::VideoModelProvider;

pub fn selected_provider() -> VideoModelProvider {
    let raw =
        std::env::var("CSS_VIDEO_MODEL_PROVIDER").unwrap_or_else(|_| "self_hosted".to_string());
    VideoModelProvider::from_env_value(&raw)
}

pub fn uses_self_hosted_default() -> bool {
    matches!(selected_provider(), VideoModelProvider::SelfHosted)
}

pub fn unsupported_provider_reason() -> Option<String> {
    match selected_provider() {
        VideoModelProvider::SelfHosted => None,
        provider => Some(format!(
            "video model provider '{}' is reserved for future optional integration; default self-hosted cssMV renderer remains active",
            provider.as_str()
        )),
    }
}
