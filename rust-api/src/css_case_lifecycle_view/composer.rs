use crate::css_case_action_log::types::{CaseActionLogKind, CssCaseActionLogRecord};
use crate::css_case_lifecycle_view::types::{CaseLifecycleStage, CaseLifecycleStageKind};
use crate::css_resolution_log::types::{CssResolutionLogRecord, ResolutionLogStatus};

fn action_label(action: &CaseActionLogKind) -> &'static str {
    match action {
        CaseActionLogKind::Approve => "approve",
        CaseActionLogKind::Reject => "reject",
        CaseActionLogKind::Freeze => "freeze",
        CaseActionLogKind::Escalate => "escalate",
        CaseActionLogKind::Release => "release",
        CaseActionLogKind::RequireReview => "require_review",
    }
}

fn resolution_status_label(status: &ResolutionLogStatus) -> &'static str {
    match status {
        ResolutionLogStatus::Open => "open",
        ResolutionLogStatus::Resolved => "resolved",
        ResolutionLogStatus::Dismissed => "dismissed",
        ResolutionLogStatus::Released => "released",
        ResolutionLogStatus::EscalatedToManual => "escalated_to_manual",
        ResolutionLogStatus::FrozenUntilReview => "frozen_until_review",
    }
}

pub fn stage_label(stage: &CaseLifecycleStageKind) -> String {
    match stage {
        CaseLifecycleStageKind::Open => "处理中".into(),
        CaseLifecycleStageKind::UnderReview => "复核中".into(),
        CaseLifecycleStageKind::Escalated => "已升级".into(),
        CaseLifecycleStageKind::Frozen => "冻结中".into(),
        CaseLifecycleStageKind::Released => "已释放".into(),
        CaseLifecycleStageKind::Resolved => "已解决".into(),
        CaseLifecycleStageKind::Dismissed => "已驳回".into(),
    }
}

pub fn stages_from_action_logs(logs: &[CssCaseActionLogRecord]) -> Vec<CaseLifecycleStage> {
    let mut out = Vec::new();

    for log in logs {
        let stage_kind = match log.action {
            CaseActionLogKind::RequireReview => Some(CaseLifecycleStageKind::UnderReview),
            CaseActionLogKind::Escalate => Some(CaseLifecycleStageKind::Escalated),
            CaseActionLogKind::Freeze => Some(CaseLifecycleStageKind::Frozen),
            CaseActionLogKind::Release => Some(CaseLifecycleStageKind::Released),
            CaseActionLogKind::Approve => Some(CaseLifecycleStageKind::Resolved),
            CaseActionLogKind::Reject => Some(CaseLifecycleStageKind::Dismissed),
        };

        if let Some(kind) = stage_kind {
            out.push(CaseLifecycleStage {
                stage_kind: kind.clone(),
                label: stage_label(&kind),
                entered_at: Some(log.created_at.clone()),
                description: format!("由案件动作 `{}` 推进到该阶段。", action_label(&log.action)),
            });
        }
    }

    out
}

pub fn stages_from_resolution_logs(logs: &[CssResolutionLogRecord]) -> Vec<CaseLifecycleStage> {
    let mut out = Vec::new();

    for log in logs {
        let kind = match log.status {
            ResolutionLogStatus::Open => CaseLifecycleStageKind::Open,
            ResolutionLogStatus::Resolved => CaseLifecycleStageKind::Resolved,
            ResolutionLogStatus::Dismissed => CaseLifecycleStageKind::Dismissed,
            ResolutionLogStatus::Released => CaseLifecycleStageKind::Released,
            ResolutionLogStatus::EscalatedToManual => CaseLifecycleStageKind::Escalated,
            ResolutionLogStatus::FrozenUntilReview => CaseLifecycleStageKind::Frozen,
        };

        out.push(CaseLifecycleStage {
            stage_kind: kind.clone(),
            label: stage_label(&kind),
            entered_at: Some(log.created_at.clone()),
            description: format!(
                "由正式结案/转段决定推进到 `{}`。",
                resolution_status_label(&log.status)
            ),
        });
    }

    out
}

pub fn initial_open_stage() -> CaseLifecycleStage {
    let kind = CaseLifecycleStageKind::Open;

    CaseLifecycleStage {
        stage_kind: kind.clone(),
        label: stage_label(&kind),
        entered_at: None,
        description: "案件已建立，处于初始处理阶段。".into(),
    }
}

pub fn squash_consecutive_stages(stages: Vec<CaseLifecycleStage>) -> Vec<CaseLifecycleStage> {
    let mut out: Vec<CaseLifecycleStage> = Vec::new();

    for stage in stages {
        let should_push = match out.last() {
            Some(last) => last.stage_kind != stage.stage_kind,
            None => true,
        };

        if should_push {
            out.push(stage);
        }
    }

    out
}

pub fn current_stage(stages: &[CaseLifecycleStage]) -> CaseLifecycleStageKind {
    stages
        .last()
        .map(|stage| stage.stage_kind.clone())
        .unwrap_or(CaseLifecycleStageKind::Open)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v198_squash_consecutive_stages_keeps_unique_progression() {
        let stages = vec![
            CaseLifecycleStage {
                stage_kind: CaseLifecycleStageKind::Open,
                label: "处理中".into(),
                entered_at: None,
                description: "open".into(),
            },
            CaseLifecycleStage {
                stage_kind: CaseLifecycleStageKind::Open,
                label: "处理中".into(),
                entered_at: Some("2026-03-13T00:00:00Z".into()),
                description: "open again".into(),
            },
            CaseLifecycleStage {
                stage_kind: CaseLifecycleStageKind::Frozen,
                label: "冻结中".into(),
                entered_at: Some("2026-03-13T01:00:00Z".into()),
                description: "frozen".into(),
            },
        ];

        let squashed = squash_consecutive_stages(stages);
        assert_eq!(squashed.len(), 2);
        assert_eq!(current_stage(&squashed), CaseLifecycleStageKind::Frozen);
    }
}
