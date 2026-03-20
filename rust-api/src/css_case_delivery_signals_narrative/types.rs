use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryNarrativeTone {
    Ops,
    Management,
    Neutral,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySignalsNarrativeSentence {
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySignalsNarrativeStep {
    pub created_at: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliverySignalsNarrative {
    pub title: String,
    pub summary: String,
    #[serde(default)]
    pub sentences: Vec<DeliverySignalsNarrativeSentence>,

    // Legacy-kept compatibility fields for older timeline/storyboard callers.
    pub subject_key: String,
    pub tone: DeliveryNarrativeTone,
    #[serde(default)]
    pub steps: Vec<DeliverySignalsNarrativeStep>,
    #[serde(default)]
    pub paragraphs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySignalsNarrativeViewRequest {
    pub target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    pub consecutive_failures: usize,
    pub latest_failed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySignalsNarrativeRequest {
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    pub tone: DeliveryNarrativeTone,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub limit: Option<usize>,
}
