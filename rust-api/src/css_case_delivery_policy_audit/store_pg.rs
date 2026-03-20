use crate::css_case_delivery_policy_audit::types::{
    CssCaseDeliveryPolicyAuditRecord, DeliveryPolicyAuditAction, DeliveryPolicyAuditQueryRequest,
};
use sqlx::Row;

pub const CREATE_CSS_CASE_DELIVERY_POLICY_AUDITS_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_case_delivery_policy_audits (
    policy_audit_id TEXT PRIMARY KEY,
    actor_user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    from_policy_version_id TEXT,
    to_policy_version_id TEXT,
    reason TEXT,
    created_at TIMESTAMP NOT NULL
)
"#;

pub const CREATE_CSS_CASE_DELIVERY_POLICY_AUDITS_ACTOR_INDEX_SQL: &str = r#"
CREATE INDEX IF NOT EXISTS idx_css_case_delivery_policy_audits_actor_user_id
ON css_case_delivery_policy_audits(actor_user_id)
"#;

pub const CREATE_CSS_CASE_DELIVERY_POLICY_AUDITS_ACTION_INDEX_SQL: &str = r#"
CREATE INDEX IF NOT EXISTS idx_css_case_delivery_policy_audits_action
ON css_case_delivery_policy_audits(action)
"#;

pub const CREATE_CSS_CASE_DELIVERY_POLICY_AUDITS_FROM_VERSION_INDEX_SQL: &str = r#"
CREATE INDEX IF NOT EXISTS idx_css_case_delivery_policy_audits_from_policy_version_id
ON css_case_delivery_policy_audits(from_policy_version_id)
"#;

pub const CREATE_CSS_CASE_DELIVERY_POLICY_AUDITS_TO_VERSION_INDEX_SQL: &str = r#"
CREATE INDEX IF NOT EXISTS idx_css_case_delivery_policy_audits_to_policy_version_id
ON css_case_delivery_policy_audits(to_policy_version_id)
"#;

pub const CREATE_CSS_CASE_DELIVERY_POLICY_AUDITS_CREATED_AT_INDEX_SQL: &str = r#"
CREATE INDEX IF NOT EXISTS idx_css_case_delivery_policy_audits_created_at
ON css_case_delivery_policy_audits(created_at)
"#;

