use crate::css_rule_audit::types::{CssRuleAuditRecord, RuleAuditDecision};
use sqlx::Row;

pub const CREATE_CSS_RULE_AUDITS_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_rule_audits (
    audit_id TEXT PRIMARY KEY,
    actor_user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    subject_kind TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    policy_version_id TEXT NOT NULL,
    checks_json JSONB NOT NULL,
    final_decision TEXT NOT NULL,
    final_code TEXT NOT NULL,
    final_message TEXT NOT NULL,
    source_system TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
)
"#;

pub async fn insert_rule_audit(
    pool: &sqlx::PgPool,
    record: &CssRuleAuditRecord,
) -> anyhow::Result<()> {
    let checks = serde_json::to_value(&record.checks)?;
    sqlx::query(
        r#"
        INSERT INTO css_rule_audits (
            audit_id, actor_user_id, action, subject_kind, subject_id,
            policy_version_id, checks_json, final_decision, final_code,
            final_message, source_system, created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        "#,
    )
    .bind(&record.audit_id)
    .bind(&record.actor_user_id)
    .bind(&record.action)
    .bind(&record.subject_kind)
    .bind(&record.subject_id)
    .bind(&record.policy_version_id)
    .bind(checks)
    .bind(decision_to_db(&record.final_decision))
    .bind(&record.final_code)
    .bind(&record.final_message)
    .bind(&record.source_system)
    .bind(&record.created_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_rule_audit(
    pool: &sqlx::PgPool,
    audit_id: &str,
) -> anyhow::Result<CssRuleAuditRecord> {
    let row = sqlx::query(
        r#"
        SELECT audit_id, actor_user_id, action, subject_kind, subject_id,
               policy_version_id, checks_json, final_decision, final_code,
               final_message, source_system, created_at::text AS created_at
        FROM css_rule_audits
        WHERE audit_id = $1
        "#,
    )
    .bind(audit_id)
    .fetch_one(pool)
    .await?;
    row_to_rule_audit(row)
}

pub async fn list_rule_audits_for_subject(
    pool: &sqlx::PgPool,
    subject_kind: &str,
    subject_id: &str,
) -> anyhow::Result<Vec<CssRuleAuditRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT audit_id, actor_user_id, action, subject_kind, subject_id,
               policy_version_id, checks_json, final_decision, final_code,
               final_message, source_system, created_at::text AS created_at
        FROM css_rule_audits
        WHERE subject_kind = $1 AND subject_id = $2
        ORDER BY created_at DESC
        "#,
    )
    .bind(subject_kind)
    .bind(subject_id)
    .fetch_all(pool)
    .await?;

    rows.into_iter().map(row_to_rule_audit).collect()
}

pub async fn list_rule_audits_for_actor(
    pool: &sqlx::PgPool,
    actor_user_id: &str,
) -> anyhow::Result<Vec<CssRuleAuditRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT audit_id, actor_user_id, action, subject_kind, subject_id,
               policy_version_id, checks_json, final_decision, final_code,
               final_message, source_system, created_at::text AS created_at
        FROM css_rule_audits
        WHERE actor_user_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(actor_user_id)
    .fetch_all(pool)
    .await?;

    rows.into_iter().map(row_to_rule_audit).collect()
}

fn decision_to_db(decision: &RuleAuditDecision) -> &'static str {
    match decision {
        RuleAuditDecision::Allow => "allow",
        RuleAuditDecision::Deny => "deny",
        RuleAuditDecision::Restrict => "restrict",
        RuleAuditDecision::Freeze => "freeze",
        RuleAuditDecision::ReviewRequired => "review_required",
    }
}

fn decision_from_db(value: &str) -> anyhow::Result<RuleAuditDecision> {
    match value {
        "allow" => Ok(RuleAuditDecision::Allow),
        "deny" => Ok(RuleAuditDecision::Deny),
        "restrict" => Ok(RuleAuditDecision::Restrict),
        "freeze" => Ok(RuleAuditDecision::Freeze),
        "review_required" => Ok(RuleAuditDecision::ReviewRequired),
        other => anyhow::bail!("unknown rule audit decision: {other}"),
    }
}

fn row_to_rule_audit(row: sqlx::postgres::PgRow) -> anyhow::Result<CssRuleAuditRecord> {
    let checks_json: serde_json::Value = row.try_get("checks_json")?;
    Ok(CssRuleAuditRecord {
        audit_id: row.try_get("audit_id")?,
        actor_user_id: row.try_get("actor_user_id")?,
        action: row.try_get("action")?,
        subject_kind: row.try_get("subject_kind")?,
        subject_id: row.try_get("subject_id")?,
        policy_version_id: row.try_get("policy_version_id")?,
        checks: serde_json::from_value(checks_json)?,
        final_decision: decision_from_db(&row.try_get::<String, _>("final_decision")?)?,
        final_code: row.try_get("final_code")?,
        final_message: row.try_get("final_message")?,
        source_system: row.try_get("source_system")?,
        created_at: row.try_get("created_at")?,
    })
}
