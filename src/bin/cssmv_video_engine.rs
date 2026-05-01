use std::fs;
use std::path::PathBuf;

use anyhow::{Context, Result};
use cssmv_video_engine::video::{ProjectInput, build_video_project};

fn main() -> Result<()> {
    let mut args = std::env::args().skip(1);
    let input_path = args
        .next()
        .map(PathBuf::from)
        .context("usage: cssmv-video-engine <input.json> [--output-json path]")?;

    let mut output_json_path: Option<PathBuf> = None;
    while let Some(flag) = args.next() {
        if flag == "--output-json" {
            output_json_path = Some(
                args.next()
                    .map(PathBuf::from)
                    .context("--output-json requires a file path")?,
            );
        }
    }

    let raw = fs::read_to_string(&input_path)
        .with_context(|| format!("failed to read input json: {}", input_path.display()))?;
    let input: ProjectInput = serde_json::from_str(&raw)
        .with_context(|| format!("failed to parse input json: {}", input_path.display()))?;

    let result = build_video_project(input)?;
    let pretty = serde_json::to_string_pretty(&result)?;

    if let Some(path) = output_json_path {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .with_context(|| format!("failed to create parent dir: {}", parent.display()))?;
        }
        fs::write(&path, pretty.as_bytes())
            .with_context(|| format!("failed to write output json: {}", path.display()))?;
        eprintln!("wrote output json -> {}", path.display());
    } else {
        println!("{pretty}");
    }

    Ok(())
}
