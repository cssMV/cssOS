use crate::immersion_engine::policy::{
    allow_free_movement, allow_story_influence, characters_can_notice_viewer,
    preserve_director_focus,
};
use crate::immersion_engine::state::ImmersionState;
use crate::immersion_engine::types::{ImmersionMode, PresenceAnchor};
use crate::immersion_engine::zones::{active_zones, ImmersionZone, ImmersionZoneKind};
use crate::physics_engine::types::Vec3;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct ImmersionSnapshot {
    pub preserve_director_focus: bool,
    pub allow_free_movement: bool,
    pub allow_story_influence: bool,
    pub characters_can_notice_viewer: bool,
    #[serde(default)]
    pub active_zone_ids: Vec<String>,
    #[serde(default)]
    pub active_zone_kinds: Vec<ImmersionZoneKind>,
    pub in_focus_zone: bool,
    pub in_trigger_zone: bool,
    pub in_restricted_zone: bool,
}

#[derive(Debug, Clone)]
pub struct ImmersionEngine {
    pub state: ImmersionState,
    pub zones: Vec<ImmersionZone>,
}

impl ImmersionEngine {
    pub fn new(state: ImmersionState, zones: Vec<ImmersionZone>) -> Self {
        Self { state, zones }
    }

    pub fn set_anchor(&mut self, anchor: PresenceAnchor) {
        self.state.anchor = anchor;
    }

    pub fn set_mode(&mut self, mode: ImmersionMode) {
        self.state.mode = mode;
    }

    pub fn active_zones_at(&self, pos: Vec3) -> Vec<&ImmersionZone> {
        active_zones(&self.zones, pos)
    }

    pub fn snapshot_at(&self, pos: Vec3) -> ImmersionSnapshot {
        let active = self.active_zones_at(pos);
        let active_zone_ids = active
            .iter()
            .map(|zone| zone.id.clone())
            .collect::<Vec<_>>();
        let active_zone_kinds = active
            .iter()
            .map(|zone| zone.kind.clone())
            .collect::<Vec<_>>();

        ImmersionSnapshot {
            preserve_director_focus: preserve_director_focus(&self.state),
            allow_free_movement: allow_free_movement(&self.state),
            allow_story_influence: allow_story_influence(&self.state),
            characters_can_notice_viewer: characters_can_notice_viewer(&self.state),
            in_focus_zone: active
                .iter()
                .any(|zone| matches!(zone.kind, ImmersionZoneKind::FocusZone)),
            in_trigger_zone: active
                .iter()
                .any(|zone| matches!(zone.kind, ImmersionZoneKind::TriggerZone)),
            in_restricted_zone: active
                .iter()
                .any(|zone| matches!(zone.kind, ImmersionZoneKind::RestrictedZone)),
            active_zone_ids,
            active_zone_kinds,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::ImmersionEngine;
    use crate::immersion_engine::policy::{
        allow_free_movement, characters_can_notice_viewer, preserve_director_focus,
    };
    use crate::immersion_engine::state::ImmersionState;
    use crate::immersion_engine::types::{ImmersionConstraintLevel, ImmersionMode, PresenceRole};
    use crate::immersion_engine::zones::{ImmersionZone, ImmersionZoneKind};
    use crate::physics_engine::types::Vec3;

    #[test]
    fn v139_guided_spatial_observer_keeps_director_focus() {
        let state = ImmersionState {
            mode: ImmersionMode::SpatialObserver,
            presence_role: PresenceRole::Witness,
            constraint_level: ImmersionConstraintLevel::Guided,
            can_move_freely: true,
            ..ImmersionState::default()
        };

        assert!(!allow_free_movement(&state));
        assert!(preserve_director_focus(&state));
        assert!(characters_can_notice_viewer(&state));
    }

    #[test]
    fn v139_trigger_zone_is_detected_by_runtime() {
        let zone = ImmersionZone {
            id: "focus_zone_confession".into(),
            kind: ImmersionZoneKind::TriggerZone,
            center: Vec3::new(0.0, 0.0, 0.0),
            radius: 2.0,
            scene_id: Some("rooftop_confession".into()),
        };
        let engine = ImmersionEngine::new(ImmersionState::default(), vec![zone]);

        let active = engine.active_zones_at(Vec3::new(1.0, 1.0, 0.0));

        assert_eq!(active.len(), 1);
        assert_eq!(active[0].id, "focus_zone_confession");
        assert_eq!(active[0].kind, ImmersionZoneKind::TriggerZone);
    }
}
