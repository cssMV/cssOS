use crate::data_pipeline::schema::ManifestRecord;
use crate::training::stage::CurriculumStage;

pub fn sample_by_stage(data: &[ManifestRecord], stage: &CurriculumStage) -> Vec<ManifestRecord> {
    data.iter()
        .filter(|record| {
            let duration = record.clip.end_sec - record.clip.start_sec;
            let object_count = record.caption.characters.len();
            let complexity = record.caption.environment.len();
            let motion_score = record.caption.actions.len() as f32;

            duration >= stage.min_duration
                && duration <= stage.max_duration
                && object_count <= stage.max_objects
                && complexity <= stage.max_scene_complexity
                && motion_score <= stage.max_motion
        })
        .cloned()
        .collect()
}
