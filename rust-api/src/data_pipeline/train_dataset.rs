use std::fs::File;
use std::io::{BufRead, BufReader};

use anyhow::Result;
use tch::{Device, Kind, Tensor};

use crate::data_pipeline::schema::ManifestRecord;

pub fn load_all_manifest(manifest_path: &str) -> Result<Vec<ManifestRecord>> {
    let file = File::open(manifest_path)?;
    let reader = BufReader::new(file);
    let mut records = Vec::new();

    for line in reader.lines() {
        records.push(serde_json::from_str(&line?)?);
    }

    Ok(records)
}

pub fn load_batch_from_records(records: &[ManifestRecord]) -> Result<Tensor> {
    let batch_size = records.len().max(1) as i64;
    let batch = Tensor::rand(&[batch_size, 3, 16, 128, 128], (Kind::Float, Device::Cpu));

    Ok(batch)
}

pub fn load_training_batch_from_manifest(manifest_path: &str, batch_size: usize) -> Result<Tensor> {
    let file = File::open(manifest_path)?;
    let reader = BufReader::new(file);
    let mut records = Vec::new();

    for line in reader.lines() {
        records.push(serde_json::from_str::<ManifestRecord>(&line?)?);
        if records.len() >= batch_size {
            break;
        }
    }

    load_batch_from_records(&records)
}
