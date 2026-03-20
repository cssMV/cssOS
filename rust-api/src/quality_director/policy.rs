use crate::quality_director::types::{QualityBlocker, QualityBlockerLevel, ReleaseReadiness};

pub fn from_narrative_qa(
    report: &crate::narrative_qa::types::NarrativeQaReport,
) -> Vec<QualityBlocker> {
    report
        .issues
        .iter()
        .map(|i| QualityBlocker {
            dimension: "narrative".into(),
            level: match i.severity {
                crate::narrative_qa::types::QaSeverity::Error => QualityBlockerLevel::Hard,
                crate::narrative_qa::types::QaSeverity::Warning => QualityBlockerLevel::Soft,
                crate::narrative_qa::types::QaSeverity::Info => QualityBlockerLevel::None,
            },
            code: format!("{:?}", i.code).to_lowercase(),
            message: i.message.clone(),
        })
        .collect()
}

pub fn from_continuity_qa(
    report: &crate::continuity_engine::types::ContinuityReport,
) -> Vec<QualityBlocker> {
    report
        .issues
        .iter()
        .map(|i| QualityBlocker {
            dimension: "continuity".into(),
            level: match i.severity {
                crate::continuity_engine::types::ContinuitySeverity::Error => {
                    QualityBlockerLevel::Hard
                }
                crate::continuity_engine::types::ContinuitySeverity::Warning => {
                    QualityBlockerLevel::Soft
                }
                crate::continuity_engine::types::ContinuitySeverity::Info => {
                    QualityBlockerLevel::None
                }
            },
            code: format!("{:?}", i.code).to_lowercase(),
            message: i.message.clone(),
        })
        .collect()
}

pub fn overall_blocker_level(blockers: &[QualityBlocker]) -> QualityBlockerLevel {
    if blockers
        .iter()
        .any(|b| matches!(b.level, QualityBlockerLevel::Hard))
    {
        QualityBlockerLevel::Hard
    } else if blockers
        .iter()
        .any(|b| matches!(b.level, QualityBlockerLevel::Soft))
    {
        QualityBlockerLevel::Soft
    } else {
        QualityBlockerLevel::None
    }
}

pub fn readiness_from_blockers(level: QualityBlockerLevel) -> ReleaseReadiness {
    match level {
        QualityBlockerLevel::Hard => ReleaseReadiness::InternalOnly,
        QualityBlockerLevel::Soft => ReleaseReadiness::PreviewReady,
        QualityBlockerLevel::None => ReleaseReadiness::DemoReady,
    }
}