pub async fn insert_delivery_policy_audit(
    pool: &sqlx::PgPool,
    record: &CssCaseDeliveryPolicyAuditRecord,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO css_case_delivery_policy_audits (
            policy_audit_id, actor_user_id, action, from_policy_version_id,
            to_policy_version_id, reason, created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        "#,
    )
    .bind(&record.policy_audit_id)
    .bind(&record.actor_user_id)
    .bind(action_to_db(&record.action))
    .bind(&record.from_policy_version_id)
    .bind(&record.to_policy_version_id)
    .bind(&record.reason)
    .bind(&record.created_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_delivery_policy_audit(
    pool: &sqlx::PgPool,
    policy_audit_id: &str,
) -> anyhow::Result<Option<CssCaseDeliveryPolicyAuditRecord>> {
    let row = sqlx::query(
        r#"
        SELECT policy_audit_id, actor_user_id, action, from_policy_version_id,
               to_policy_version_id, reason, created_at::text AS created_at
        FROM css_case_delivery_policy_audits
        WHERE policy_audit_id = $1
        "#,
    )
    .bind(policy_audit_id)
    .fetch_optional(pool)
    .await?;

    row.map(row_to_policy_audit).transpose()
}

pub async fn list_delivery_policy_audits(
    pool: &sqlx::PgPool,
    req: &DeliveryPolicyAuditQueryRequest,
) -> anyhow::Result<Vec<CssCaseDeliveryPolicyAuditRecord>> {
    let limit = req.limit.unwrap_or(50) as i64;
    let policy_version_id = req
        .policy_version_id
        .as_deref()
        .or(req.policy_id.as_deref());

    let rows = match (
        policy_version_id,
        req.actor_user_id.as_deref(),
        req.action.as_ref(),
    ) {
        (Some(policy_version_id), Some(actor_user_id), Some(action)) => {
            sqlx::query(
                r#"
                SELECT policy_audit_id, actor_user_id, action, from_policy_version_id,
                       to_policy_version_id, reason, created_at::text AS created_at
                FROM css_case_delivery_policy_audits
                WHERE (
                    from_policy_version_id = $1 OR to_policy_version_id = $1
                ) AND actor_user_id = $2 AND action = $3
                ORDER BY created_at DESC, policy_audit_id DESC
                LIMIT $4
                "#,
            )
            .bind(policy_version_id)
            .bind(actor_user_id)
            .bind(action_to_db(action))
            .bind(limit)
            .fetch_all(pool)
            .await?
        }
        (Some(policy_version_id), Some(actor_user_id), None) => {
            sqlx::query(
                r#"
                SELECT policy_audit_id, actor_user_id, action, from_policy_version_id,
                       to_policy_version_id, reason, created_at::text AS created_at
                FROM css_case_delivery_policy_audits
                WHERE (
                    from_policy_version_id = $1 OR to_policy_version_id = $1
                ) AND actor_user_id = $2
                ORDER BY created_at DESC, policy_audit_id DESC
                LIMIT $3
                "#,
            )
            .bind(policy_version_id)
            .bind(actor_user_id)
            .bind(limit)
            .fetch_all(pool)
            .await?
        }
        (Some(policy_version_id), None, Some(action)) => {
            sqlx::query(
                r#"
                SELECT policy_audit_id, actor_user_id, action, from_policy_version_id,
                       to_policy_version_id, reason, created_at::text AS created_at
                FROM css_case_delivery_policy_audits
                WHERE (
                    from_policy_version_id = $1 OR to_policy_version_id = $1
                ) AND action = $2
                ORDER BY created_at DESC, policy_audit_id DESC
                LIMIT $3
                "#,
            )
            .bind(policy_version_id)
            .bind(action_to_db(action))
            .bind(limit)
            .fetch_all(pool)
            .await?
        }
        (Some(policy_version_id), None, None) => {
            sqlx::query(
                r#"
                SELECT policy_audit_id, actor_user_id, action, from_policy_version_id,
                       to_policy_version_id, reason, created_at::text AS created_at
                FROM css_case_delivery_policy_audits
                WHERE from_policy_version_id = $1 OR to_policy_version_id = $1
                ORDER BY created_at DESC, policy_audit_id DESC
                LIMIT $2
                "#,
            )
            .bind(policy_version_id)
            .bind(limit)
            .fetch_all(pool)
            .await?
        }
        (None, Some(actor_user_id), Some(action)) => {
            sqlx::query(
                r#"
                SELECT policy_audit_id, actor_user_id, action, from_policy_version_id,
                       to_policy_version_id, reason, created_at::text AS created_at
                FROM css_case_delivery_policy_audits
                WHERE actor_user_id = $1 AND action = $2
                ORDER BY created_at DESC, policy_audit_id DESC
                LIMIT $3
                "#,
            )
            .bind(actor_user_id)
            .bind(action_to_db(action))
            .bind(limit)
            .fetch_all(pool)
            .await?
        }
        (None, Some(actor_user_id), None) => {
            sqlx::query(
                r#"
                SELECT policy_audit_id, actor_user_id, action, from_policy_version_id,
                       to_policy_version_id, reason, created_at::text AS created_at
                FROM css_case_delivery_policy_audits
                WHERE actor_user_id = $1
                ORDER BY created_at DESC, policy_audit_id DESC
                LIMIT $2
                "#,
            )
            .bind(actor_user_id)
            .bind(limit)
            .fetch_all(pool)
            .await?
        }
        (None, None, Some(action)) => {
            sqlx::query(
                r#"
                SELECT policy_audit_id, actor_user_id, action, from_policy_version_id,
                       to_policy_version_id, reason, created_at::text AS created_at
                FROM css_case_delivery_policy_audits
                WHERE action = $1
                ORDER BY created_at DESC, policy_audit_id DESC
                LIMIT $2
                "#,
            )
            .bind(action_to_db(action))
            .bind(limit)
            .fetch_all(pool)
            .await?
        }
        (None, None, None) => {
            sqlx::query(
                r#"
                SELECT policy_audit_id, actor_user_id, action, from_policy_version_id,
                       to_policy_version_id, reason, created_at::text AS created_at
                FROM css_case_delivery_policy_audits
                ORDER BY created_at DESC, policy_audit_id DESC
                LIMIT $1
                "#,
            )
            .bind(limit)
            .fetch_all(pool)
            .await?
        }
    };

    rows.into_iter().map(row_to_policy_audit).collect()
}

pub async fn list_delivery_policy_audits_for_version(
    pool: &sqlx::PgPool,
    policy_version_id: &str,
) -> anyhow::Result<Vec<CssCaseDeliveryPolicyAuditRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT policy_audit_id, actor_user_id, action, from_policy_version_id,
               to_policy_version_id, reason, created_at::text AS created_at
        FROM css_case_delivery_policy_audits
        WHERE from_policy_version_id = $1 OR to_policy_version_id = $1
        ORDER BY created_at DESC, policy_audit_id DESC
        "#,
    )
    .bind(policy_version_id)
    .fetch_all(pool)
    .await?;

    rows.into_iter().map(row_to_policy_audit).collect()
}

