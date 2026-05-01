use std::collections::HashSet;

use axum::{
    extract::{Extension, Query},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::auth::AuthSession;
use crate::billing::ensure_account;
use crate::models::User;

fn no_store_headers() -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    headers
}

fn ok_json(data: Value) -> axum::response::Response {
    (
        StatusCode::OK,
        no_store_headers(),
        Json(json!({
            "ok": true,
            "status": "ok",
            "data": data
        })),
    )
        .into_response()
}

fn err_json(
    status: StatusCode,
    code: &str,
    message: impl Into<String>,
) -> axum::response::Response {
    (
        status,
        no_store_headers(),
        Json(json!({
            "ok": false,
            "code": code,
            "message": message.into()
        })),
    )
        .into_response()
}

fn normalize_email(value: &str) -> String {
    value.trim().to_ascii_lowercase()
}

fn admin_email_set() -> HashSet<String> {
    std::env::var("ADMIN_EMAILS")
        .unwrap_or_else(|_| "jingdudc@gmail.com,admin@cssstudio.app".to_string())
        .split(',')
        .map(normalize_email)
        .filter(|value| !value.is_empty())
        .collect()
}

fn normalize_membership_tier(raw: &str) -> &'static str {
    match raw.trim().to_ascii_lowercase().as_str() {
        "free" => "free",
        "starter" => "starter",
        "pro" => "pro",
        "studio" => "studio",
        "enterprise" => "enterprise",
        "vip" => "vip",
        "admin" => "admin",
        _ => "guest",
    }
}

fn normalize_boost_kind(raw: &str) -> Option<&'static str> {
    match raw.trim().to_ascii_lowercase().as_str() {
        "language" => Some("language"),
        "voice" => Some("voice"),
        "thumbnail" => Some("thumbnail"),
        "preview_video" => Some("preview_video"),
        _ => None,
    }
}

