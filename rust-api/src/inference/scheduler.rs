pub struct InferenceConfig {
    pub steps: usize,
    pub resolution: usize,
}

pub fn select_config(realtime: bool) -> InferenceConfig {
    if realtime {
        InferenceConfig {
            steps: 10,
            resolution: 128,
        }
    } else {
        InferenceConfig {
            steps: 40,
            resolution: 256,
        }
    }
}
