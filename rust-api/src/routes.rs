use axum::extract::OriginalUri;
use axum::extract::Query;

#[derive(serde::Deserialize)]
struct PipelineStatusQuery {
    path: Option<String>,
}

async fn pipeline_status_handler(Query(q): Query<PipelineStatusQuery>) -> axum::response::Response {
    let p = q.path.unwrap_or_else(|| "build/run.json".to_string());
    match crate::pipeline_status::build_status_json(std::path::Path::new(&p)) {
        Ok(v) => (axum::http::StatusCode::OK, axum::Json(v)).into_response(),
        Err(e) => {
            let body = serde_json::json!({
                "schema":"css.error.v1",
                "code":"STATUS_READ_FAILED",
                "message": e.to_string(),
                "path": p
            });
            (axum::http::StatusCode::BAD_REQUEST, axum::Json(body)).into_response()
        }
    }
}

async fn metrics_handler() -> axum::response::Response {
    (
        axum::http::StatusCode::OK,
        [(
            axum::http::header::CONTENT_TYPE,
            "text/plain; version=0.0.4; charset=utf-8",
        )],
        crate::metrics::gather(),
    )
        .into_response()
}

async fn health_handler() -> axum::response::Response {
    (
        axum::http::StatusCode::OK,
        axum::Json(serde_json::json!({"schema":"css.health.v1","ok":true})),
    )
        .into_response()
}

use axum::{
    extract::State,
    http::HeaderMap,
    response::{IntoResponse, Redirect},
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use serde::Serialize;
use serde_json::json;
use sqlx::PgPool;
use sqlx::Row;

use crate::artifacts_api;
use crate::auth::AuthSession;
use crate::billing::{
    change_membership_tier_with_balance, ensure_account, meter_usage, normalize_membership_tier,
    pending_fund_hold_summary, release_matured_fund_holds, reset_month, MembershipChangeError,
};
use crate::config::Config;
use crate::cssapi::docs::docs_router;
use crate::events::EventBus;
use crate::jobs::Jobs;
use crate::models::User;
use crate::passkey;
use crate::public_api;
use crate::run_state::{DagMeta, RetryPolicy, RunConfig, RunState, RunStatus};
use crate::runner::run_pipeline_default;
use crate::runs_api;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: Config,
    pub jobs: Jobs,
    pub event_bus: EventBus,
    // CSSOS_PHASE2_I18N_MVP 20260418 — two-tier translation cache
    // (process-local memory + shared Postgres). See i18n_translate.rs.
    pub i18n_cache: crate::i18n_translate::MemoryCache,
}

#[derive(Serialize)]
struct ApiResponse<T> {
    ok: bool,
    status: String,
    message: Option<String>,
    data: T,
}

