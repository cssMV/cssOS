use crate::css_access_gate::types::{
    AccessAction, AccessDecision, AccessTarget, CssAccessDecision, CssAccessRequest,
};

pub fn global_preview_allowed(req: &CssAccessRequest) -> bool {
    matches!(req.action, AccessAction::Preview)
}

pub fn global_preview_seconds() -> u32 {
    crate::css_policy_engine::runtime::preview_seconds()
}

pub fn map_action_to_rights_kind(
    action: &AccessAction,
) -> crate::css_rights_engine::types::RightsGrantKind {
    match action {
        AccessAction::Preview => crate::css_rights_engine::types::RightsGrantKind::Preview,
        AccessAction::Listen => crate::css_rights_engine::types::RightsGrantKind::Listen,
        AccessAction::Stream => crate::css_rights_engine::types::RightsGrantKind::Stream,
        AccessAction::Download => crate::css_rights_engine::types::RightsGrantKind::Purchase,
        AccessAction::Buyout => crate::css_rights_engine::types::RightsGrantKind::Buyout,
    }
}

pub fn map_access_target(target: &AccessTarget) -> crate::css_rights_engine::types::RightsTarget {
    crate::css_rights_engine::types::RightsTarget {
        work_structure: target.work_structure.clone(),
        unit: target.unit.clone(),
        unit_id: target.unit_id.clone(),
        lang: target.lang.clone(),
    }
}

pub fn buyout_disabled_by_priceless(is_priceless: bool, req: &CssAccessRequest) -> bool {
    is_priceless && matches!(req.action, AccessAction::Buyout)
}

/// Platform axiom:
/// Legally issued consumption entitlements (listen / preview / stream) remain valid
/// even if ownership or copyright changes later. Ownership transfer affects future
/// control of the work, but does not retroactively revoke historical access rights.
pub fn ownership_transfer_preserves_entitlements() -> bool {
    true
}

pub fn evaluate_access(
    entitlement_result: &crate::css_entitlement::types::EntitlementAccessResult,
    req: &CssAccessRequest,
    is_priceless: bool,
) -> CssAccessDecision {
    if buyout_disabled_by_priceless(is_priceless, req) {
        return CssAccessDecision {
            decision: AccessDecision::Deny,
            code: "buyout_disabled_priceless".into(),
            message: "该作品已被作者设为无价之宝，不允许买断。".into(),
            preview_seconds: None,
        };
    }

    if entitlement_result.allowed {
        return CssAccessDecision {
            decision: AccessDecision::Allow,
            code: "entitlement_ok".into(),
            message: "用户已持有对应访问权。".into(),
            preview_seconds: None,
        };
    }

    if global_preview_allowed(req) {
        return CssAccessDecision {
            decision: AccessDecision::AllowPreviewOnly,
            code: "global_preview_allowed".into(),
            message: "所有作品均允许免费预览 30 秒。".into(),
            preview_seconds: Some(global_preview_seconds()),
        };
    }

    CssAccessDecision {
        decision: AccessDecision::Deny,
        code: "access_denied_purchase_required".into(),
        message: "当前用户未持有对应权益，请先购买相应访问权。".into(),
        preview_seconds: None,
    }
}

#[cfg(test)]
mod tests {
    use crate::css_access_gate::policy::{
        evaluate_access, map_access_target, ownership_transfer_preserves_entitlements,
    };
    use crate::css_access_gate::types::{
        AccessAction, AccessDecision, AccessTarget, CssAccessRequest,
    };
    use crate::css_entitlement::types::EntitlementAccessResult;
    use crate::css_rights_engine::types::{RightsUnit, RightsWorkStructure};

    fn scene_request(action: AccessAction) -> CssAccessRequest {
        CssAccessRequest {
            user_id: "user_b".into(),
            action,
            target: AccessTarget {
                work_structure: RightsWorkStructure::Opera,
                unit: RightsUnit::Scene,
                unit_id: Some("scene_3".into()),
                lang: Some("ja".into()),
            },
        }
    }

    #[test]
    fn v156_preview_fallback_is_globally_allowed_for_30_seconds() {
        let decision = evaluate_access(
            &EntitlementAccessResult {
                allowed: false,
                code: "entitlement_not_found".into(),
                message: "missing".into(),
            },
            &scene_request(AccessAction::Preview),
            false,
        );

        assert_eq!(decision.decision, AccessDecision::AllowPreviewOnly);
        assert_eq!(decision.preview_seconds, Some(30));
    }

    #[test]
    fn v156_existing_entitlement_prevents_repeat_payment_flow() {
        let decision = evaluate_access(
            &EntitlementAccessResult {
                allowed: true,
                code: "entitlement_ok".into(),
                message: "owned".into(),
            },
            &scene_request(AccessAction::Listen),
            false,
        );

        assert_eq!(decision.decision, AccessDecision::Allow);
        assert_eq!(decision.code, "entitlement_ok");
    }

    #[test]
    fn v156_priceless_blocks_buyout_but_not_access_axiom() {
        let decision = evaluate_access(
            &EntitlementAccessResult {
                allowed: false,
                code: "entitlement_not_found".into(),
                message: "missing".into(),
            },
            &scene_request(AccessAction::Buyout),
            true,
        );

        assert_eq!(decision.decision, AccessDecision::Deny);
        assert_eq!(decision.code, "buyout_disabled_priceless");
        assert!(ownership_transfer_preserves_entitlements());
    }

    #[test]
    fn v156_access_target_maps_cleanly_to_rights_target() {
        let mapped = map_access_target(&scene_request(AccessAction::Listen).target);
        assert_eq!(mapped.work_structure, RightsWorkStructure::Opera);
        assert_eq!(mapped.unit, RightsUnit::Scene);
        assert_eq!(mapped.unit_id.as_deref(), Some("scene_3"));
        assert_eq!(mapped.lang.as_deref(), Some("ja"));
    }
}
