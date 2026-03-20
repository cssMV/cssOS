pub fn compute_score(
    narrative: Option<&crate::narrative_qa::types::NarrativeQaReport>,
    continuity: Option<&crate::continuity_engine::types::ContinuityReport>,
) -> i32 {
    let mut score = 100;
    if let Some(n) = narrative {
        for issue in &n.issues {
            score -= match issue.severity {
                crate::narrative_qa::types::QaSeverity::Error => 30,
                crate::narrative_qa::types::QaSeverity::Warning => 10,
                crate::narrative_qa::types::QaSeverity::Info => 2,
            };
        }
    }
    if let Some(c) = continuity {
        for issue in &c.issues {
            score -= match issue.severity {
                crate::continuity_engine::types::ContinuitySeverity::Error => 20,
                crate::continuity_engine::types::ContinuitySeverity::Warning => 8,
                crate::continuity_engine::types::ContinuitySeverity::Info => 2,
            };
        }
    }
    score.clamp(0, 100)
}

pub fn headline(
    readiness: &crate::quality_director::types::ReleaseReadiness,
    blockers: &[crate::quality_director::types::QualityBlocker],
) -> String {
    match readiness {
        crate::quality_director::types::ReleaseReadiness::InternalOnly => {
            let msg = blockers
                .first()
                .map(|b| b.message.clone())
                .unwrap_or_else(|| "存在质量阻塞".into());
            format!("仅限内部：当前存在硬阻塞，核心问题：{}", msg)
        }
        crate::quality_director::types::ReleaseReadiness::PreviewReady => {
            let msg = blockers
                .first()
                .map(|b| b.message.clone())
                .unwrap_or_else(|| "仍有质量风险".into());
            format!("可内部预览：仍存在质量风险，问题：{}", msg)
        }
        crate::quality_director::types::ReleaseReadiness::DemoReady => {
            "可对外 Demo：当前无重大质量阻塞".into()
        }
        crate::quality_director::types::ReleaseReadiness::PromoReady => {
            "可宣发：质量达到宣传级别".into()
        }
        crate::quality_director::types::ReleaseReadiness::MarketReady => {
            "可上架：质量达到市场级".into()
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::continuity_engine::types::{
        ContinuityCode, ContinuityIssue, ContinuityReport, ContinuitySeverity,
    };
    use crate::narrative_qa::types::{NarrativeQaReport, QaCode, QaIssue, QaSeverity};
    use crate::quality_director::policy::{overall_blocker_level, readiness_from_blockers};
    use crate::quality_director::scoring::{compute_score, headline};
    use crate::quality_director::types::{QualityBlocker, QualityBlockerLevel, ReleaseReadiness};

    #[test]
    fn v150_scoring_and_headline_reflect_blockers() {
        let narrative = NarrativeQaReport {
            passed: false,
            issues: vec![QaIssue {
                code: QaCode::RelationshipContradiction,
                severity: QaSeverity::Error,
                message: "hard narrative issue".into(),
                scene_id: None,
                event_index: None,
            }],
        };
        let continuity = ContinuityReport {
            passed: true,
            issues: vec![ContinuityIssue {
                code: ContinuityCode::CameraAxisBreak,
                severity: ContinuitySeverity::Warning,
                message: "soft continuity issue".into(),
                scene_id: None,
                event_index: None,
            }],
        };

        let score = compute_score(Some(&narrative), Some(&continuity));
        assert_eq!(score, 62);

        let blockers = vec![QualityBlocker {
            dimension: "narrative".into(),
            level: QualityBlockerLevel::Hard,
            code: "relationshipcontradiction".into(),
            message: "hard narrative issue".into(),
        }];
        let level = overall_blocker_level(&blockers);
        let readiness = readiness_from_blockers(level.clone());
        assert_eq!(level, QualityBlockerLevel::Hard);
        assert_eq!(readiness, ReleaseReadiness::InternalOnly);
        assert!(headline(&readiness, &blockers).contains("仅限内部"));
    }
}
