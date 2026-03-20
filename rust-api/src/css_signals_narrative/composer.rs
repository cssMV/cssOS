fn has_high_risk(frame: &crate::css_signals_replay::types::SignalsReplayFrame) -> bool {
    frame.signals.iter().any(|s| {
        matches!(
            s.severity,
            crate::css_signals_hub::types::SignalSeverity::High
                | crate::css_signals_hub::types::SignalSeverity::Critical
        )
    })
}

fn is_restricted_frame(frame: &crate::css_signals_replay::types::SignalsReplayFrame) -> bool {
    frame.signals.iter().any(|s| {
        matches!(
            s.signal_kind,
            crate::css_signals_hub::types::SignalKind::CreditRestricted
                | crate::css_signals_hub::types::SignalKind::Restricted
        )
    })
}

fn is_frozen_frame(frame: &crate::css_signals_replay::types::SignalsReplayFrame) -> bool {
    frame.signals.iter().any(|s| {
        matches!(
            s.signal_kind,
            crate::css_signals_hub::types::SignalKind::Frozen
        )
    })
}

fn is_review_frame(frame: &crate::css_signals_replay::types::SignalsReplayFrame) -> bool {
    frame.signals.iter().any(|s| {
        matches!(
            s.signal_kind,
            crate::css_signals_hub::types::SignalKind::ReviewRequired
        )
    })
}

fn milestone_from_frame(
    frame: &crate::css_signals_replay::types::SignalsReplayFrame,
) -> Option<crate::css_signals_narrative::types::NarrativeMilestone> {
    let has_added_or_upgraded = frame.deltas_from_previous.iter().any(|d| {
        matches!(
            d.change_kind,
            crate::css_signals_replay::types::ReplayChangeKind::Added
                | crate::css_signals_replay::types::ReplayChangeKind::SeverityIncreased
        )
    });

    if !has_added_or_upgraded {
        return None;
    }

    if is_frozen_frame(frame) {
        return Some(crate::css_signals_narrative::types::NarrativeMilestone {
            created_at: frame.created_at.clone(),
            title: "进入冻结风险阶段".into(),
            description: "该时点出现冻结相关信号，说明风险已进入极高区间。".into(),
            phase: crate::css_signals_narrative::types::NarrativePhase::Frozen,
        });
    }

    if is_restricted_frame(frame) {
        return Some(crate::css_signals_narrative::types::NarrativeMilestone {
            created_at: frame.created_at.clone(),
            title: "进入限制阶段".into(),
            description: "该时点出现限制相关信号，说明对象的部分能力已被平台约束。".into(),
            phase: crate::css_signals_narrative::types::NarrativePhase::Restricted,
        });
    }

    if is_review_frame(frame) {
        return Some(crate::css_signals_narrative::types::NarrativeMilestone {
            created_at: frame.created_at.clone(),
            title: "进入人工复核阶段".into(),
            description: "该时点出现 review_required 信号，说明平台已将其纳入人工复核风险区。"
                .into(),
            phase: crate::css_signals_narrative::types::NarrativePhase::Escalating,
        });
    }

    if has_high_risk(frame) {
        return Some(crate::css_signals_narrative::types::NarrativeMilestone {
            created_at: frame.created_at.clone(),
            title: "风险明显升级".into(),
            description: "该时点新增或升级了高严重度信号，说明风险开始显著上升。".into(),
            phase: crate::css_signals_narrative::types::NarrativePhase::Escalating,
        });
    }

    None
}

pub fn build_summary(replay: &crate::css_signals_replay::types::SignalsReplayView) -> String {
    if replay.frames.is_empty() {
        return "当前没有可用于生成叙事的信号历史。".into();
    }

    let first = replay.frames.first().expect("checked non-empty");
    let last = replay.frames.last().expect("checked non-empty");
    let first_high = has_high_risk(first);
    let last_high = has_high_risk(last);

    match (first_high, last_high) {
        (false, false) => "该对象的信号历史总体稳定，未出现明显高风险演化。".into(),
        (false, true) => "该对象的风险并非初始即高，而是在后续阶段逐步累积并升级。".into(),
        (true, true) => "该对象自较早阶段起即处于较高风险状态，并在后续持续波动。".into(),
        (true, false) => "该对象曾经处于较高风险状态，但后续出现了恢复迹象。".into(),
    }
}

pub fn build_current_assessment(
    replay: &crate::css_signals_replay::types::SignalsReplayView,
) -> String {
    let Some(last) = replay.frames.last() else {
        return "当前没有可评估的最新信号状态。".into();
    };

    if is_frozen_frame(last) {
        return "当前处于冻结风险阶段，应以阻断和人工处理为主。".into();
    }
    if is_restricted_frame(last) {
        return "当前处于限制阶段，说明平台已对部分行为施加约束。".into();
    }
    if is_review_frame(last) {
        return "当前处于人工复核阶段，风险尚未解除。".into();
    }
    if has_high_risk(last) {
        return "当前仍处于高风险区，但尚未进入冻结层级。".into();
    }

    "当前信号整体趋于稳定，未见明显高风险态。".into()
}

