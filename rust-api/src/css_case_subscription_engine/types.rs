use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseSubscriptionTarget {
    DailyDigest,
    WeeklyBriefing,
    Alerts,
    InboxWatch,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseSubscriptionDeliveryKind {
    DownloadReady,
    RobotPull,
    Attachment,
    ApiBundle,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseSubscriptionScheduleKind {
    Daily,
    Weekly,
    OnAlert,
    OnInboxChange,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InboxWatchSpec {
    pub inbox: crate::css_case_inbox_view::types::InboxKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_delta_count: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseSubscriptionSpec {
    pub subscription_id: String,
    pub subscriber_id: String,
    pub target: CaseSubscriptionTarget,
    pub schedule: CaseSubscriptionScheduleKind,
    pub delivery_kind: CaseSubscriptionDeliveryKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub inbox_watch: Option<InboxWatchSpec>,
    #[serde(default)]
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseSubscriptionExecutionRequest {
    pub subscription: CaseSubscriptionSpec,
    pub today_yyyy_mm_dd: String,
    pub trend_days: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseSubscriptionExecutionResult {
    pub subscription_id: String,
    pub delivered: bool,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payload_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliverySubscriptionFrequency {
    Daily,
    Weekly,
    OnAlert,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySubscriptionTarget {
    pub kind: crate::css_case_delivery_report_api::types::DeliveryReportKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub format: Option<crate::css_case_delivery_export_engine::types::DeliveryExportFormat>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySubscriptionRecord {
    pub subscription_id: String,
    pub owner_user_id: String,
    pub frequency: DeliverySubscriptionFrequency,
    pub target: DeliverySubscriptionTarget,
    pub enabled: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub destination: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDeliverySubscriptionRequest {
    pub owner_user_id: String,
    pub frequency: DeliverySubscriptionFrequency,
    pub target: DeliverySubscriptionTarget,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub destination: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliverySubscriptionDispatchRequest {
    pub subscription_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub days: Option<usize>,
}
