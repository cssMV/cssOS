use axum::{extract::State, http::HeaderMap, response::IntoResponse, routing::{get, post}, Json, Router};
use serde::Serialize;
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::AuthSession;
use crate::billing::{ensure_account, meter_usage, reset_month};
use crate::config::Config;
use crate::models::User;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: Config,
}

#[derive(Serialize)]
struct ApiResponse<T> {
    ok: bool,
    status: String,
    message: Option<String>,
    data: T,
}

fn respond<T: Serialize>(status: &str, message: Option<String>, data: T) -> axum::response::Response {
    let mut headers = HeaderMap::new();
    headers.insert(axum::http::header::CACHE_CONTROL, "no-store".parse().unwrap());
    let body = Json(ApiResponse { ok: true, status: status.into(), message, data });
    (headers, body).into_response()
}

fn no_data<T: Serialize>(data: T) -> axum::response::Response {
    respond("no_data", Some("No data yet".into()), data)
}

fn ok<T: Serialize>(data: T) -> axum::response::Response {
    respond("ok", None, data)
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/api/auth/providers", get(auth_providers))
        .route("/api/me", get(me))
        .route("/api/billing/status", get(billing_status))
        .route("/api/billing/usage", post(billing_usage).get(billing_usage_list))
        .route("/api/health/db", get(health_db))
        .with_state(state)
}

async fn auth_providers(State(_state): State<AppState>) -> axum::response::Response {
    let providers = vec![
        ("google", "Google", ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]),
        ("github", "GitHub", ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"]),
        ("x", "X", ["X_CLIENT_ID", "X_CLIENT_SECRET"]),
        ("bsky", "Bluesky", ["BLUESKY_HANDLE", "BLUESKY_APP_PASSWORD"]),
        ("tiktok", "TikTok", ["TIKTOK_CLIENT_ID", "TIKTOK_CLIENT_SECRET"]),
    ];
    let list: Vec<_> = providers
        .into_iter()
        .map(|(id, name, envs)| {
            let enabled = envs.iter().all(|k| std::env::var(k).ok().filter(|v| !v.is_empty()).is_some());
            json!({
                "id": id,
                "name": name,
                "enabled": enabled,
                "url": if enabled { format!("/api/auth/{id}") } else { "".into() }
            })
        })
        .collect();

    if list.iter().all(|v| v.get("enabled").and_then(|b| b.as_bool()) == Some(false)) {
        return no_data(json!({ "providers": list }));
    }
    ok(json!({ "providers": list }))
}

async fn me(State(state): State<AppState>, AuthSession { user_id }: AuthSession) -> axum::response::Response {
    if user_id.is_none() {
        return no_data(json!({ "authenticated": false, "user": serde_json::Value::Null }));
    }
    let user_id = user_id.unwrap();
    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten();

    if let Some(user) = user {
        return ok(json!({
            "authenticated": true,
            "user": {
                "id": user.id,
                "name": user.display_name,
                "email": user.email,
                "avatar": user.avatar_url,
            },
            "role": user.role,
            "tier": user.role
        }));
    }

    no_data(json!({ "authenticated": false, "user": serde_json::Value::Null }))
}

async fn billing_status(State(state): State<AppState>, AuthSession { user_id }: AuthSession) -> axum::response::Response {
    if user_id.is_none() {
        return no_data(json!({ "authenticated": false }));
    }
    let user_id = user_id.unwrap();
    let _ = reset_month(&state.pool, user_id).await;
    let (account, created) = match ensure_account(&state.pool, user_id).await {
        Ok(result) => result,
        Err(_) => return no_data(json!({ "authenticated": false })),
    };

    let payload = json!({
        "authenticated": true,
        "currency": account.currency,
        "balance_cents": account.balance_cents,
        "monthly_limit_cents": account.monthly_limit_cents,
        "month_spend_cents": account.month_spend_cents,
        "auto_recharge": {
            "enabled": account.auto_recharge_enabled,
            "threshold_cents": account.auto_recharge_threshold_cents,
            "amount_cents": account.auto_recharge_amount_cents,
        },
        "has_payment_method": account.has_payment_method,
    });

    if created && account.balance_cents == 0 {
        return no_data(payload);
    }

    ok(payload)
}

async fn billing_usage(State(state): State<AppState>, AuthSession { user_id }: AuthSession, Json(body): Json<serde_json::Value>) -> axum::response::Response {
    if user_id.is_none() {
        return no_data(json!({ "allowed": false, "authenticated": false }));
    }
    let user_id = user_id.unwrap();
    let route = body.get("route").and_then(|v| v.as_str()).unwrap_or("/api/billing/usage");
    let units = body.get("units").and_then(|v| v.as_i64()).unwrap_or(1);
    let request_id = body.get("request_id").and_then(|v| v.as_str()).map(|s| s.to_string());
    let meta = body.get("meta").cloned().unwrap_or_else(|| json!({}));

    let result = meter_usage(
        &state.pool,
        user_id,
        route,
        units,
        state.config.billing_unit_price_cents,
        request_id,
        meta,
    )
    .await;

    match result {
        Ok(res) => ok(json!({
            "allowed": res.allowed,
            "tier": "user",
            "remaining": null,
            "limit": res.monthly_limit_cents,
            "balance_cents": res.balance_cents,
            "month_spend_cents": res.month_spend_cents,
        })),
        Err(_) => no_data(json!({ "allowed": false })),
    }
}

async fn billing_usage_list(State(state): State<AppState>, AuthSession { user_id }: AuthSession) -> axum::response::Response {
    if user_id.is_none() {
        return no_data(json!({ "authenticated": false, "events": [] }));
    }
    let user_id = user_id.unwrap();
    let events = sqlx::query_as::<_, crate::models::UsageEvent>(
        "SELECT * FROM usage_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    if events.is_empty() {
        return no_data(json!({ "authenticated": true, "events": [] }));
    }

    ok(json!({ "authenticated": true, "events": events }))
}

async fn health_db(State(state): State<AppState>) -> axum::response::Response {
    if sqlx::query("SELECT 1").execute(&state.pool).await.is_err() {
        return no_data(json!({ "ok": false }));
    }
    ok(json!({ "ok": true }))
}