fn respond<T: Serialize>(
    status: &str,
    message: Option<String>,
    data: T,
) -> axum::response::Response {
    let mut headers = HeaderMap::new();
    headers.insert(
        axum::http::header::CACHE_CONTROL,
        "no-store".parse().unwrap(),
    );
    let body = Json(ApiResponse {
        ok: true,
        status: status.into(),
        message,
        data,
    });
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
        .merge(docs_router())
        .merge(runs_api::router())
        .merge(artifacts_api::router())
        .merge(crate::admin_users_api::router())
        .merge(crate::css_assurance_api::router::router())
        .merge(crate::css_case_api::router::router())
        .merge(crate::css_explain_api::router::router())
        .merge(crate::css_trust_api::router::router())
        .merge(crate::css_risk_api::router::router())
        .route(
            "/cssapi/v1/mv",
            post(crate::orchestrator::api::create_mv_api),
        )
        .merge(crate::orchestrator::product_api::router())
        // CSSOS_PHASE2_MV_API 20260417 — third-party creative pipeline
        .merge(crate::pipeline_mv_api::router())
        // CSSOS_PHASE2_I18N_MVP 20260418 — POST /api/i18n/translate
        .merge(crate::i18n_translate::router())
        // CSSOS_PHASE2_PAYMENTS 20260419 — NihaoPay WeChat Pay/Alipay/UnionPay
        // integration. Webhook path /api/payments/webhook/nihaopay is NOT
        // behind AuthSession (NihaoPay server calls it); signature validated
        // via verify_sign inside the handler.
        .merge(crate::payments_api::router())
        // CSSOS_PHASE2_BYOK 20260420 — per-user third-party API keys
        // (/api/settings/engine-keys). Runway is the pilot; ElevenLabs /
        // Stability / Suno land as follow-ups on the same surface.
        .merge(crate::engine_credentials::api::router())
        .route(
            "/cssapi/v1/engines",
            get(public_api::engines::api_list_engines),
        )
        .route(
            "/cssapi/v1/engines/:engine",
            get(public_api::engines::api_get_engine),
        )
        .route("/cssapi/v1/pricing", get(public_api::pricing::api_pricing))
        .route(
            "/cssapi/v1/schema/mv",
            get(public_api::schema::api_mv_schema),
        )
        .route("/cssapi/v1/ws", get(crate::ws::ws_handler))
        .route("/metrics", get(metrics_handler))
        .route("/api/health", get(health_handler))
        .route("/api/auth/providers", get(auth_providers))
        .route("/api/auth/google", get(auth_google_redirect))
        .route("/api/auth/github", get(auth_github_redirect))
        .route("/api/auth/x", get(auth_x_redirect))
        .route("/api/auth/facebook", get(auth_facebook_redirect))
        .route("/api/auth/wechat", get(auth_wechat_redirect))
        .route("/api/auth/weixin", get(auth_weixin_redirect))
        .route("/api/auth/apple", get(auth_apple_redirect))
        .route("/api/auth/bsky", get(auth_bsky_redirect))
        .route(
            "/api/auth/google/callback",
            get(auth_google_callback_redirect),
        )
        .route(
            "/api/auth/github/callback",
            get(auth_github_callback_redirect),
        )
        .route("/api/auth/x/callback", get(auth_x_callback_redirect))
        .route(
            "/api/auth/facebook/callback",
            get(auth_facebook_callback_redirect),
        )
        .route(
            "/api/auth/wechat/callback",
            get(auth_wechat_callback_redirect),
        )
        .route(
            "/api/auth/weixin/callback",
            get(auth_weixin_callback_redirect),
        )
        .route(
            "/api/auth/apple/callback",
            get(auth_apple_callback_redirect),
        )
        .route("/api/auth/bsky/callback", get(auth_bsky_callback_redirect))
        .route(
            "/api/auth/passkey/register/options",
            get(passkey::register_options),
        )
        .route(
            "/api/auth/passkey/register/verify",
            post(passkey::register_verify),
        )
        .route(
            "/api/auth/passkey/login/options",
            get(passkey::login_options),
        )
        .route(
            "/api/auth/passkey/login/verify",
            post(passkey::login_verify),
        )
        .route("/api/me", get(me))
        .route("/api/billing/status", get(billing_status))
        .route(
            "/api/billing/membership/change",
            post(billing_membership_change),
        )
        .route(
            "/api/billing/usage",
            post(billing_usage).get(billing_usage_list),
        )
        .route("/api/pipeline/start", post(pipeline_start))
        .route(
            "/api/pipeline/status",
            axum::routing::get(pipeline_status_handler),
        )
        .route("/api/health/db", get(health_db))
        .with_state(state)
}

#[derive(serde::Deserialize)]
struct PipelineStartRequest {
    cssl: String,
    ui_lang: String,
    tier: String,
    out_dir: Option<String>,
    commands: crate::dsl::compile::CompiledCommands,
    wiki_enabled: Option<bool>,
    civ_linked: Option<bool>,
}