pub fn extract_milestones(
    replay: &crate::css_signals_replay::types::SignalsReplayView,
) -> Vec<crate::css_signals_narrative::types::NarrativeMilestone> {
    let mut out = Vec::new();

    if let Some(first) = replay.frames.first() {
        out.push(crate::css_signals_narrative::types::NarrativeMilestone {
            created_at: first.created_at.clone(),
            title: "初始信号状态".into(),
            description: "这是当前可回放序列中的最早信号帧。".into(),
            phase: crate::css_signals_narrative::types::NarrativePhase::Initial,
        });
    }

    for frame in &replay.frames {
        if let Some(m) = milestone_from_frame(frame) {
            out.push(m);
        }
    }

    if replay.frames.len() >= 2 {
        let last = replay.frames.last().expect("len checked");
        let prev = &replay.frames[replay.frames.len() - 2];
        let prev_high = has_high_risk(prev);
        let last_high = has_high_risk(last);

        if prev_high && !last_high {
            out.push(crate::css_signals_narrative::types::NarrativeMilestone {
                created_at: last.created_at.clone(),
                title: "出现恢复迹象".into(),
                description: "最新一帧相比前一阶段，高风险信号已明显下降。".into(),
                phase: crate::css_signals_narrative::types::NarrativePhase::Recovering,
            });
        }
    }

    out
}

#[cfg(test)]
mod tests {
    fn frame(
        created_at: &str,
        signals: Vec<crate::css_signals_hub::types::CssSignal>,
        deltas: Vec<crate::css_signals_replay::types::SignalReplayDelta>,
    ) -> crate::css_signals_replay::types::SignalsReplayFrame {
        crate::css_signals_replay::types::SignalsReplayFrame {
            snapshot_id: format!("ss_{}", created_at),
            created_at: created_at.to_string(),
            purpose: crate::css_signals_snapshot::types::SnapshotPurpose::AuditEvidence,
            signals,
            deltas_from_previous: deltas,
        }
    }

    fn signal(
        kind: crate::css_signals_hub::types::SignalKind,
        severity: crate::css_signals_hub::types::SignalSeverity,
        title: &str,
    ) -> crate::css_signals_hub::types::CssSignal {
        crate::css_signals_hub::types::CssSignal {
            signal_kind: kind,
            severity,
            title: title.to_string(),
            description: title.to_string(),
            source_system: None,
            source_id: None,
        }
    }

    fn delta(
        kind: crate::css_signals_hub::types::SignalKind,
        change_kind: crate::css_signals_replay::types::ReplayChangeKind,
        to_severity: Option<crate::css_signals_hub::types::SignalSeverity>,
    ) -> crate::css_signals_replay::types::SignalReplayDelta {
        crate::css_signals_replay::types::SignalReplayDelta {
            signal_kind: kind,
            change_kind,
            from_severity: None,
            to_severity,
            description: "delta".into(),
        }
    }

    #[test]
    fn v186_summary_detects_escalation_from_low_to_high_risk() {
        let replay = crate::css_signals_replay::types::SignalsReplayView {
            subject_kind: crate::css_signals_replay::types::ReplaySubjectKind::User,
            subject_id: "user_1".into(),
            frames: vec![
                frame("2026-03-12T00:00:00Z", vec![], vec![]),
                frame(
                    "2026-03-12T01:00:00Z",
                    vec![signal(
                        crate::css_signals_hub::types::SignalKind::ActivePenalty,
                        crate::css_signals_hub::types::SignalSeverity::High,
                        "存在活跃处罚",
                    )],
                    vec![delta(
                        crate::css_signals_hub::types::SignalKind::ActivePenalty,
                        crate::css_signals_replay::types::ReplayChangeKind::Added,
                        Some(crate::css_signals_hub::types::SignalSeverity::High),
                    )],
                ),
            ],
        };

        let summary = super::build_summary(&replay);
        assert!(summary.contains("逐步累积并升级"));
    }

    #[test]
    fn v186_current_assessment_prefers_frozen_over_other_states() {
        let replay = crate::css_signals_replay::types::SignalsReplayView {
            subject_kind: crate::css_signals_replay::types::ReplaySubjectKind::User,
            subject_id: "user_1".into(),
            frames: vec![frame(
                "2026-03-12T01:00:00Z",
                vec![signal(
                    crate::css_signals_hub::types::SignalKind::Frozen,
                    crate::css_signals_hub::types::SignalSeverity::Critical,
                    "冻结信号",
                )],
                vec![],
            )],
        };

        let assessment = super::build_current_assessment(&replay);
        assert!(assessment.contains("冻结风险阶段"));
    }
}
