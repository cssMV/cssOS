#[derive(Debug, Clone)]
pub enum ShotType {
    CloseUp,
    Medium,
    Wide,
    Tracking,
    PushIn,
}

#[derive(Debug, Clone)]
pub struct CameraPlan {
    pub shot: ShotType,
    pub camera_prompt: String,
}

pub fn build_camera_plan(script: &str, section_type: Option<&str>) -> CameraPlan {
    let s = script.to_lowercase();

    if s.contains("特写") || s.contains("close-up") || s.contains("面部") {
        return CameraPlan {
            shot: ShotType::CloseUp,
            camera_prompt: "close-up shot, face-focused framing, shallow depth of field"
                .to_string(),
        };
    }
    if s.contains("远景") || s.contains("战场") || s.contains("城墙") || s.contains("wide") {
        return CameraPlan {
            shot: ShotType::Wide,
            camera_prompt: "wide shot, full environment visible, cinematic scale".to_string(),
        };
    }
    if s.contains("追逐") || s.contains("奔跑") || s.contains("骑马") {
        return CameraPlan {
            shot: ShotType::Tracking,
            camera_prompt: "tracking shot, dynamic forward camera motion, action continuity"
                .to_string(),
        };
    }
    if s.contains("靠近") || s.contains("推近") || s.contains("凝视") {
        return CameraPlan {
            shot: ShotType::PushIn,
            camera_prompt: "slow push-in camera move, emotional cinematic framing".to_string(),
        };
    }

    match section_type.unwrap_or("verse") {
        "chorus" => CameraPlan {
            shot: ShotType::PushIn,
            camera_prompt: "dramatic medium shot with slow push-in, emotional emphasis".to_string(),
        },
        "intro" => CameraPlan {
            shot: ShotType::Wide,
            camera_prompt: "wide establishing shot, cinematic environment reveal".to_string(),
        },
        _ => CameraPlan {
            shot: ShotType::Medium,
            camera_prompt: "medium shot, readable character posture, balanced framing".to_string(),
        },
    }
}
