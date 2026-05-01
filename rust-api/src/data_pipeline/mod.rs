pub mod caption;
pub mod consistency_score;
pub mod decode;
pub mod filter;
pub mod ingest;
pub mod metadata;
pub mod motion_score;
pub mod quality;
pub mod schema;
pub mod segment;
pub mod semantic_label;
pub mod shard;
pub mod train_dataset;
pub mod writer;

use anyhow::Result;

use crate::data_pipeline::schema::{CaptionRecord, ManifestRecord};

pub fn run_data_pipeline(input_dir: &str) -> Result<()> {
    writer::ensure_dirs()?;

    let videos = ingest::scan_local_video_dir(input_dir)?;
    let mut manifests = Vec::new();

    for video in videos {
        let probe = decode::ffprobe_video(&video.local_path)?;
        let clips = segment::segment_video_fixed(&video, &probe, 4.0, "data/clips")?;

        for clip in clips {
            let filter_res = filter::filter_clip_basic(&clip)?;
            if !filter_res.accepted {
                continue;
            }

            if !quality::is_valid_clip(&clip.clip_path)? {
                continue;
            }

            if !consistency_score::is_temporally_stable(&clip.clip_path)? {
                continue;
            }

            let motion_score = motion_score::compute_motion_score(&clip.clip_path)?;
            if motion_score < 100.0 {
                continue;
            }

            let fallback_caption = caption::auto_caption_from_filename(&clip)?;
            let semantic = semantic_label::build_semantic_labels(&clip.clip_path)?;
            let caption = CaptionRecord {
                clip_id: clip.clip_id.clone(),
                summary: format!(
                    "scene {} camera={} motion_score={:.1}",
                    clip.clip_id, semantic.camera_type, motion_score
                ),
                characters: fallback_caption.characters,
                actions: if semantic.motion_type == "unknown" {
                    fallback_caption.actions
                } else {
                    vec![semantic.motion_type]
                },
                environment: if semantic.scene_type == "unknown" {
                    fallback_caption.environment
                } else {
                    vec![semantic.scene_type]
                },
                emotion: Some(semantic.emotion),
            };
            manifests.push(ManifestRecord { clip, caption });
        }
    }

    metadata::write_manifest_jsonl("data/manifests/train.jsonl", &manifests)?;
    shard::shard_jsonl("data/manifests/train.jsonl", "data/shards", 1000)?;

    Ok(())
}
