use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySummaryCardItem {
    pub label: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliverySummary {
    pub one_line: String,
    #[serde(default)]
    pub three_line: Vec<String>,
    #[serde(default)]
    pub card_items: Vec<DeliverySummaryCardItem>,
    pub notification_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySummaryRequest {
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    pub consecutive_failures: usize,
    pub retry_still_failing: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub replay_limit: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub action_limit: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timeline_limit: Option<usize>,
}