pub async fn insert_policy_audit(
    pool: &sqlx::PgPool,
    record: &CssCaseDeliveryPolicyAuditRecord,
) -> anyhow::Result<()> {
    insert_delivery_policy_audit(pool, record).await
}

pub async fn get_policy_audit(
    pool: &sqlx::PgPool,
    policy_audit_id: &str,
) -> anyhow::Result<Option<CssCaseDeliveryPolicyAuditRecord>> {
    get_delivery_policy_audit(pool, policy_audit_id).await
}

pub async fn list_policy_audits(
    pool: &sqlx::PgPool,
    req: &DeliveryPolicyAuditQueryRequest,
) -> anyhow::Result<Vec<CssCaseDeliveryPolicyAuditRecord>> {
    list_delivery_policy_audits(pool, req).await
}

pub async fn list_policy_audits_for_policy(
    pool: &sqlx::PgPool,
    policy_id: &str,
) -> anyhow::Result<Vec<CssCaseDeliveryPolicyAuditRecord>> {
    list_delivery_policy_audits_for_version(pool, policy_id).await
}

fn action_to_db(action: &DeliveryPolicyAuditAction) -> &'static str {
    match action {
        DeliveryPolicyAuditAction::Created => "created",
        DeliveryPolicyAuditAction::Activated => "activated",
        DeliveryPolicyAuditAction::Switched => "switched",
        DeliveryPolicyAuditAction::Compared => "compared",
        DeliveryPolicyAuditAction::RolledBack => "rolled_back",
    }
}

fn action_from_db(value: &str) -> anyhow::Result<DeliveryPolicyAuditAction> {
    match value {
        "create_version" | "created" => Ok(DeliveryPolicyAuditAction::Created),
        "activate_version" | "activated" => Ok(DeliveryPolicyAuditAction::Activated),
        "switch_active_version" | "switched" => Ok(DeliveryPolicyAuditAction::Switched),
        "compare_versions" | "compared" => Ok(DeliveryPolicyAuditAction::Compared),
        "rollback_version" | "rolled_back" => Ok(DeliveryPolicyAuditAction::RolledBack),
        other => anyhow::bail!("unknown delivery policy audit action: {other}"),
    }
}

fn row_to_policy_audit(
    row: sqlx::postgres::PgRow,
) -> anyhow::Result<CssCaseDeliveryPolicyAuditRecord> {
    Ok(CssCaseDeliveryPolicyAuditRecord {
        policy_audit_id: row
            .try_get("policy_audit_id")
            .or_else(|_| row.try_get("audit_id"))?,
        actor_user_id: row
            .try_get("actor_user_id")
            .unwrap_or_else(|_| "system".to_string()),
        action: action_from_db(&row.try_get::<String, _>("action")?)?,
        from_policy_version_id: row
            .try_get("from_policy_version_id")
            .ok()
            .or_else(|| row.try_get("policy_version_id").ok()),
        to_policy_version_id: row.try_get("to_policy_version_id").ok(),
        reason: row
            .try_get("reason")
            .ok()
            .or_else(|| row.try_get("message").ok()),
        created_at: row.try_get("created_at")?,
    })
}