async fn pipeline_start(
    State(_state): State<AppState>,
    Json(body): Json<PipelineStartRequest>,
) -> axum::response::Response {
    let run_id = format!("run_{}", Utc::now().format("%Y%m%d_%H%M%S"));
    let now = Utc::now().to_rfc3339();
    let out_dir = body.out_dir.unwrap_or_else(|| "./build".to_string());
    let dag = crate::dag::cssmv_dag_active();
    let topo_order = dag
        .topo_order()
        .unwrap_or_default()
        .into_iter()
        .map(|s| s.to_string())
        .collect::<Vec<_>>();
    let dag_edges = dag
        .nodes
        .iter()
        .map(|n| {
            (
                n.name.to_string(),
                n.deps.iter().map(|d| (*d).to_string()).collect::<Vec<_>>(),
            )
        })
        .collect::<std::collections::BTreeMap<_, _>>();

    let state = RunState {
        schema: "css.pipeline.run.v1".to_string(),
        run_id: run_id.clone(),
        created_at: now.clone(),
        updated_at: now,
        status: RunStatus::INIT,
        heartbeat_at: None,
        last_heartbeat_at: None,
        stuck_timeout_seconds: Some(120),
        cancel_requested: false,
        cancel_requested_at: None,
        ui_lang: body.ui_lang,
        tier: body.tier,
        cssl: body.cssl,
        config: RunConfig {
            out_dir: out_dir.into(),
            wiki_enabled: body.wiki_enabled.unwrap_or(true),
            civ_linked: body.civ_linked.unwrap_or(true),
            heartbeat_interval_seconds: 2,
            stage_timeout_seconds: 1800,
            stuck_timeout_seconds: 120,
        },
        retry_policy: RetryPolicy {
            max_retries: 3,
            backoff_base_seconds: 2,
            strategy: "exponential".to_string(),
        },
        dag: DagMeta {
            schema: "css.pipeline.dag.v1".to_string(),
            nodes: dag
                .nodes
                .iter()
                .map(|n| crate::run_state::DagNodeMeta {
                    name: n.name.to_string(),
                    deps: n.deps.iter().map(|d| (*d).to_string()).collect(),
                })
                .collect(),
        },
        topo_order,
        dag_edges,
        commands: serde_json::json!({}),
        artifacts: vec![],
        stages: Default::default(),
        video_shots_total: None,
        total_duration_seconds: None,
        stage_seq: 0,
        slowest_leader: None,
        slowest_tick: None,
        last_event: None,
        immersion: crate::immersion_engine::state::ImmersionState::default(),
        presence: crate::presence_engine::state::PresenceState::default(),
        scene_semantics: crate::scene_semantics_engine::state::SceneSemanticStateStore::default(),
        event_engine: crate::event_engine::runtime::EventEngineState::default(),
        immersion_zones: Vec::new(),
        viewer_position: None,
    };

    crate::events::emit_snapshot(&state);
    tokio::spawn(async move {
        let _ = run_pipeline_default(state, body.commands).await;
    });

    ok(json!({ "schema": "cssapi.v1", "run_id": run_id }))
}

