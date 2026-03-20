use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum DeliveryRetryLookup {
    LatestFailed,
    BySubscription {
        subscription_id: String,
    },
    ByTargetMode {
        target: crate::css_case_delivery_api::types::DeliveryApiTarget,
        mode: crate::css_case_delivery_api::types::DeliveryApiMode,
    },
    ByDeliveryLog {
        delivery_log_id: String,
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
    pub previous_delivery_log_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub new_delivery_log_id: Option<String>,
}
