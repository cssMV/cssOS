use crate::css_case_delivery_summary_engine::types::DeliverySummaryCardItem;

fn state_label(
    state: &crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState,
) -> &'static str {
    match state {
        crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState::Resolved => {
            "resolved"
        }
        crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState::Stabilized => {
            "stabilized"
        }
        crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState::Escalated => {
            "escalated"
        }
        crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState::UnderManualIntervention => {
            "under_manual_intervention"
        }
        crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState::MonitoringOnly => {
            "monitoring_only"
        }
    }
}

pub fn one_line(
    status: &crate::css_case_delivery_status_view::types::CssCaseDeliveryStatusView,
) -> String {
    status.summary.clone()
}

pub fn three_line(
    status: &crate::css_case_delivery_status_view::types::CssCaseDeliveryStatusView,
    lifecycle: &crate::css_case_delivery_lifecycle_view::types::CssCaseDeliveryLifecycleView,
    timeline_explain: &crate::css_case_delivery_timeline_explain::types::CssCaseDeliveryTimelineExplainView,
) -> Vec<String> {
    let current = status.summary.clone();

    let lifecycle_line = format!("该对象已经历 {} 个生命周期阶段。", lifecycle.stages.len());

    let explain_line = timeline_explain.summary.clone();

    vec![current, lifecycle_line, explain_line]
}

pub fn card_items(
    workspace: &crate::css_case_delivery_workspace::types::CssCaseDeliveryWorkspace,
    lifecycle: &crate::css_case_delivery_lifecycle_view::types::CssCaseDeliveryLifecycleView,
    status: &crate::css_case_delivery_status_view::types::CssCaseDeliveryStatusView,
) -> Vec<DeliverySummaryCardItem> {
    vec![
        DeliverySummaryCardItem {
            label: "当前状态".into(),
            value: state_label(&status.state).into(),
        },
        DeliverySummaryCardItem {
            label: "Trust".into(),
            value: format!("{:?}", workspace.trust.trust_level),
        },
        DeliverySummaryCardItem {
            label: "Risk".into(),
            value: format!("{:?}", workspace.risk.risk_level),
        },
        DeliverySummaryCardItem {
            label: "生命周期阶段".into(),
            value: lifecycle.stages.len().to_string(),
        },
    ]
}

pub fn notification_text(
    status: &crate::css_case_delivery_status_view::types::CssCaseDeliveryStatusView,
    workspace: &crate::css_case_delivery_workspace::types::CssCaseDeliveryWorkspace,
) -> String {
    let workspace_summary = workspace
        .header
        .summary
        .clone()
        .unwrap_or_else(|| workspace.header.subtitle.clone());

    format!("{} {}", status.summary, workspace_summary)
}
