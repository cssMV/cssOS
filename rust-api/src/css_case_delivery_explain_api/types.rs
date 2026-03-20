use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetDeliveryExplainRequest {
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    pub delivered: bool,
    pub failure_streak: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryExplainApiResponse {
    pub data: crate::css_case_delivery_explain_view::types::CssCaseDeliveryExplainView,
}
