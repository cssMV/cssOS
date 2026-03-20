use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliverySubscriptionFrequency {
    Daily,
    Weekly,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliverySubscriptionStatus {
    Active,
    Paused,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySubscriptionTarget {
    pub target: crate::css_case_delivery_api::types::DeliveryApiTarget,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliverySubscriptionRecord {
    pub subscription_id: String,
    pub user_id: String,
    pub status: DeliverySubscriptionStatus,
    pub frequency: DeliverySubscriptionFrequency,
    pub delivery_mode: crate::css_case_delivery_api::types::DeliveryApiMode,
    pub delivery_target: DeliverySubscriptionTarget,
    pub report_type: crate::css_case_delivery_report_api::types::DeliveryReportType,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub export_format: Option<crate::css_case_delivery_export_engine::types::DeliveryExportFormat>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub days: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview_limit: Option<usize>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDeliverySubscriptionRequest {
    pub user_id: String,
    pub frequency: DeliverySubscriptionFrequency,
    pub delivery_mode: crate::css_case_delivery_api::types::DeliveryApiMode,
    pub delivery_target: DeliverySubscriptionTarget,
    pub report_type: crate::css_case_delivery_report_api::types::DeliveryReportType,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub export_format: Option<crate::css_case_delivery_export_engine::types::DeliveryExportFormat>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub days: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview_limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateDeliverySubscriptionRequest {
    pub subscription_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<DeliverySubscriptionStatus>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub frequency: Option<DeliverySubscriptionFrequency>,
}
