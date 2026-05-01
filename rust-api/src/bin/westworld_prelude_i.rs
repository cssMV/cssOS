use std::fs;
use std::path::PathBuf;

use anyhow::{Context, Result};
use cssos_rust_api::video::openai_client::generate_image;
use cssos_rust_api::video::script_parser::script_to_prompt;

struct ProbeScene<'a> {
    slug: &'a str,
    script: &'a str,
    prompt_override: Option<&'a str>,
}

fn main() -> Result<()> {
    let api_key = std::env::var("OPENAI_API_KEY")
        .context("set OPENAI_API_KEY before running westworld_prelude_i")?;
    let output_dir = PathBuf::from("output/westworld_prelude_i");
    fs::create_dir_all(&output_dir)?;

    let scenes = [
        ProbeScene {
            slug: "01_android_piano",
            script: "白色仿生人女性独自坐在钢琴前，面无表情，冷光，黑色背景，无帽子",
            prompt_override: None,
        },
        ProbeScene {
            slug: "02_robotic_horse",
            script: "巨大的黑暗空间中，独自一匹机械马奔跑，聚光灯打在金属骨架上，没有骑手",
            prompt_override: None,
        },
        ProbeScene {
            slug: "03_android_assembly",
            script: "机械臂正在装配一名男性仿生体，白色装甲合成外壳逐渐覆盖机械骨架，临床工业装配空间，非情色，无裸露",
            prompt_override: Some(
                "CLEARLY SHOW one male android in a clinical industrial assembly bay, robotic assembly arms attaching white armored shell panels over a metallic humanoid frame, industrial manufacturing process, non-sexual industrial scene, no exposed flesh, no nudity, no gore, high-end cinematic realism, premium film still, dark contrast, no text, no watermark",
            ),
        },
        ProbeScene {
            slug: "04_female_android_closeup",
            script: "白色女性仿生人特写，冷静注视前方，冷光照亮面部，黑色背景，无帽子，非情色",
            prompt_override: Some(
                "CLEARLY SHOW one female android close-up portrait, white synthetic face, calm expression, cold light across the face, black background, no hat, no cowboy hat, no extra people, non-sexual scene, no nudity, high-end cinematic realism, premium film still, dark contrast, no text, no watermark",
            ),
        },
    ];

    for scene in scenes {
        let prompt = scene.prompt_override.map(ToString::to_string).unwrap_or_else(|| {
            format!(
                "westworld-inspired sci-fi opera prelude frame, {}, high-end cinematic realism, premium film still, dark contrast, industrial sci-fi, non-sexual scene, no nudity, no text, no watermark",
                script_to_prompt(scene.script)
            )
        });
        let output_path = output_dir.join(format!("{}.png", scene.slug));
        println!("rendering {}\n{}\n", scene.slug, prompt);
        generate_image(&api_key, &prompt, output_path.to_string_lossy().as_ref())?;
        println!("saved {}", output_path.display());
    }

    Ok(())
}
