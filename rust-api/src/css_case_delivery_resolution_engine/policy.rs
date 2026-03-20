pub fn resolution_summary(
    state: &crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState,
) -> String {
    match state {
        crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState::Resolved => {
            "delivery object is resolved".into()
        }
        crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState::Stabilized => {
            "delivery object is stabilized".into()
        }
        crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState::Escalated => {
            "delivery object is escalated".into()
        }
        crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState::UnderManualIntervention => {
            "delivery object is under manual intervention".into()
        }
        crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState::MonitoringOnly => {
            "delivery object is under monitoring only".into()
        }
    }
}

pub fn state_priority(
    state: &crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState,
) -> i32 {
    match state {
        crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState::UnderManualIntervention => 5,
        crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState::Escalated => 4,
        crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState::MonitoringOnly => 3,
        crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState::Stabilized => 2,
        crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState::Resolved => 1,
    }
}
