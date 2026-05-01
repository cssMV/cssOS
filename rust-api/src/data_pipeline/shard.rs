use std::fs::{self, File};
use std::io::{BufRead, BufReader, Write};

use anyhow::Result;

pub fn shard_jsonl(input_path: &str, output_dir: &str, shard_size: usize) -> Result<Vec<String>> {
    fs::create_dir_all(output_dir)?;

    let file = File::open(input_path)?;
    let reader = BufReader::new(file);

    let mut shard_paths = Vec::new();
    let mut current_idx = 0usize;
    let mut current_count = 0usize;
    let mut writer: Option<File> = None;

    for line in reader.lines() {
        if current_count % shard_size == 0 {
            let path = format!("{}/shard_{:05}.jsonl", output_dir, current_idx);
            writer = Some(File::create(&path)?);
            shard_paths.push(path);
            current_idx += 1;
        }

        if let Some(w) = writer.as_mut() {
            writeln!(w, "{}", line?)?;
        }

        current_count += 1;
    }

    Ok(shard_paths)
}