#[derive(Debug, Clone)]
struct AdminActor {
    user_id: Uuid,
    email: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
struct AdminUserActionRow {
    action_id: String,
    user_id: Option<Uuid>,
    target_email: String,
    action_kind: String,
    action_scope: String,
    quantity: i32,
    actor_user_id: Uuid,
    actor_email: Option<String>,
    note: Option<String>,
    meta: Value,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
struct AdminSearchUserRow {
    id: Uuid,
    email: Option<String>,
    display_name: Option<String>,
    tier: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MembershipSetRequest {
    email: Option<String>,
    tier: Option<String>,
}

#[derive(Debug, Deserialize)]
struct EntitlementActionRequest {
    email: Option<String>,
    boost_kind: Option<String>,
    quantity: Option<i32>,
    note: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FreezeUserRequest {
    email: Option<String>,
    note: Option<String>,
    reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SearchUsersQuery {
    q: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ListActionsQuery {
    email: Option<String>,
    q: Option<String>,
    limit: Option<i64>,
}

async fn ensure_admin_user_actions_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS admin_user_actions (
            action_id TEXT PRIMARY KEY,
            user_id UUID NULL,
            target_email TEXT NOT NULL,
            action_kind TEXT NOT NULL,
            action_scope TEXT NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 0,
            actor_user_id UUID NOT NULL,
            actor_email TEXT NULL,
            note TEXT NULL,
            meta JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        "#,
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_admin_user_actions_target_email_created_at ON admin_user_actions (lower(target_email), created_at DESC)",
    )
    .execute(pool)
    .await?;
    Ok(())
}

async fn append_admin_user_action(
    pool: &PgPool,
    target_user_id: Option<Uuid>,
    target_email: &str,
    action_kind: &str,
    action_scope: &str,
    quantity: i32,
    actor: &AdminActor,
    note: Option<&str>,
    meta: Value,
) -> Result<String, sqlx::Error> {
    ensure_admin_user_actions_table(pool).await?;
    let action_id = format!("aua_{}", Uuid::new_v4().simple());
    sqlx::query(
        r#"
        INSERT INTO admin_user_actions (
            action_id, user_id, target_email, action_kind, action_scope, quantity,
            actor_user_id, actor_email, note, meta
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        "#,
    )
    .bind(&action_id)
    .bind(target_user_id)
    .bind(target_email)
    .bind(action_kind)
    .bind(action_scope)
    .bind(quantity)
    .bind(actor.user_id)
    .bind(&actor.email)
    .bind(note.unwrap_or("").trim())
    .bind(meta)
    .execute(pool)
    .await?;
    Ok(action_id)
}

async fn list_admin_user_actions(
    pool: &PgPool,
    target_email: &str,
    limit: i64,
) -> Result<Vec<AdminUserActionRow>, sqlx::Error> {
    ensure_admin_user_actions_table(pool).await?;
    sqlx::query_as::<_, AdminUserActionRow>(
        r#"
        SELECT action_id, user_id, target_email, action_kind, action_scope, quantity,
               actor_user_id, actor_email, note, meta, created_at
          FROM admin_user_actions
         WHERE lower(target_email) = lower($1)
         ORDER BY created_at DESC
         LIMIT $2
        "#,
    )
    .bind(target_email)
    .bind(limit)
    .fetch_all(pool)
    .await
}

async fn load_admin_actor(
    pool: &PgPool,
    session: &AuthSession,
) -> Result<AdminActor, axum::response::Response> {
    let Some(user_id) = session.user_id else {
        return Err(err_json(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "Administrator session required",
        ));
    };
    let maybe_user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1 LIMIT 1")
        .bind(user_id)
        .fetch_optional(pool)
        .await
        .map_err(|_| {
            err_json(
                StatusCode::INTERNAL_SERVER_ERROR,
                "ADMIN_LOOKUP_FAILED",
                "Could not resolve administrator",
            )
        })?;
    let Some(user) = maybe_user else {
        return Err(err_json(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "Administrator session required",
        ));
    };
    let email = normalize_email(user.email.as_deref().unwrap_or(""));
    if user.role != "admin" && !admin_email_set().contains(&email) {
        return Err(err_json(
            StatusCode::FORBIDDEN,
            "FORBIDDEN",
            "Administrator role required",
        ));
    }
    Ok(AdminActor { user_id, email })
}

async fn resolve_target_user(
    pool: &PgPool,
    target_email: &str,
) -> Result<(Uuid, String), axum::response::Response> {
    let maybe_user =
        sqlx::query_as::<_, User>("SELECT * FROM users WHERE lower(email) = lower($1) LIMIT 1")
            .bind(target_email)
            .fetch_optional(pool)
            .await
            .map_err(|_| {
                err_json(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "TARGET_LOOKUP_FAILED",
                    "Could not resolve target user",
                )
            })?;
    let Some(user) = maybe_user else {
        return Err(err_json(
            StatusCode::NOT_FOUND,
            "TARGET_USER_NOT_FOUND",
            "Target user was not found",
        ));
    };
    Ok((
        user.id,
        normalize_email(user.email.as_deref().unwrap_or(target_email)),
    ))
}

async fn set_membership(
    Extension(pool): Extension<PgPool>,
    session: AuthSession,
    Json(body): Json<MembershipSetRequest>,
) -> axum::response::Response {
    let actor = match load_admin_actor(&pool, &session).await {
        Ok(actor) => actor,
        Err(resp) => return resp,
    };
    let target_email = normalize_email(body.email.as_deref().unwrap_or(""));
    let target_tier = normalize_membership_tier(body.tier.as_deref().unwrap_or(""));
    if target_email.is_empty() {
        return err_json(
            StatusCode::BAD_REQUEST,
            "TARGET_EMAIL_REQUIRED",
            "Target email is required",
        );
    }
    if target_tier == "guest" {
        return err_json(
            StatusCode::BAD_REQUEST,
            "TARGET_TIER_INVALID",
            "Target tier is invalid",
        );
    }
    let (target_user_id, resolved_email) = match resolve_target_user(&pool, &target_email).await {
        Ok(result) => result,
        Err(resp) => return resp,
    };
    if ensure_account(&pool, target_user_id).await.is_err() {
        return err_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            "BILLING_ACCOUNT_ENSURE_FAILED",
            "Could not ensure billing account",
        );
    }
    if sqlx::query(
        r#"
        UPDATE billing_accounts
           SET membership_tier = $2,
               membership_source = 'admin_manual',
               membership_updated_at = now(),
               updated_at = now()
         WHERE user_id = $1
        "#,
    )
    .bind(target_user_id)
    .bind(target_tier)
    .execute(&pool)
    .await
    .is_err()
    {
        return err_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            "ADMIN_MEMBERSHIP_SET_FAILED",
            "Could not update membership",
        );
    }
    let _ = append_admin_user_action(
        &pool,
        Some(target_user_id),
        &resolved_email,
        "membership_set",
        "membership",
        0,
        &actor,
        Some(&format!("tier -> {target_tier}")),
        json!({ "tier": target_tier }),
    )
    .await;
    ok_json(json!({
        "user_id": target_user_id,
        "email": resolved_email,
        "tier": target_tier,
        "updated": true
    }))
}

async fn grant_entitlement(
    Extension(pool): Extension<PgPool>,
    session: AuthSession,
    Json(body): Json<EntitlementActionRequest>,
) -> axum::response::Response {
    let actor = match load_admin_actor(&pool, &session).await {
        Ok(actor) => actor,
        Err(resp) => return resp,
    };
    let target_email = normalize_email(body.email.as_deref().unwrap_or(""));
    let Some(boost_kind) = normalize_boost_kind(body.boost_kind.as_deref().unwrap_or("")) else {
        return err_json(
            StatusCode::BAD_REQUEST,
            "BOOST_KIND_INVALID",
            "Boost kind is invalid",
        );
    };
    let quantity = body.quantity.unwrap_or(1).clamp(1, 200);
    let note = body.note.unwrap_or_default();
    if target_email.is_empty() {
        return err_json(
            StatusCode::BAD_REQUEST,
            "TARGET_EMAIL_REQUIRED",
            "Target email is required",
        );
    }
    let (target_user_id, resolved_email) = match resolve_target_user(&pool, &target_email).await {
        Ok(result) => result,
        Err(resp) => return resp,
    };
    if sqlx::query(
        r#"
        INSERT INTO account_entitlements (
            user_id, entitlement_key, quantity, consumed_quantity, source, created_by_user_id, meta
        ) VALUES ($1, $2, $3, 0, 'admin_grant', $4, $5::jsonb)
        "#,
    )
    .bind(target_user_id)
    .bind(format!("boost.{boost_kind}"))
    .bind(quantity)
    .bind(actor.user_id)
    .bind(json!({
        "granted_by_email": actor.email,
        "note": note
    }))
    .execute(&pool)
    .await
    .is_err()
    {
        return err_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            "ADMIN_ENTITLEMENT_GRANT_FAILED",
            "Could not grant entitlement",
        );
    }
    let _ = append_admin_user_action(
        &pool,
        Some(target_user_id),
        &resolved_email,
        "entitlement_grant",
        "reward",
        quantity,
        &actor,
        Some(&note),
        json!({ "boost_kind": boost_kind }),
    )
    .await;
    ok_json(json!({
        "user_id": target_user_id,
        "email": resolved_email,
        "boost_kind": boost_kind,
        "quantity": quantity,
        "granted": true
    }))
}

async fn revoke_entitlement(
    Extension(pool): Extension<PgPool>,
    session: AuthSession,
    Json(body): Json<EntitlementActionRequest>,
) -> axum::response::Response {
    let actor = match load_admin_actor(&pool, &session).await {
        Ok(actor) => actor,
        Err(resp) => return resp,
    };
    let target_email = normalize_email(body.email.as_deref().unwrap_or(""));
    let Some(boost_kind) = normalize_boost_kind(body.boost_kind.as_deref().unwrap_or("")) else {
        return err_json(
            StatusCode::BAD_REQUEST,
            "BOOST_KIND_INVALID",
            "Boost kind is invalid",
        );
    };
    let quantity = body.quantity.unwrap_or(1).clamp(1, 200);
    if target_email.is_empty() {
        return err_json(
            StatusCode::BAD_REQUEST,
            "TARGET_EMAIL_REQUIRED",
            "Target email is required",
        );
    }
    let (target_user_id, resolved_email) = match resolve_target_user(&pool, &target_email).await {
        Ok(result) => result,
        Err(resp) => return resp,
    };
    let mut tx = match pool.begin().await {
        Ok(tx) => tx,
        Err(_) => {
            return err_json(
                StatusCode::INTERNAL_SERVER_ERROR,
                "ADMIN_ENTITLEMENT_REVOKE_FAILED",
                "Could not revoke entitlement",
            );
        }
    };
    let rows = match sqlx::query_as::<_, (Uuid, i32, i32)>(
        r#"
        SELECT id, quantity, consumed_quantity
          FROM account_entitlements
         WHERE user_id = $1
           AND entitlement_key = $2
           AND quantity > consumed_quantity
           AND (expires_at IS NULL OR expires_at > now())
         ORDER BY created_at DESC
         FOR UPDATE
        "#,
    )
    .bind(target_user_id)
    .bind(format!("boost.{boost_kind}"))
    .fetch_all(&mut *tx)
    .await
    {
        Ok(rows) => rows,
        Err(_) => {
            return err_json(
                StatusCode::INTERNAL_SERVER_ERROR,
                "ADMIN_ENTITLEMENT_REVOKE_FAILED",
                "Could not revoke entitlement",
            );
        }
    };
    let mut remaining = quantity;
    for (entitlement_id, total_quantity, consumed_quantity) in rows {
        if remaining <= 0 {
            break;
        }
        let available = (total_quantity - consumed_quantity).max(0);
        if available == 0 {
            continue;
        }
        let revoke_now = remaining.min(available);
        if sqlx::query(
            r#"
            UPDATE account_entitlements
               SET consumed_quantity = consumed_quantity + $2,
                   meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('last_revoked_by_email', $3, 'last_revoked_at', now()::text),
                   updated_at = now()
             WHERE id = $1
            "#,
        )
        .bind(entitlement_id)
        .bind(revoke_now)
        .bind(&actor.email)
        .execute(&mut *tx)
        .await
        .is_err()
        {
            return err_json(StatusCode::INTERNAL_SERVER_ERROR, "ADMIN_ENTITLEMENT_REVOKE_FAILED", "Could not revoke entitlement");
        }
        remaining -= revoke_now;
    }
    if tx.commit().await.is_err() {
        return err_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            "ADMIN_ENTITLEMENT_REVOKE_FAILED",
            "Could not revoke entitlement",
        );
    }
    let revoked = quantity - remaining;
    let _ = append_admin_user_action(
        &pool,
        Some(target_user_id),
        &resolved_email,
        "entitlement_revoke",
        if revoked > 0 { "penalty" } else { "notice" },
        revoked,
        &actor,
        Some(if revoked > 0 {
            "reward revoked"
        } else {
            "nothing to revoke"
        }),
        json!({
            "boost_kind": boost_kind,
            "requested_quantity": quantity,
            "revoked_quantity": revoked
        }),
    )
    .await;
    ok_json(json!({
        "user_id": target_user_id,
        "email": resolved_email,
        "boost_kind": boost_kind,
        "requested_quantity": quantity,
        "revoked_quantity": revoked,
        "revoked": revoked > 0
    }))
}

async fn search_users(
    Extension(pool): Extension<PgPool>,
    session: AuthSession,
    Query(query): Query<SearchUsersQuery>,
) -> axum::response::Response {
    if let Err(resp) = load_admin_actor(&pool, &session).await {
        return resp;
    }
    let q = normalize_email(query.q.as_deref().unwrap_or(""));
    if q.is_empty() {
        return ok_json(json!({ "users": [] }));
    }
    let like = format!("%{q}%");
    let rows = match sqlx::query_as::<_, AdminSearchUserRow>(
        r#"
        SELECT u.id,
               u.email,
               u.display_name,
               COALESCE(ba.membership_tier, 'free') AS tier
          FROM users u
          LEFT JOIN billing_accounts ba ON ba.user_id = u.id
         WHERE lower(COALESCE(u.email, '')) LIKE $1
            OR lower(COALESCE(u.display_name, '')) LIKE $1
            OR CAST(u.id AS text) = $2
         ORDER BY u.created_at DESC
         LIMIT 20
        "#,
    )
    .bind(&like)
    .bind(&q)
    .fetch_all(&pool)
    .await
    {
        Ok(rows) => rows,
        Err(_) => {
            return err_json(
                StatusCode::INTERNAL_SERVER_ERROR,
                "ADMIN_USER_SEARCH_FAILED",
                "Could not search users",
            )
        }
    };
    ok_json(json!({
        "users": rows.into_iter().map(|row| json!({
            "id": row.id,
            "email": row.email.unwrap_or_default(),
            "display_name": row.display_name.unwrap_or_default(),
            "tier": normalize_membership_tier(row.tier.as_deref().unwrap_or("free"))
        })).collect::<Vec<_>>()
    }))
}

async fn freeze_user(
    Extension(pool): Extension<PgPool>,
    session: AuthSession,
    Json(body): Json<FreezeUserRequest>,
) -> axum::response::Response {
    let actor = match load_admin_actor(&pool, &session).await {
        Ok(actor) => actor,
        Err(resp) => return resp,
    };
    let target_email = normalize_email(body.email.as_deref().unwrap_or(""));
    let reason = body
        .reason
        .or(body.note)
        .unwrap_or_default()
        .trim()
        .to_string();
    if target_email.is_empty() {
        return err_json(
            StatusCode::BAD_REQUEST,
            "TARGET_EMAIL_REQUIRED",
            "Target email is required",
        );
    }
    let (target_user_id, resolved_email) = match resolve_target_user(&pool, &target_email).await {
        Ok(result) => result,
        Err(resp) => return resp,
    };
    if ensure_account(&pool, target_user_id).await.is_err() {
        return err_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            "BILLING_ACCOUNT_ENSURE_FAILED",
            "Could not ensure billing account",
        );
    }
    let freeze_meta = json!({
        "active": true,
        "scope": "global",
        "by": actor.email,
        "reason": reason,
        "at": Utc::now().to_rfc3339()
    });
    if sqlx::query(
        r#"
        UPDATE billing_accounts
           SET membership_tier = 'free',
               membership_source = 'admin_freeze',
               membership_updated_at = now(),
               updated_at = now()
         WHERE user_id = $1
        "#,
    )
    .bind(target_user_id)
    .execute(&pool)
    .await
    .is_err()
    {
        return err_json(
            StatusCode::INTERNAL_SERVER_ERROR,
            "ADMIN_USER_FREEZE_FAILED",
            "Could not freeze user",
        );
    }
    if sqlx::query(
        r#"
        UPDATE users
           SET profile_json = COALESCE(profile_json, '{}'::jsonb) || jsonb_build_object('admin_freeze', $2::jsonb),
               updated_at = now()
         WHERE id = $1
        "#,
    )
    .bind(target_user_id)
    .bind(freeze_meta.clone())
    .execute(&pool)
    .await
    .is_err()
    {
        return err_json(StatusCode::INTERNAL_SERVER_ERROR, "ADMIN_USER_FREEZE_FAILED", "Could not persist freeze state");
    }
    let action_id = match append_admin_user_action(
        &pool,
        Some(target_user_id),
        &resolved_email,
        "freeze_user",
        "freeze",
        0,
        &actor,
        Some(if reason.is_empty() {
            "freeze requested by admin"
        } else {
            &reason
        }),
        json!({
            "frozen": true,
            "scope": "global",
            "enforced_membership_tier": "free"
        }),
    )
    .await
    {
        Ok(action_id) => action_id,
        Err(_) => String::new(),
    };
    ok_json(json!({
        "user_id": target_user_id,
        "email": resolved_email,
        "frozen": true,
        "scope": "global",
        "downgraded_tier": "free",
        "audit_action_id": action_id
    }))
}

async fn list_actions(
    Extension(pool): Extension<PgPool>,
    session: AuthSession,
    Query(query): Query<ListActionsQuery>,
) -> axum::response::Response {
    if let Err(resp) = load_admin_actor(&pool, &session).await {
        return resp;
    }
    let email = normalize_email(query.email.as_deref().or(query.q.as_deref()).unwrap_or(""));
    if email.is_empty() {
        return ok_json(json!({ "actions": [] }));
    }
    let limit = query.limit.unwrap_or(40).clamp(1, 100);
    let rows = match list_admin_user_actions(&pool, &email, limit).await {
        Ok(rows) => rows,
        Err(_) => {
            return err_json(
                StatusCode::INTERNAL_SERVER_ERROR,
                "ADMIN_USER_ACTIONS_FAILED",
                "Could not load admin user actions",
            );
        }
    };
    ok_json(json!({
        "actions": rows.into_iter().map(|row| json!({
            "action_id": row.action_id,
            "user_id": row.user_id,
            "target_email": row.target_email,
            "action_kind": row.action_kind,
            "action_scope": row.action_scope,
            "quantity": row.quantity,
            "actor_user_id": row.actor_user_id,
            "actor_email": row.actor_email.unwrap_or_default(),
            "note": row.note.unwrap_or_default(),
            "meta": row.meta,
            "created_at": row.created_at.to_rfc3339()
        })).collect::<Vec<_>>()
    }))
}

pub fn router() -> Router<crate::routes::AppState> {
    Router::new()
        .route("/api/admin/membership/set", post(set_membership))
        .route("/api/admin/entitlements/grant", post(grant_entitlement))
        .route("/api/admin/entitlements/revoke", post(revoke_entitlement))
        .route("/api/admin/users/search", get(search_users))
        .route("/api/admin/users/freeze", post(freeze_user))
        .route("/api/admin/users/actions", get(list_actions))
}
