use crate::css_governance_timeline::types::TimelineSubjectKind;
use crate::css_reasoning_view::types::{
    ApiReasoningView, CssReasoningView, ReasoningAudience, ReasoningReasonItem,
};

pub async fn build_operator_reasoning(
    pool: &sqlx::PgPool,
    audit_id: &str,
    subject_kind: TimelineSubjectKind,
    subject_id: &str,
) -> anyhow::Result<CssReasoningView> {
    let audit = crate::css_rule_audit::store_pg::get_rule_audit(pool, audit_id).await?;
    let timeline = crate::css_governance_timeline::store_pg::list_timeline_for_subject(
        pool,
        subject_kind,
        subject_id,
    )
    .await?;

    Ok(CssReasoningView {
        audience: ReasoningAudience::Operator,
        summary: audit.final_message.clone(),
        reasons: crate::css_reasoning_view::composer::reasons_from_rule_audit(&audit),
        outcomes: crate::css_reasoning_view::composer::outcomes_from_timeline(&timeline),
        suggested_actions: crate::css_reasoning_view::composer::operator_actions_default(),
    })
}

pub async fn build_user_reasoning(
    pool: &sqlx::PgPool,
    audit_id: &str,
    subject_kind: TimelineSubjectKind,
    subject_id: &str,
) -> anyhow::Result<CssReasoningView> {
    let audit = crate::css_rule_audit::store_pg::get_rule_audit(pool, audit_id).await?;
    let timeline = crate::css_governance_timeline::store_pg::list_timeline_for_subject(
        pool,
        subject_kind,
        subject_id,
    )
    .await?;

    let reasons = crate::css_reasoning_view::composer::reasons_from_rule_audit(&audit)
        .into_iter()
        .map(|reason| ReasoningReasonItem {
            title: reason.title,
            explanation: reason.explanation,
            rule_key: None,
            policy_version_id: None,
        })
        .collect();

    Ok(CssReasoningView {
        audience: ReasoningAudience::User,
        summary: audit.final_message.clone(),
        reasons,
        outcomes: crate::css_reasoning_view::composer::outcomes_from_timeline(&timeline),
        suggested_actions: crate::css_reasoning_view::composer::user_actions_from_decision_code(
            &audit.final_code,
        ),
    })
}

pub async fn build_api_reasoning(
    pool: &sqlx::PgPool,
    audit_id: &str,
) -> anyhow::Result<ApiReasoningView> {
    let audit = crate::css_rule_audit::store_pg::get_rule_audit(pool, audit_id).await?;

    Ok(ApiReasoningView {
        code: audit.final_code.clone(),
        summary: audit.final_message.clone(),
        reason_keys: audit
            .checks
            .iter()
            .filter(|check| check.matched)
            .map(|check| check.rule_key.clone())
            .collect(),
        outcome_labels: vec![format!("{:?}", audit.final_decision).to_lowercase()],
        suggested_action_labels:
            crate::css_reasoning_view::composer::user_actions_from_decision_code(&audit.final_code)
                .into_iter()
                .map(|item| item.label)
                .collect(),
    })
}
