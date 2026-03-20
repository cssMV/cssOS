use crate::css_rule_audit::types::{
    CssRuleAuditRecord, RuleAuditAppendRequest, RuleAuditDecision, RuleCheckResult,
};

pub async fn append_rule_audit(
    pool: &sqlx::PgPool,
    req: RuleAuditAppendRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssRuleAuditRecord> {
    let record = CssRuleAuditRecord {
        audit_id: format!("raud_{}", uuid::Uuid::new_v4()),
        actor_user_id: req.actor_user_id,
        action: req.action,
        subject_kind: req.subject_kind,
        subject_id: req.subject_id,
        policy_version_id: req.policy_version_id,
        checks: req.checks,
        final_decision: req.final_decision,
        final_code: req.final_code,
        final_message: req.final_message,
        source_system: req.source_system,
        created_at: now_rfc3339.to_string(),
    };

    crate::css_rule_audit::store_pg::insert_rule_audit(pool, &record).await?;
    let _ = crate::css_decision_graph::runtime::append_from_rule_audit(pool, &record, now_rfc3339)
        .await;
    let snapshot_subject_kind = match record.subject_kind.as_str() {
        "user" => Some(crate::css_signals_snapshot::types::SnapshotSubjectKind::User),
        "catalog" | "auction" => {
            Some(crate::css_signals_snapshot::types::SnapshotSubjectKind::Catalog)
        }
        "deal" => Some(crate::css_signals_snapshot::types::SnapshotSubjectKind::Deal),
        "ownership" => Some(crate::css_signals_snapshot::types::SnapshotSubjectKind::Ownership),
        _ => None,
    };
    if let Some(snapshot_subject_kind) = snapshot_subject_kind {
        let _ = crate::css_signals_snapshot::runtime::create_snapshot(
            pool,
            crate::css_signals_snapshot::types::SnapshotCreateRequest {
                subject_kind: snapshot_subject_kind,
                subject_id: record.subject_id.clone(),
                purpose: crate::css_signals_snapshot::types::SnapshotPurpose::AuditEvidence,
                related_audit_id: Some(record.audit_id.clone()),
                related_review_id: None,
                related_deal_id: None,
                related_dispute_id: None,
                source_system: "css_rule_audit".into(),
            },
            now_rfc3339,
        )
        .await;
    }
    Ok(record)
}

pub async fn audit_submit_bid(
    pool: &sqlx::PgPool,
    actor_user_id: &str,
    catalog_id: &str,
    policy_version_id: &str,
    self_bidding_forbidden: bool,
    is_owner_self_bid: bool,
    final_decision: RuleAuditDecision,
    final_code: &str,
    final_message: &str,
    now_rfc3339: &str,
) -> anyhow::Result<()> {
    let checks = vec![RuleCheckResult {
        rule_key: "auction.self_bidding_forbidden".into(),
        rule_value: self_bidding_forbidden.to_string(),
        matched: is_owner_self_bid,
        outcome: if is_owner_self_bid && self_bidding_forbidden {
            "deny".into()
        } else {
            "allow".into()
        },
        message: if is_owner_self_bid && self_bidding_forbidden {
            "命中 owner 禁止参与自己作品竞拍规则。".into()
        } else {
            "未命中 owner 自竞拍阻断规则。".into()
        },
    }];

    let _ = append_rule_audit(
        pool,
        RuleAuditAppendRequest {
            actor_user_id: actor_user_id.to_string(),
            action: "submit_bid".into(),
            subject_kind: "catalog".into(),
            subject_id: catalog_id.to_string(),
            policy_version_id: policy_version_id.to_string(),
            checks,
            final_decision,
            final_code: final_code.to_string(),
            final_message: final_message.to_string(),
            source_system: "css_ts_runtime".into(),
        },
        now_rfc3339,
    )
    .await?;

    Ok(())
}

pub async fn audit_credit_warning(
    pool: &sqlx::PgPool,
    actor_user_id: &str,
    subject_user_id: &str,
    policy_version_id: &str,
    low_warning_threshold: i32,
    score: i32,
    now_rfc3339: &str,
) -> anyhow::Result<()> {
    let matched = score < low_warning_threshold;
    let checks = vec![RuleCheckResult {
        rule_key: "credit.low_warning_threshold".into(),
        rule_value: low_warning_threshold.to_string(),
        matched,
        outcome: if matched {
            "warning".into()
        } else {
            "none".into()
        },
        message: format!(
            "当前信用分 {}，低信用提醒阈值 {}",
            score, low_warning_threshold
        ),
    }];

    let _ = append_rule_audit(
        pool,
        RuleAuditAppendRequest {
            actor_user_id: actor_user_id.to_string(),
            action: "credit_warning_check".into(),
            subject_kind: "user".into(),
            subject_id: subject_user_id.to_string(),
            policy_version_id: policy_version_id.to_string(),
            checks,
            final_decision: if matched {
                RuleAuditDecision::Restrict
            } else {
                RuleAuditDecision::Allow
            },
            final_code: if matched {
                "credit_warning_triggered".into()
            } else {
                "credit_warning_not_triggered".into()
            },
            final_message: if matched {
                "命中低信用提醒规则。".into()
            } else {
                "未命中低信用提醒规则。".into()
            },
            source_system: "css_market_view".into(),
        },
        now_rfc3339,
    )
    .await?;

    Ok(())
}

pub async fn resolve_policy_version_id_for_subject(
    pool: &sqlx::PgPool,
    subject_kind: crate::css_policy_versioning::types::PolicyBindingSubjectKind,
    subject_id: &str,
) -> String {
    match crate::css_policy_versioning::runtime::resolve_policy_for_subject(
        pool,
        subject_kind,
        subject_id,
    )
    .await
    {
        Ok(resolved) => resolved.version.version_id,
        Err(_) => "policy_unresolved".into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v174_rule_check_captures_key_fields() {
        let check = RuleCheckResult {
            rule_key: "auction.self_bidding_forbidden".into(),
            rule_value: "true".into(),
            matched: true,
            outcome: "deny".into(),
            message: "matched".into(),
        };
        assert_eq!(check.rule_key, "auction.self_bidding_forbidden");
        assert!(check.matched);
    }
}
