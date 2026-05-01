use std::fs;
use std::path::PathBuf;

use anyhow::{Context, Result};
use cssos_rust_api::video::openai_client::generate_image;
use cssos_rust_api::video::script_parser::script_to_prompt;

struct ProbeScene<'a> {
    slug: &'a str,
    script: &'a str,
}

fn main() -> Result<()> {
    let api_key = std::env::var("OPENAI_API_KEY")
        .context("set OPENAI_API_KEY before running westworld_render_probe")?;
    let output_dir = PathBuf::from("output/westworld_probe");
    fs::create_dir_all(&output_dir)?;

    let scenes = [
        ProbeScene {
            slug: "android_piano",
            script: "白色仿生人女性坐在钢琴前，面无表情，冷光，黑色背景",
        },
        ProbeScene {
            slug: "robotic_horse",
            script: "巨大的黑暗空间中，一匹机械马奔跑，聚光灯打在金属骨架上",
        },
        ProbeScene {
            slug: "android_assembly",
            script: "机械臂正在组装一名男性仿生人，白色合成材料逐渐覆盖骨架",
        },
    ];

    for (index, scene) in scenes.iter().enumerate() {
        let prompt = format!(
            "westworld-inspired sci-fi western opening frame, {}, high-end cinematic realism, dark contrast, no text, no watermark",
            script_to_prompt(scene.script)
        );
        let output_path = output_dir.join(format!("{:02}_{}.png", index, scene.slug));
        println!("rendering {}\n{}\n", scene.slug, prompt);
        generate_image(&api_key, &prompt, output_path.to_string_lossy().as_ref())?;
        println!("saved {}", output_path.display());
    }

    Ok(())
}
