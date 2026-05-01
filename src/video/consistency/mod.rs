mod character;
mod quality;
mod scorer;
mod shot;
mod style;
mod timeline;

pub use character::{
    CharacterContinuityMemory, build_character_profiles, build_scene_continuity_memory,
};
pub use quality::resolve_scene_quality;
pub use scorer::score_continuity;
pub use shot::plan_shots;
pub use style::normalize_style;
pub use timeline::build_arc_timeline;

pub use crate::video::contracts::{
    ArcTimelineBeat, CharacterProfile, ContinuityScore, NormalizedStyleProfile, ShotPlan,
};
