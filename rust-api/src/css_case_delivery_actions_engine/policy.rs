pub fn allow_action(
    action: &crate::css_case_delivery_actions_engine::types::DeliveryActionKind,
) -> bool {
    let _ = action;
    true
}

pub fn subject_key(
    target: &crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    mode: &crate::css_case_delivery_log::types::CaseDeliveryLogMode,
) -> String {
    crate::css_case_delivery_signals_cache::runtime::subject_key(target, mode)
}

pub fn success_message(
    action: &crate::css_case_delivery_actions_engine::types::DeliveryActionKind,
) -> String {
    use crate::css_case_delivery_actions_engine::types::DeliveryActionKind;

    match action {
        DeliveryActionKind::Retry => "delivery retry executed".into(),
        DeliveryActionKind::ForceRefreshSignals => "signals refresh executed".into(),
        DeliveryActionKind::CaptureSnapshot => "signals snapshot captured".into(),
        DeliveryActionKind::EscalateOps => "delivery escalated to ops".into(),
        DeliveryActionKind::RequireManualIntervention => "manual intervention required".into(),
    }
}
