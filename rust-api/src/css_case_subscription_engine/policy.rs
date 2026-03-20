use crate::css_case_delivery_api::types::CaseDeliveryMode;
use crate::css_case_delivery_export_engine::types::{DeliveryExportFormat, DeliveryExportTarget};
use crate::css_case_subscription_engine::types::{
    CaseSubscriptionDeliveryKind, CaseSubscriptionTarget, DeliverySubscriptionTarget,
};

pub fn export_target_for_subscription(target: &CaseSubscriptionTarget) -> DeliveryExportTarget {
    match target {
        CaseSubscriptionTarget::DailyDigest => DeliveryExportTarget::Digest,
        CaseSubscriptionTarget::WeeklyBriefing => DeliveryExportTarget::Briefing,
        CaseSubscriptionTarget::Alerts => DeliveryExportTarget::Alerts,
        CaseSubscriptionTarget::InboxWatch => DeliveryExportTarget::Dashboard,
    }
}

pub fn export_format_for_subscription(target: &CaseSubscriptionTarget) -> DeliveryExportFormat {
    match target {
        // Reuse the existing plain-text export mode instead of widening the export enum in v213.
        CaseSubscriptionTarget::DailyDigest => DeliveryExportFormat::BriefingText,
        CaseSubscriptionTarget::WeeklyBriefing => DeliveryExportFormat::BriefingText,
        CaseSubscriptionTarget::Alerts => DeliveryExportFormat::JsonPackage,
        CaseSubscriptionTarget::InboxWatch => DeliveryExportFormat::JsonPackage,
    }
}

pub fn delivery_mode_for_subscription(kind: &CaseSubscriptionDeliveryKind) -> CaseDeliveryMode {
    match kind {
        CaseSubscriptionDeliveryKind::DownloadReady => CaseDeliveryMode::Download,
        CaseSubscriptionDeliveryKind::RobotPull => CaseDeliveryMode::RobotPull,
        CaseSubscriptionDeliveryKind::Attachment => CaseDeliveryMode::Attachment,
        CaseSubscriptionDeliveryKind::ApiBundle => CaseDeliveryMode::ApiBundle,
    }
}

pub fn recommended_format(
    kind: &crate::css_case_delivery_report_api::types::DeliveryReportKind,
) -> Option<DeliveryExportFormat> {
    use crate::css_case_delivery_report_api::types::DeliveryReportKind::*;

    match kind {
        Digest => Some(DeliveryExportFormat::BriefingText),
        BriefingPack => Some(DeliveryExportFormat::BriefingText),
        Dashboard | Kpi | Trends => Some(DeliveryExportFormat::Csv),
        Alerts | Analytics => Some(DeliveryExportFormat::JsonPackage),
    }
}

pub fn validate_subscription_target(target: &DeliverySubscriptionTarget) -> anyhow::Result<()> {
    use crate::css_case_delivery_report_api::types::DeliveryReportKind::*;

    match (&target.kind, &target.format) {
        (_, None) => Ok(()),
        (Digest, Some(DeliveryExportFormat::BriefingText | DeliveryExportFormat::JsonPackage)) => {
            Ok(())
        }
        (
            BriefingPack,
            Some(DeliveryExportFormat::BriefingText | DeliveryExportFormat::JsonPackage),
        ) => Ok(()),
        (Dashboard, Some(DeliveryExportFormat::Csv | DeliveryExportFormat::JsonPackage)) => Ok(()),
        (Kpi, Some(DeliveryExportFormat::Csv | DeliveryExportFormat::JsonPackage)) => Ok(()),
        (Analytics, Some(DeliveryExportFormat::JsonPackage)) => Ok(()),
        (Trends, Some(DeliveryExportFormat::Csv | DeliveryExportFormat::JsonPackage)) => Ok(()),
        (Alerts, Some(DeliveryExportFormat::JsonPackage)) => Ok(()),
        _ => anyhow::bail!("unsupported subscription target/format combination"),
    }
}
