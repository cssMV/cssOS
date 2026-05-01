use anyhow::{Context, Result};
use cssos_rust_api::engines::{
    finalize_audio_delivery_assets, master_mp3_path, mix, music, vocals, EngineCtx,
};
use serde_json::Value;
use std::path::PathBuf;

#[tokio::main]
async fn main() -> Result<()> {
    let run_dir = std::env::args()
        .nth(1)
        .map(PathBuf::from)
        .context("usage: cssmv_rerun_music <run_dir> [ui_lang]")?;
    let ui_lang = std::env::args().nth(2).unwrap_or_else(|| "zh".to_string());
    let commands_path = run_dir.join("compiled.commands.json");
    let raw = std::fs::read_to_string(&commands_path)
        .with_context(|| format!("read {}", commands_path.display()))?;
    let commands: Value =
        serde_json::from_str(&raw).with_context(|| format!("parse {}", commands_path.display()))?;
    let ctx = EngineCtx::new(run_dir.clone());
    music::run(&ctx, &commands, &ui_lang)
        .await
        .with_context(|| format!("rerunning music stage for {}", run_dir.display()))?;
    vocals::run(&ctx, &commands, &ui_lang)
        .await
        .with_context(|| format!("rerunning vocals stage for {}", run_dir.display()))?;
    mix::run(&ctx, &commands, &ui_lang)
        .await
        .with_context(|| format!("rerunning mix stage for {}", run_dir.display()))?;
    finalize_audio_delivery_assets(&ctx)
        .await
        .with_context(|| format!("finalizing audio assets for {}", run_dir.display()))?;
    println!("{}", master_mp3_path(&run_dir).display());
    Ok(())
}
