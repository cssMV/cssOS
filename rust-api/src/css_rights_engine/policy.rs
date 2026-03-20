use crate::css_rights_engine::types::{
    RightsDecision, RightsDecisionResult, RightsGrant, RightsGrantKind, RightsTarget, RightsUnit,
    RightsWorkStructure,
};

pub fn allow_listen_split(target: &RightsTarget) -> bool {
    matches!(
        target.unit,
        RightsUnit::WholeWork
            | RightsUnit::Part
            | RightsUnit::Act
            | RightsUnit::Scene
            | RightsUnit::VersionBundle
    )
}

pub fn allow_buyout_target(target: &RightsTarget) -> RightsDecisionResult {
    match target.work_structure {
        RightsWorkStructure::Single => {
            if matches!(
                target.unit,
                RightsUnit::WholeWork | RightsUnit::VersionBundle
            ) {
                RightsDecisionResult {
                    decision: RightsDecision::Allow,
                    code: "buyout_allowed".into(),
                    message: "单体作品允许整体买断。".into(),
                }
            } else {
                RightsDecisionResult {
                    decision: RightsDecision::Deny,
                    code: "single_partial_buyout_denied".into(),
                    message: "单体作品不允许按局部单元买断。".into(),
                }
            }
        }
        RightsWorkStructure::Trilogy => {
            if matches!(
                target.unit,
                RightsUnit::WholeWork | RightsUnit::VersionBundle
            ) {
                RightsDecisionResult {
                    decision: RightsDecision::Allow,
                    code: "trilogy_bundle_buyout_allowed".into(),
                    message: "三部曲仅允许整体买断，可按语言版本整体买断。".into(),
                }
            } else {
                RightsDecisionResult {
                    decision: RightsDecision::Deny,
                    code: "trilogy_partial_buyout_denied".into(),
                    message: "三部曲不允许只买断其中一部。".into(),
                }
            }
        }
        RightsWorkStructure::Opera => {
            if matches!(
                target.unit,
                RightsUnit::WholeWork | RightsUnit::VersionBundle
            ) {
                RightsDecisionResult {
                    decision: RightsDecision::Allow,
                    code: "opera_whole_buyout_allowed".into(),
                    message: "歌剧仅允许整体买断，可按语言版本整体买断。".into(),
                }
            } else {
                RightsDecisionResult {
                    decision: RightsDecision::Deny,
                    code: "opera_partial_buyout_denied".into(),
                    message: "歌剧不允许只买断某一 Act / Scene。".into(),
                }
            }
        }
        RightsWorkStructure::Anthology | RightsWorkStructure::Series => {
            if matches!(
                target.unit,
                RightsUnit::WholeWork | RightsUnit::VersionBundle
            ) {
                RightsDecisionResult {
                    decision: RightsDecision::Allow,
                    code: "bundle_buyout_allowed".into(),
                    message: "该作品形态当前仅允许整体买断。".into(),
                }
            } else {
                RightsDecisionResult {
                    decision: RightsDecision::Deny,
                    code: "partial_buyout_denied".into(),
                    message: "该作品形态当前不允许局部买断。".into(),
                }
            }
        }
    }
}

pub fn evaluate_rights_grant(grant: &RightsGrant) -> RightsDecisionResult {
    match grant.kind {
        RightsGrantKind::Listen | RightsGrantKind::Preview | RightsGrantKind::Stream => {
            if allow_listen_split(&grant.target) {
                RightsDecisionResult {
                    decision: RightsDecision::Allow,
                    code: "consumption_split_allowed".into(),
                    message: "消费型权益允许按细粒度单元拆分。".into(),
                }
            } else {
                RightsDecisionResult {
                    decision: RightsDecision::Deny,
                    code: "consumption_split_denied".into(),
                    message: "该消费型权益当前不允许拆分。".into(),
                }
            }
        }
        RightsGrantKind::Purchase | RightsGrantKind::Buyout | RightsGrantKind::License => {
            allow_buyout_target(&grant.target)
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::css_rights_engine::policy::evaluate_rights_grant;
    use crate::css_rights_engine::types::{
        RightsDecision, RightsGrant, RightsGrantKind, RightsTarget, RightsUnit, RightsWorkStructure,
    };

    #[test]
    fn v154_trilogy_partial_buyout_is_denied() {
        let decision = evaluate_rights_grant(&RightsGrant {
            grant_id: "buyout_trilogy_part_1".into(),
            kind: RightsGrantKind::Buyout,
            target: RightsTarget {
                work_structure: RightsWorkStructure::Trilogy,
                unit: RightsUnit::Part,
                unit_id: Some("trilogy_part_1".into()),
                lang: Some("ja".into()),
            },
        });

        assert_eq!(decision.decision, RightsDecision::Deny);
        assert_eq!(decision.code, "trilogy_partial_buyout_denied");
    }

    #[test]
    fn v154_opera_whole_language_buyout_is_allowed() {
        let decision = evaluate_rights_grant(&RightsGrant {
            grant_id: "buyout_opera_ja".into(),
            kind: RightsGrantKind::Buyout,
            target: RightsTarget {
                work_structure: RightsWorkStructure::Opera,
                unit: RightsUnit::WholeWork,
                unit_id: None,
                lang: Some("ja".into()),
            },
        });

        assert_eq!(decision.decision, RightsDecision::Allow);
        assert_eq!(decision.code, "opera_whole_buyout_allowed");
    }

    #[test]
    fn v154_scene_listen_is_allowed() {
        let decision = evaluate_rights_grant(&RightsGrant {
            grant_id: "listen_scene_3".into(),
            kind: RightsGrantKind::Listen,
            target: RightsTarget {
                work_structure: RightsWorkStructure::Opera,
                unit: RightsUnit::Scene,
                unit_id: Some("scene_3".into()),
                lang: Some("ja".into()),
            },
        });

        assert_eq!(decision.decision, RightsDecision::Allow);
        assert_eq!(decision.code, "consumption_split_allowed");
    }
}
