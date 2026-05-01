use std::fs;

use anyhow::Result;

pub fn ensure_dirs() -> Result<()> {
    for dir in [
        "data/raw",
        "data/clips",
        "data/manifests",
        "data/shards",
        "data/tmp",
    ] {
        fs::create_dir_all(dir)?;
    }
    Ok(())
}
