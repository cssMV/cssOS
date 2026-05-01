use std::fs::File;
use std::io::Write;

use anyhow::Result;

use crate::data_pipeline::schema::ManifestRecord;

pub fn write_manifest_jsonl(path: &str, records: &[ManifestRecord]) -> Result<()> {
    let mut file = File::create(path)?;

    for record in records {
        let line = serde_json::to_string(record)?;
        writeln!(file, "{line}")?;
    }

    Ok(())
}