async fn auth_providers(State(_state): State<AppState>) -> axum::response::Response {
    if let Ok(resp) = reqwest::get("http://127.0.0.1:3000/api/auth/providers").await {
        if resp.status().is_success() {
            if let Ok(body) = resp.text().await {
                return ([(axum::http::header::CACHE_CONTROL, "no-store")], body).into_response();
            }
        }
    }
    let providers: Vec<(&str, &str, Vec<&str>)> = vec![
        ("apple", "Apple", vec!["APPLE_CLIENT_ID"]),
        (
            "google",
            "Google",
            vec!["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
        ),
        (
            "github",
            "GitHub",
            vec!["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"],
        ),
        ("x", "X", vec!["X_CLIENT_ID", "X_CLIENT_SECRET"]),
        (
            "facebook",
            "Facebook",
            vec!["FACEBOOK_CLIENT_ID", "FACEBOOK_CLIENT_SECRET"],
        ),
        (
            "wechat",
            "WeChat",
            vec!["WECHAT_CLIENT_ID", "WECHAT_CLIENT_SECRET"],
        ),
        (
            "bsky",
            "Bluesky",
            vec!["BLUESKY_HANDLE", "BLUESKY_APP_PASSWORD"],
        ),
        (
            "tiktok",
            "TikTok",
            vec!["TIKTOK_CLIENT_ID", "TIKTOK_CLIENT_SECRET"],
        ),
    ];
    let list: Vec<_> = providers
        .into_iter()
        .map(|(id, name, envs)| {
            let enabled = envs
                .iter()
                .all(|k| std::env::var(k).ok().filter(|v| !v.is_empty()).is_some());
            json!({
                "id": id,
                "name": name,
                "enabled": enabled,
                "url": if enabled { format!("/api/auth/{id}") } else { "".into() }
            })
        })
        .collect();

    if list
        .iter()
        .all(|v| v.get("enabled").and_then(|b| b.as_bool()) == Some(false))
    {
        return no_data(json!({ "providers": list }));
    }
    ok(json!({ "providers": list }))
}

fn redirect_with_query(base: &str, uri: &OriginalUri) -> Redirect {
    let query = uri
        .0
        .query()
        .map(|value| format!("?{value}"))
        .unwrap_or_default();
    Redirect::temporary(&format!("{base}{query}"))
}

async fn auth_google_redirect() -> Redirect {
    Redirect::temporary("/auth/google")
}
async fn auth_github_redirect() -> Redirect {
    Redirect::temporary("/auth/github")
}
async fn auth_x_redirect() -> Redirect {
    Redirect::temporary("/auth/x")
}
async fn auth_facebook_redirect() -> Redirect {
    Redirect::temporary("/auth/facebook")
}
async fn auth_wechat_redirect() -> Redirect {
    Redirect::temporary("/auth/wechat")
}
async fn auth_weixin_redirect() -> Redirect {
    Redirect::temporary("/auth/wechat")
}
async fn auth_apple_redirect() -> Redirect {
    Redirect::temporary("/auth/apple")
}
async fn auth_bsky_redirect() -> Redirect {
    Redirect::temporary("/auth/bsky")
}

async fn auth_google_callback_redirect(uri: OriginalUri) -> Redirect {
    redirect_with_query("/auth/google/callback", &uri)
}
async fn auth_github_callback_redirect(uri: OriginalUri) -> Redirect {
    redirect_with_query("/auth/github/callback", &uri)
}
async fn auth_x_callback_redirect(uri: OriginalUri) -> Redirect {
    redirect_with_query("/auth/x/callback", &uri)
}
async fn auth_facebook_callback_redirect(uri: OriginalUri) -> Redirect {
    redirect_with_query("/auth/facebook/callback", &uri)
}
async fn auth_wechat_callback_redirect(uri: OriginalUri) -> Redirect {
    redirect_with_query("/auth/wechat/callback", &uri)
}
async fn auth_weixin_callback_redirect(uri: OriginalUri) -> Redirect {
    redirect_with_query("/auth/wechat/callback", &uri)
}
async fn auth_apple_callback_redirect(uri: OriginalUri) -> Redirect {
    redirect_with_query("/auth/apple/callback", &uri)
}
async fn auth_bsky_callback_redirect(uri: OriginalUri) -> Redirect {
    redirect_with_query("/auth/bsky/callback", &uri)
}

async fn me(
    State(state): State<AppState>,
    AuthSession { user_id }: AuthSession,
) -> axum::response::Response {
    if user_id.is_none() {
        return no_data(json!({ "authenticated": false, "user": serde_json::Value::Null }));
    }
    let user_id = user_id.unwrap();
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
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

async fn billing_status(
    State(state): State<AppState>,
    AuthSession { user_id }: AuthSession,
) -> axum::response::Response {
    if user_id.is_none() {
        return no_data(json!({ "authenticated": false }));
    }
    let user_id = user_id.unwrap();
    let _ = reset_month(&state.pool, user_id).await;
    let _ = release_matured_fund_holds(&state.pool, user_id).await;
    let (account, created) = match ensure_account(&state.pool, user_id).await {
        Ok(result) => result,
        Err(_) => return no_data(json!({ "authenticated": false })),
    };
    let membership_tier = sqlx::query_scalar::<_, String>(
        "SELECT COALESCE(membership_tier, 'free') FROM billing_accounts WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten()
    .unwrap_or_else(|| "free".to_string());
    let (pending_balance_cents, next_available_at, pending_rows) =
        pending_fund_hold_summary(&state.pool, user_id)
            .await
            .unwrap_or((0, None, Vec::new()));
    let latest_membership_change = sqlx::query(
        r#"
        SELECT created_at, type, amount_cents, note, meta
          FROM ledger_entries
         WHERE user_id = $1
           AND type LIKE 'membership_change_%'
         ORDER BY created_at DESC
         LIMIT 1
        "#,
    )
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten()
    .map(|row| {
        json!({
            "created_at": row.try_get::<chrono::DateTime<Utc>, _>("created_at").ok(),
            "type": row.try_get::<String, _>("type").ok(),
            "amount_cents": row.try_get::<i64, _>("amount_cents").ok(),
            "note": row.try_get::<Option<String>, _>("note").ok().flatten(),
            "meta": row.try_get::<serde_json::Value, _>("meta").ok().unwrap_or_else(|| json!({})),
        })
    })
    .unwrap_or(serde_json::Value::Null);

    let payload = json!({
        "authenticated": true,
        "tier": normalize_membership_tier(&membership_tier),
        "currency": account.currency,
        "balance_cents": account.balance_cents,
        "pending_balance_cents": pending_balance_cents,
        "pending_balance_release_at": next_available_at,
        "monthly_limit_cents": account.monthly_limit_cents,
        "month_spend_cents": account.month_spend_cents,
        "auto_recharge": {
            "enabled": account.auto_recharge_enabled,
            "threshold_cents": account.auto_recharge_threshold_cents,
            "amount_cents": account.auto_recharge_amount_cents,
        },
        "has_payment_method": account.has_payment_method,
        "latest_membership_change": latest_membership_change,
        "recent_fund_holds": pending_rows.into_iter().map(|row| json!({
            "id": row.id,
            "kind": row.kind,
            "status": row.status,
            "amount_cents": row.amount_cents,
            "available_at": row.available_at,
            "note": row.note,
            "created_at": row.created_at,
        })).collect::<Vec<_>>(),
    });

    if created && account.balance_cents == 0 {
        return no_data(payload);
    }

    ok(payload)
}

#[derive(serde::Deserialize)]
struct BillingMembershipChangeRequest {
    target_tier: Option<String>,
    requested_from: Option<String>,
}

async fn billing_membership_change(
    State(state): State<AppState>,
    AuthSession { user_id }: AuthSession,
    Json(body): Json<BillingMembershipChangeRequest>,
) -> axum::response::Response {
    let Some(user_id) = user_id else {
        return no_data(json!({
            "authenticated": false,
            "changed": false,
        }));
    };
    let target_tier = body
        .target_tier
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();
    let requested_from = body
        .requested_from
        .unwrap_or_else(|| "subscription_panel".to_string())
        .trim()
        .to_string();
    let refund_mode = |refunded_cents: i64| {
        if refunded_cents > 0 {
            json!("platform_hold_14d")
        } else {
            serde_json::Value::Null
        }
    };
    match change_membership_tier_with_balance(&state.pool, user_id, &target_tier, &requested_from)
        .await
    {
        Ok(result) => ok(json!({
            "changed": true,
            "tier": result.tier,
            "previous_tier": result.previous_tier,
            "balance_cents": result.balance_cents,
            "pending_balance_cents": result.pending_balance_cents,
            "monthly_limit_cents": result.monthly_limit_cents,
            "charged_cents": result.charged_cents,
            "refunded_cents": result.refunded_cents,
            "net_amount_cents": result.net_amount_cents,
            "refund_mode": refund_mode(result.refunded_cents),
            "hold_release_at": result.hold_release_at,
        })),
        Err(MembershipChangeError::InvalidTier) => (
            axum::http::StatusCode::BAD_REQUEST,
            Json(json!({
                "ok": false,
                "code": "TARGET_TIER_INVALID",
                "message": "Target tier is invalid"
            })),
        )
            .into_response(),
        Err(MembershipChangeError::ForbiddenTier) => (
            axum::http::StatusCode::FORBIDDEN,
            Json(json!({
                "ok": false,
                "code": "TARGET_TIER_FORBIDDEN",
                "message": "This tier cannot be self-served"
            })),
        )
            .into_response(),
        Err(MembershipChangeError::InsufficientBalance {
            required_cents,
            balance_cents,
        }) => (
            axum::http::StatusCode::PAYMENT_REQUIRED,
            Json(json!({
                "ok": false,
                "code": "INSUFFICIENT_BALANCE",
                "message": "Not enough balance to switch to this plan",
                "data": {
                    "required_cents": required_cents,
                    "balance_cents": balance_cents,
                }
            })),
        )
            .into_response(),
        Err(MembershipChangeError::Sql(_)) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({
                "ok": false,
                "code": "MEMBERSHIP_CHANGE_FAILED",
                "message": "Could not update membership"
            })),
        )
            .into_response(),
    }
}

async fn billing_usage(
    State(state): State<AppState>,
    AuthSession { user_id }: AuthSession,
    Json(body): Json<serde_json::Value>,
) -> axum::response::Response {
    if user_id.is_none() {
        return no_data(json!({ "allowed": false, "authenticated": false }));
    }
    let user_id = user_id.unwrap();
    let route = body
        .get("route")
        .and_then(|v| v.as_str())
        .unwrap_or("/api/billing/usage");
    let units = body.get("units").and_then(|v| v.as_i64()).unwrap_or(1);
    let request_id = body
        .get("request_id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
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

async fn billing_usage_list(
    State(state): State<AppState>,
    AuthSession { user_id }: AuthSession,
) -> axum::response::Response {
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
