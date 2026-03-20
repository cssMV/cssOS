use crate::css_case_delivery_lifecycle_view::types::{
    DeliveryLifecycleStage, DeliveryLifecycleStageKind,
};

pub fn stage_title(kind: &DeliveryLifecycleStageKind) -> String {
    match kind {
        DeliveryLifecycleStageKind::Initial => "初始阶段".into(),
        DeliveryLifecycleStageKind::Monitoring => "观察阶段".into(),
        DeliveryLifecycleStageKind::Escalated => "升级阶段".into(),
        DeliveryLifecycleStageKind::UnderManualIntervention => "人工介入阶段".into(),
        DeliveryLifecycleStageKind::Stabilized => "稳定阶段".into(),
        DeliveryLifecycleStageKind::Resolved => "已解决阶段".into(),
    }
}

pub fn stage_summary(kind: &DeliveryLifecycleStageKind) -> String {
    match kind {
        DeliveryLifecycleStageKind::Initial => "对象进入交付生命周期。".into(),
        DeliveryLifecycleStageKind::Monitoring => "对象以常规观察与跟踪为主。".into(),
        DeliveryLifecycleStageKind::Escalated => "对象进入升级关注与处理路径。".into(),
        DeliveryLifecycleStageKind::UnderManualIntervention => "对象进入人工介入处理路径。".into(),
        DeliveryLifecycleStageKind::Stabilized => "对象从高风险恢复到可控状态。".into(),
        DeliveryLifecycleStageKind::Resolved => "对象进入正式已解决状态。".into(),
    }
}

pub fn lifecycle_summary(stages: &[DeliveryLifecycleStage], current_summary: &str) -> String {
    format!(
        "该交付对象共经历 {} 个生命周期阶段，当前状态为 {}",
        stages.len(),
        current_summary
    )
}
