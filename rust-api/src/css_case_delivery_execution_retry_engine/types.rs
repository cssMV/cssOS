use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "lookup_kind", rename_all = "snake_case")]
pub enum DeliveryRetryLookup {
    LatestFailed,
    BySubscription {
        subscription_id: String,
    },
    ByDeliveryLog {
        delivery_log_id: String,
    },
    ByTargetMode {
        report_kind: crate::css_case_delivery_report_api::types::DeliveryReportKind,
        mode: crate::css_case_delivery_delivery_api::types::DeliveryApiMode,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        export_format: Option<crate::css_case_delivery_export_engine::types::DeliveryExportFormat>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryRetryRequest {
    pub lookup: DeliveryRetryLookup,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryRetryResult {
    pub retried: bool,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub original_delivery_log_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub new_delivery_log_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub succeeded: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub result_summary: Option<String>,
}
