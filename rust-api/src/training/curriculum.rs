use crate::training::stage::CurriculumStage;

pub fn build_curriculum() -> Vec<CurriculumStage> {
    vec![
        CurriculumStage {
            name: "static_world".into(),
            max_motion: 0.1,
            max_objects: 1,
            max_scene_complexity: 1,
            min_duration: 2.0,
            max_duration: 4.0,
        },
        CurriculumStage {
            name: "single_motion".into(),
            max_motion: 0.5,
            max_objects: 1,
            max_scene_complexity: 2,
            min_duration: 2.0,
            max_duration: 6.0,
        },
        CurriculumStage {
            name: "multi_object".into(),
            max_motion: 1.0,
            max_objects: 3,
            max_scene_complexity: 3,
            min_duration: 3.0,
            max_duration: 8.0,
        },
        CurriculumStage {
            name: "complex_scene".into(),
            max_motion: 2.0,
            max_objects: 5,
            max_scene_complexity: 5,
            min_duration: 4.0,
            max_duration: 10.0,
        },
        CurriculumStage {
            name: "real_world".into(),
            max_motion: 10.0,
            max_objects: 999,
            max_scene_complexity: 999,
            min_duration: 4.0,
            max_duration: 16.0,
        },
    ]
}
