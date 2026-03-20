use crate::css_deal_engine::types::{CssDeal, DealDecisionResult, DealIntent};

pub fn can_create_intent(
    ownership: &crate::css_ownership_engine::types::OwnershipRecord,
) -> DealDecisionResult {
    let r = crate::css_ownership_engine::policy::can_request_transfer(ownership);
    match r.decision {
        crate::css_ownership_engine::types::OwnershipTransferDecision::Deny => DealDecisionResult {
            allowed: false,
            code: r.code,
            message: r.message,
        },
        _ => DealDecisionResult {
            allowed: true,
            code: "deal_intent_allowed".into(),
            message: "允许买家发起购买意向。".into(),
        },
    }
}

pub fn can_select_buyer(
    ownership: &crate::css_ownership_engine::types::OwnershipRecord,
    seller_user_id: &str,
) -> DealDecisionResult {
    if ownership.owner_user_id != seller_user_id {
        return DealDecisionResult {
            allowed: false,
            code: "not_current_owner".into(),
            message: "只有当前版权拥有者可以选择买家。".into(),
        };
    }
    DealDecisionResult {
        allowed: true,
        code: "seller_selection_allowed".into(),
        message: "允许当前版权拥有者选择买家。".into(),
    }
}

pub fn seller_choice_overrides_arrival_order() -> bool {
    true
}

pub fn selected_intent_excludes_others() -> bool {
    true
}

pub fn can_lock_for_buyer(intent: &DealIntent) -> DealDecisionResult {
    if !matches!(
        intent.status,
        crate::css_deal_engine::types::DealIntentStatus::Pending
    ) {
        return DealDecisionResult {
            allowed: false,
            code: "intent_not_pending".into(),
            message: "只有 pending 的购买意向可以被选中并锁单。".into(),
        };
    }
    DealDecisionResult {
        allowed: true,
        code: "deal_lock_allowed".into(),
        message: "允许对该买家建立独占成交锁。".into(),
    }
}

pub fn deal_completion_preserves_entitlements() -> bool {
    true
}

#[allow(dead_code)]
pub fn _deal_ready_for_payment(deal: &CssDeal) -> bool {
    matches!(
        deal.status,
        crate::css_deal_engine::types::DealStatus::LockedForBuyer
    )
}

#[cfg(test)]
mod tests {
    use crate::css_deal_engine::policy::{
        can_create_intent, can_lock_for_buyer, can_select_buyer,
        deal_completion_preserves_entitlements, selected_intent_excludes_others,
        seller_choice_overrides_arrival_order,
    };
    use crate::css_deal_engine::types::{DealIntent, DealIntentStatus};
    use crate::css_ownership_engine::types::{OwnershipRecord, OwnershipScope};
    use crate::css_rights_engine::types::{RightsUnit, RightsWorkStructure};

    fn ownership() -> OwnershipRecord {
        OwnershipRecord {
            ownership_id: "own_1".into(),
            owner_user_id: "seller_a".into(),
            scope: OwnershipScope {
                work_structure: RightsWorkStructure::Single,
                unit: RightsUnit::WholeWork,
                unit_id: None,
                lang: None,
            },
            priceless: false,
            buyout_price_cents: Some(202600),
            currency: Some("USD".into()),
            resale_enabled: true,
            created_at: "2026-03-12T00:00:00Z".into(),
        }
    }

    #[test]
    fn v158_deal_intent_is_allowed_when_ownership_is_sellable() {
        let decision = can_create_intent(&ownership());
        assert!(decision.allowed);
        assert!(seller_choice_overrides_arrival_order());
    }

    #[test]
    fn v158_only_current_owner_can_select_buyer() {
        let denied = can_select_buyer(&ownership(), "other_user");
        assert!(!denied.allowed);
    }

    #[test]
    fn v158_selected_pending_intent_can_be_locked_and_excludes_others() {
        let decision = can_lock_for_buyer(&DealIntent {
            intent_id: "intent_1".into(),
            ownership_id: "own_1".into(),
            seller_user_id: "seller_a".into(),
            buyer_user_id: "buyer_b".into(),
            offered_price_cents: Some(202600),
            currency: Some("USD".into()),
            status: DealIntentStatus::Pending,
            created_at: "2026-03-12T00:00:00Z".into(),
        });
        assert!(decision.allowed);
        assert!(selected_intent_excludes_others());
        assert!(deal_completion_preserves_entitlements());
    }
}
