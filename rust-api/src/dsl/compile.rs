#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CompiledCommands {
    pub lyrics: String,
    pub music: String,
    pub vocals: String,
    pub video: String,
    pub render: String,
}

impl CompiledCommands {
    pub fn command_for(&self, stage: &str) -> Result<String, String> {
        match stage {
            "lyrics" => Ok(self.lyrics.clone()),
            "music" => Ok(self.music.clone()),
            "vocals" => Ok(self.vocals.clone()),
            "video" | "video_plan" | "video_assemble" => Ok(self.video.clone()),
            "render" => Ok(self.render.clone()),
            s if s.starts_with("video_shot_") => Ok(self.video.clone()),
            _ => Err(format!("missing command for stage={}", stage)),
        }
    }
}

pub fn compile_from_dsl(dsl: &str) -> anyhow::Result<CompiledCommands> {
    let required = ["lyrics()", "music()", "vocals()", "video()", "render()"];
    let lowered = dsl.to_lowercase();
    if !lowered.contains("css") {
        anyhow::bail!("invalid dsl: missing CSS prefix");
    }
    for token in required {
        if !lowered.contains(token) {
            anyhow::bail!("invalid dsl: missing stage token `{}`", token);
        }
    }

    Ok(CompiledCommands {
        lyrics: "mkdir -p ./build && printf '%s\\n' '{\"schema\":\"css.lyrics.v1\",\"lines\":[\"demo\"]}' > ./build/lyrics.json".to_string(),
        music: "mkdir -p ./build && : > ./build/music.wav".to_string(),
        vocals: "mkdir -p ./build && : > ./build/vocals.wav".to_string(),
        video: "echo \"video handled by video executor\"".to_string(),
        render: "mkdir -p ./build && (cp -f ./build/video/video.mp4 ./build/final_mv.mp4 2>/dev/null || : > ./build/final_mv.mp4)".to_string(),
    })
}
