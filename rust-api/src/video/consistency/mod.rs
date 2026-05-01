mod character;
mod frame_retry;
mod frame_scorer;
mod scorer;
mod shot;
mod style;
mod types;

pub use character::build_character_profiles;
pub use frame_retry::generate_best_frame;
pub use frame_scorer::{score_frame, FrameScore};
pub use scorer::score_continuity;
pub use shot::plan_shots;
pub use style::normalize_style;
pub use types::{CharacterProfile, ContinuityScore, ShotPlan, ShotType, StyleProfile};
