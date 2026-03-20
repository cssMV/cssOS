use crate::css_governance_timeline::types::{GovernanceTimelineEntry, TimelineEventKind};
use crate::css_reasoning_view::types::{
    ReasoningActionItem, ReasoningOutcomeItem, ReasoningReasonItem,
};
use crate::css_rule_audit::types::CssRuleAuditRecord;

pub fn reasons_from_rule_audit(audit: &CssRuleAuditRecord) -> Vec<ReasoningReasonItem> {
    audit
        .checks
        .iter()
        .filter(|check| check.matched)
        .map(|check| ReasoningReasonItem {
            title: format!("命中规则：{}", check.rule_key),
            explanation: check.message.clone(),
            rule_key: Some(check.rule_key.clone()),
            policy_version_id: Some(audit.policy_version_id.clone()),
        })
        .collect()
}

pub fn outcomes_from_timeline(entries: &[GovernanceTimelineEntry]) -> Vec<ReasoningOutcomeItem> {
    let mut out = Vec::new();

    for entry in entries {
        match entry.event_kind {
            TimelineEventKind::CreditScoreDecreased => {
                if let Some(delta) = entry.credit_delta {
                    out.push(ReasoningOutcomeItem {
                        label: "信用分减少".into(),
                        description: format!(
                            "信用分从 {} 变为 {}（变化 {}）。",
                            entry.credit_score_before.unwrap_or_default(),
                            entry.credit_score_after.unwrap_or_default(),
                            delta
                        ),
                    });
                }
            }
            TimelineEventKind::CreditScoreIncreased => {
                if let Some(delta) = entry.credit_delta {
                    out.push(ReasoningOutcomeItem {
                        label: "信用分增加".into(),
                        description: format!(
                            "信用分从 {} 变为 {}（变化 +{}）。",
                            entry.credit_score_before.unwrap_or_default(),
                            entry.credit_score_after.unwrap_or_default(),
                            delta
                        ),
                    });
                }
            }
            TimelineEventKind::ReviewOpened => out.push(ReasoningOutcomeItem {
                label: "进入人工复核".into(),
                description: "该事项已进入人工复核队列。".into(),
            }),
            TimelineEventKind::ReviewRejected => out.push(ReasoningOutcomeItem {
                label: "人工复核驳回".into(),
                description: "人工复核未通过，后续动作被驳回。".into(),
            }),
            TimelineEventKind::ReviewApproved => out.push(ReasoningOutcomeItem {
                label: "人工复核通过".into(),
                description: "人工复核通过，后续流程可继续。".into(),
            }),
            TimelineEventKind::ModerationRestrictionApplied => out.push(ReasoningOutcomeItem {
                label: "治理限制生效".into(),
                description: entry.message.clone(),
            }),
            _ => {}
        }
    }

    out
}

pub fn user_actions_from_decision_code(code: &str) -> Vec<ReasoningActionItem> {
    match code {
        "ts_block_self_bidding" => vec![
            ReasoningActionItem {
                label: "停止参与自己作品竞拍".into(),
                description: "平台禁止当前 owner 参与自己作品竞拍。".into(),
            },
            ReasoningActionItem {
                label: "等待限制期结束".into(),
                description: "如已触发处罚，请在限制期结束后再发起相关操作。".into(),
            },
        ],
        "credit_warning_triggered" => vec![ReasoningActionItem {
            label: "提升信用积分".into(),
            description: "通过合规交易与正常履约逐步恢复信用。".into(),
        }],
        "ts_review_high_value_trade" => vec![ReasoningActionItem {
            label: "等待人工复核".into(),
            description: "高额交易需先通过平台人工复核。".into(),
        }],
        _ => vec![],
    }
}

pub fn operator_actions_default() -> Vec<ReasoningActionItem> {
    vec![
        ReasoningActionItem {
            label: "查看完整治理时间线".into(),
            description: "检查 dispute、reputation、moderation、review 全链路。".into(),
        },
        ReasoningActionItem {
            label: "查看决策图谱".into(),
            description: "确认规则命中、后果传播与治理因果链。".into(),
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::{outcomes_from_timeline, reasons_from_rule_audit};
    use crate::css_governance_timeline::types::{
        GovernanceTimelineEntry, TimelineEventKind, TimelineSubjectKind,
    };
    use crate::css_rule_audit::types::{CssRuleAuditRecord, RuleAuditDecision, RuleCheckResult};

    #[test]
    fn v176_reasons_only_include_matched_checks() {
        let audit = CssRuleAuditRecord {
            audit_id: "audit_1".into(),
            actor_user_id: "user_1".into(),
            action: "submit_bid".into(),
            subject_kind: "catalog".into(),
            subject_id: "catalog_1".into(),
            policy_version_id: "policy_v2".into(),
            checks: vec![
                RuleCheckResult {
                    rule_key: "auction.self_bidding_forbidden".into(),
                    rule_value: "true".into(),
                    matched: true,
                    outcome: "deny".into(),
                    message: "命中规则".into(),
                },
                RuleCheckResult {
                    rule_key: "credit.low_warning_threshold".into(),
                    rule_value: "600".into(),
                    matched: false,
                    outcome: "none".into(),
                    message: "未命中".into(),
                },
            ],
            final_decision: RuleAuditDecision::Deny,
            final_code: "ts_block_self_bidding".into(),
            final_message: "blocked".into(),
            source_system: "css_ts_runtime".into(),
            created_at: "2026-03-12T00:00:00Z".into(),
        };

        let reasons = reasons_from_rule_audit(&audit);
        assert_eq!(reasons.len(), 1);
        assert_eq!(
            reasons[0].rule_key.as_deref(),
            Some("auction.self_bidding_forbidden")
        );
    }

    #[test]
    fn v176_outcomes_translate_credit_changes() {
        let entries = vec![GovernanceTimelineEntry {
            timeline_id: "gtl_1".into(),
            subject_kind: TimelineSubjectKind::User,
            subject_id: "user_1".into(),
            event_kind: TimelineEventKind::CreditScoreDecreased,
            source_system: "css_credit".into(),
            source_id: "disp_1".into(),
            message: "credit down".into(),
            actor_user_id: Some("user_1".into()),
            credit_score_before: Some(700),
            credit_score_after: Some(660),
            credit_delta: Some(-40),
            created_at: "2026-03-12T00:00:00Z".into(),
        }];

        let outcomes = outcomes_from_timeline(&entries);
        assert_eq!(outcomes.len(), 1);
        assert!(outcomes[0].description.contains("700"));
        assert!(outcomes[0].description.contains("660"));
    }
}
