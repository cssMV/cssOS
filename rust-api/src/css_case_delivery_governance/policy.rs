use crate::css_case_delivery_governance::types::{
    DeliveryGovernanceSeverity, DeliveryGuaranteeClass,
};

pub fn guarantee_class_for_target(
    target: &crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
) -> DeliveryGuaranteeClass {
    match target {
        crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Briefing => {
            DeliveryGuaranteeClass::MustDeliver
        }
        crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Alerts => {
            DeliveryGuaranteeClass::MustDeliver
        }
        crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Digest => {
            DeliveryGuaranteeClass::Important
        }
        _ => DeliveryGuaranteeClass::BestEffort,
    }
}

pub fn silent_failure_not_allowed(
    target: &crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
) -> bool {
    matches!(
        target,
        crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Digest
            | crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Briefing
            | crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Alerts
    )
}

pub fn manual_intervention_required_for_mode(
    mode: &crate::css_case_delivery_log::types::CaseDeliveryLogMode,
) -> bool {
    matches!(
        mode,
        crate::css_case_delivery_log::types::CaseDeliveryLogMode::Attachment
            | crate::css_case_delivery_log::types::CaseDeliveryLogMode::ApiBundle
    )
}

pub fn severity_for_failure_streak(streak: usize) -> DeliveryGovernanceSeverity {
    if streak >= 3 {
        DeliveryGovernanceSeverity::Critical
    } else if streak >= 2 {
        DeliveryGovernanceSeverity::Elevated
    } else {
        DeliveryGovernanceSeverity::Normal
    }
}

pub fn is_must_deliver_target(
    target: &crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
) -> bool {
    matches!(
        target,
        crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Digest
            | crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Briefing
    )
}

pub fn silent_failure_allowed(
    target: &crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
) -> bool {
    !is_must_deliver_target(target)
}

pub fn escalation_failure_threshold() -> usize {
    3
}

pub fn severity_of(
    consecutive_failures: usize,
    must_deliver: bool,
    require_manual_intervention: bool,
) -> crate::css_case_delivery_governance::types::DeliveryGovernanceLevel {
    use crate::css_case_delivery_governance::types::DeliveryGovernanceLevel::*;

    if require_manual_intervention {
        return Critical;
    }

    if must_deliver && consecutive_failures >= 2 {
        return Critical;
    }

    if consecutive_failures >= escalation_failure_threshold() {
        return Elevated;
    }

    Normal
}
