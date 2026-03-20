use crate::physics_engine::queries::distance;
use crate::physics_engine::types::Vec3;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ImmersionZoneKind {
    ViewZone,
    TriggerZone,
    RestrictedZone,
    FocusZone,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ImmersionZone {
    pub id: String,
    pub kind: ImmersionZoneKind,
    pub center: Vec3,
    pub radius: f32,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scene_id: Option<String>,
}

pub fn zone_contains(zone: &ImmersionZone, pos: Vec3) -> bool {
    distance(zone.center, pos) <= zone.radius
}

pub fn active_zones(zones: &[ImmersionZone], pos: Vec3) -> Vec<&ImmersionZone> {
    zones
        .iter()
        .filter(|zone| zone_contains(zone, pos))
        .collect()
}
