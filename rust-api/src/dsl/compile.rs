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

fn silence_wav_cmd(duration_s: f64, out: &str) -> String {
    let d = if duration_s.is_finite() && duration_s > 0.2 {
        duration_s
    } else {
        8.0
    };
    format!(
        "mkdir -p ./build && ffmpeg -y -hide_banner -loglevel error -f lavfi -i anullsrc=r=44100:cl=stereo -t {} -c:a pcm_s16le {}",
        d, out
    )
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
        music: silence_wav_cmd(8.0, "./build/music.wav"),
        vocals: silence_wav_cmd(8.0, "./build/vocals.wav"),
        video: "echo \"video handled by video executor\"".to_string(),
        render: "mkdir -p ./build && (cp -f ./build/video/video.mp4 ./build/final_mv.mp4 2>/dev/null || : > ./build/final_mv.mp4)".to_string(),
    })
}
