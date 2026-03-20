use crate::css_ownership_engine::types::{
    OwnershipRecord, OwnershipScope, OwnershipTransferDecision, OwnershipTransferDecisionResult,
};

pub fn ownership_scope_allowed(scope: &OwnershipScope) -> bool {
    use crate::css_rights_engine::types::RightsUnit;

    matches!(
        scope.unit,
        RightsUnit::WholeWork | RightsUnit::VersionBundle
    )
}

pub fn can_request_transfer(ownership: &OwnershipRecord) -> OwnershipTransferDecisionResult {
    if !ownership_scope_allowed(&ownership.scope) {
        return OwnershipTransferDecisionResult {
            decision: OwnershipTransferDecision::Deny,
            code: "ownership_scope_invalid".into(),
            message: "当前 ownership scope 不允许版权转让。".into(),
        };
    }

    if ownership.priceless {
        return OwnershipTransferDecisionResult {
            decision: OwnershipTransferDecision::Deny,
            code: "ownership_priceless".into(),
            message: "当前版权已被设置为无价之宝，不允许买断。".into(),
        };
    }

    if !ownership.resale_enabled {
        return OwnershipTransferDecisionResult {
            decision: OwnershipTransferDecision::Deny,
            code: "resale_not_enabled".into(),
            message: "当前版权拥有者尚未开放再次出售。".into(),
        };
    }

    if ownership.buyout_price_cents.is_none() || ownership.currency.is_none() {
        return OwnershipTransferDecisionResult {
            decision: OwnershipTransferDecision::Deny,
            code: "buyout_price_not_set".into(),
            message: "当前版权拥有者尚未设置买断价格，不能被强行买走。".into(),
        };
    }

    OwnershipTransferDecisionResult {
        decision: OwnershipTransferDecision::RequiresOwnerApproval,
        code: "owner_approval_required".into(),
        message: "当前转让需要版权拥有者明确接受。".into(),
    }
}

pub fn ownership_transfer_preserves_entitlements() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use crate::css_ownership_engine::policy::{
        can_request_transfer, ownership_scope_allowed, ownership_transfer_preserves_entitlements,
    };
    use crate::css_ownership_engine::types::{
        OwnershipRecord, OwnershipScope, OwnershipTransferDecision,
    };
    use crate::css_rights_engine::types::{RightsUnit, RightsWorkStructure};

    fn scope(unit: RightsUnit) -> OwnershipScope {
        OwnershipScope {
            work_structure: RightsWorkStructure::Trilogy,
            unit,
            unit_id: None,
            lang: Some("ja".into()),
        }
    }

    #[test]
    fn v157_partial_trilogy_scope_is_not_allowed_for_ownership() {
        assert!(!ownership_scope_allowed(&scope(RightsUnit::Part)));
        assert!(ownership_scope_allowed(&scope(RightsUnit::WholeWork)));
    }

    #[test]
    fn v157_transfer_requires_owner_price_and_resale_enablement() {
        let decision = can_request_transfer(&OwnershipRecord {
            ownership_id: "own_1".into(),
            owner_user_id: "owner".into(),
            scope: scope(RightsUnit::WholeWork),
            priceless: false,
            buyout_price_cents: None,
            currency: None,
            resale_enabled: false,
            created_at: "2026-03-12T00:00:00Z".into(),
        });
        assert_eq!(decision.decision, OwnershipTransferDecision::Deny);
    }

    #[test]
    fn v157_valid_transfer_request_still_requires_owner_approval() {
        let decision = can_request_transfer(&OwnershipRecord {
            ownership_id: "own_1".into(),
            owner_user_id: "owner".into(),
            scope: scope(RightsUnit::WholeWork),
            priceless: false,
            buyout_price_cents: Some(202600),
            currency: Some("USD".into()),
            resale_enabled: true,
            created_at: "2026-03-12T00:00:00Z".into(),
        });
        assert_eq!(
            decision.decision,
            OwnershipTransferDecision::RequiresOwnerApproval
        );
        assert!(ownership_transfer_preserves_entitlements());
    }
}
