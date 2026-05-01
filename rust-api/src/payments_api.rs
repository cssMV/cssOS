//! HTTP routes for the NihaoPay payments flow.
//!
//! Mounted from routes.rs via `payments_api::router(state)`. Kept separate
//! from the gateway client (`crate::payments::nihaopay`) so HTTP surface and
//! gateway plumbing can be tested independently.
//!
//! Routes:
//!   POST /api/payments/checkout            (auth) — create intent + securepay
//!   GET  /api/payments/intents/:id         (auth) — poll status from /billing/return
//!   GET  /api/payments/history             (auth) — recent intents for caller
//!   POST /api/payments/webhook/nihaopay    (NO auth; validates verify_sign)
//!
//! Checkout response shape (what the frontend sees):
//!   200 { "ok": true, "intent": { id, kind, amount_cents, reference, ... },
//!         "redirect": { "mode": "url", "url": "..." } }
//!  or
//!   200 { "ok": true, "intent": {...},
//!         "redirect": { "mode": "form", "form": { actionUrl, method,
//!                                                  target, params: {...} } } }

use axum::extract::{Form, Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;
use std::collections::HashMap;
use tracing::{info, warn};
use uuid::Uuid;

use crate::auth::AuthSession;
use crate::payments::{self, IntentKind, Vendor};
use crate::payments::nihaopay::{self, SecurePayRedirect, SecurePayRequest};
use crate::routes::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/payments/checkout", post(checkout))
        .route("/api/payments/intents/:id", get(intent_detail))
        .route("/api/payments/history", get(history))
        .route("/api/payments/webhook/nihaopay", post(nihaopay_webhook))
}

// ---------------------------------------------------------------------------
// POST /api/payments/checkout
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct CheckoutRequest {
    /// topup | subscription | purchase | tip
    kind: String,
    /// alipay | wechatpay | unionpay
    vendor: String,
    /// USD cents (smallest unit). For subscription, must match the tier's
    /// published price — we don't enforce here; server-side price table lives
    /// in billing::self_serve_membership_plan.
    amount_cents: i64,
    /// Optional: for subscription
    tier: Option<String>,
    /// Optional: for purchase/tip
    target_creator_id: Option<Uuid>,
    target_item_id: Option<Uuid>,
    /// Optional free-form memo, surfaced in receipts.
    note: Option<String>,
    /// Optional client-supplied metadata blob (passed through to IPN handler).
    metadata: Option<serde_json::Value>,
}

async fn checkout(
    State(state): State<AppState>,
    AuthSession { user_id }: AuthSession,
    Json(body): Json<CheckoutRequest>,
) -> axum::response::Response {
    let Some(user_id) = user_id else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({
                "ok": false,
                "code": "NOT_AUTHENTICATED",
                "message": "Sign in to complete payment",
            })),
        )
            .into_response();
    };

    if !state.config.nihaopay.is_enabled() {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({
                "ok": false,
                "code": "PAYMENTS_DISABLED",
                "message": "NihaoPay gateway is not configured on this host",
            })),
        )
            .into_response();
    }

    let Some(kind) = IntentKind::parse(body.kind.trim()) else {
        return bad_request("BAD_KIND", "kind must be topup/subscription/purchase/tip/boost");
    };
    let Some(vendor) = Vendor::parse(body.vendor.trim()) else {
        return bad_request("BAD_VENDOR", "vendor must be alipay/wechatpay/unionpay");
    };
    if body.amount_cents <= 0 {
        return bad_request("BAD_AMOUNT", "amount_cents must be > 0");
    }

    // Soft validation by kind. Creator-targeted intents need target_creator_id;
    // subscription intents need tier. We don't cross-validate tier→price here
    // (the subscription panel already enforces prices and the IPN settlement
    // uses balance-backed change_membership_tier_with_balance).
    match kind {
        IntentKind::Tip | IntentKind::Purchase => {
            if body.target_creator_id.is_none() {
                return bad_request(
                    "MISSING_TARGET_CREATOR",
                    "tip/purchase intent requires target_creator_id",
                );
            }
            if body.target_creator_id == Some(user_id) {
                return bad_request(
                    "SELF_TARGET",
                    "cannot tip or buy from yourself",
                );
            }
        }
        IntentKind::Subscription => {
            if body.tier.as_deref().unwrap_or("").trim().is_empty() {
                return bad_request("MISSING_TIER", "subscription intent requires tier");
            }
        }
        IntentKind::Topup => {}
        // CSSOS_PHASE2_BOOST_KIND 20260419 — "boost" is self-purchase (no
        // creator_id, no tier). The webhook settlement branch validates
        // the note format "boost:<kind>:<qty>" at credit time.
        IntentKind::Boost => {
            let note = body.note.as_deref().unwrap_or("").trim();
            if !note.starts_with("boost:") || note.split(':').count() != 3 {
                return bad_request(
                    "BAD_BOOST_NOTE",
                    "boost intent requires note in the form 'boost:<kind>:<quantity>'",
                );
            }
        }
    }

    // Build a compact metadata blob. `intent_type` is a redundant copy of
    // `kind` — NihaoPay echoes the `note` field back in IPN, and we stuff
    // the intent kind in there as a belt-and-suspenders check against
    // cross-intent confusion.
    let mut metadata = body
        .metadata
        .unwrap_or_else(|| serde_json::Value::Object(Default::default()));
    if let Some(obj) = metadata.as_object_mut() {
        obj.insert("intent_type".into(), json!(kind.as_str()));
        obj.insert("vendor".into(), json!(vendor.as_str()));
    }

    // Insert the intent row first; reference is generated server-side so we
    // own idempotency.
    let intent = match payments::create_intent(
        &state.pool,
        user_id,
        kind,
        body.amount_cents,
        vendor,
        body.note.as_deref(),
        body.target_creator_id,
        body.target_item_id,
        body.tier.as_deref(),
        metadata,
    )
    .await
    {
        Ok(i) => i,
        Err(payments::PaymentError::Invalid(msg)) => {
            return bad_request("BAD_INTENT", &msg);
        }
        Err(e) => {
            warn!(err = ?e, "payments: create_intent failed");
            return internal("DB_ERROR", "failed to create payment intent");
        }
    };

    // Build the note NihaoPay will echo in IPN. Short and greppable.
    let echo_note = format!(
        "{kind}:{intent}",
        kind = kind.as_str(),
        intent = intent.id
    );

    let sp_req = SecurePayRequest {
        vendor: vendor.as_str(),
        reference: &intent.reference,
        amount_cents: intent.amount_cents,
        currency: &intent.currency,
        note: Some(&echo_note),
        ipn_url: &state.config.nihaopay.ipn_url,
        callback_url: &state.config.nihaopay.callback_url,
        timeout_minutes: Some(15),
    };

    let sp = match nihaopay::create_securepay(&state.config.nihaopay, sp_req).await {
        Ok(sp) => sp,
        Err(nihaopay::NihaoPayError::Disabled) => {
            return internal("PAYMENTS_DISABLED", "NihaoPay token not configured");
        }
        Err(nihaopay::NihaoPayError::Api { code, message }) => {
            warn!(intent = %intent.id, code, message, "nihaopay: securepay api error");
            // Mark the intent as failed immediately so retries generate a new
            // reference (avoids the 40031 duplicate-reference error).
            let _ = payments::mark_failed(&state.pool, intent.id, "failed").await;
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({
                    "ok": false,
                    "code": "NIHAOPAY_ERROR",
                    "gateway_code": code,
                    "message": message,
                })),
            )
                .into_response();
        }
        Err(e) => {
            warn!(intent = %intent.id, err = ?e, "nihaopay: securepay transport error");
            let _ = payments::mark_failed(&state.pool, intent.id, "failed").await;
            return internal("GATEWAY_ERROR", &format!("{e}"));
        }
    };

    // Record the gateway's txn_id (if any) and flip to 'redirected'.
    let _ = payments::mark_redirected(
        &state.pool,
        intent.id,
        sp.transaction_id.as_deref(),
    )
    .await;

    info!(
        intent = %intent.id,
        reference = %intent.reference,
        vendor = vendor.as_str(),
        kind = kind.as_str(),
        amount_cents = intent.amount_cents,
        "payments: securepay created"
    );

    (
        StatusCode::OK,
        Json(json!({
            "ok": true,
            "intent": intent_json(&intent),
            "transaction_id": sp.transaction_id,
            "redirect": sp.redirect,
            "return_url": format!(
                "{}?intent={}",
                state.config.nihaopay.callback_url, intent.id
            ),
            "test_mode": state.config.nihaopay.test_mode,
        })),
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// GET /api/payments/intents/:id
// ---------------------------------------------------------------------------

async fn intent_detail(
    State(state): State<AppState>,
    AuthSession { user_id }: AuthSession,
    Path(id): Path<Uuid>,
) -> axum::response::Response {
    let Some(user_id) = user_id else {
        return (StatusCode::UNAUTHORIZED, Json(json!({"ok": false}))).into_response();
    };
    let intent = match payments::get_intent(&state.pool, id).await {
        Ok(Some(i)) => i,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"ok": false, "code": "NOT_FOUND"})),
            )
                .into_response();
        }
        Err(e) => {
            warn!(err=?e, "payments: get_intent failed");
            return internal("DB_ERROR", "lookup failed");
        }
    };
    if intent.user_id != user_id {
        // Don't leak existence — pretend it isn't there.
        return (
            StatusCode::NOT_FOUND,
            Json(json!({"ok": false, "code": "NOT_FOUND"})),
        )
            .into_response();
    }
    (
        StatusCode::OK,
        Json(json!({
            "ok": true,
            "intent": intent_json(&intent),
        })),
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// GET /api/payments/history
// ---------------------------------------------------------------------------

async fn history(
    State(state): State<AppState>,
    AuthSession { user_id }: AuthSession,
) -> axum::response::Response {
    let Some(user_id) = user_id else {
        return (StatusCode::UNAUTHORIZED, Json(json!({"ok": false}))).into_response();
    };
    let rows = match payments::list_intents_for_user(&state.pool, user_id, 50).await {
        Ok(rs) => rs,
        Err(e) => {
            warn!(err=?e, "payments: list failed");
            return internal("DB_ERROR", "list failed");
        }
    };
    let items: Vec<_> = rows.iter().map(intent_json).collect();
    (
        StatusCode::OK,
        Json(json!({
            "ok": true,
            "items": items,
        })),
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// POST /api/payments/webhook/nihaopay
// ---------------------------------------------------------------------------

async fn nihaopay_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    Form(form): Form<HashMap<String, String>>,
) -> axum::response::Response {
    // Always persist the raw event first. We want a complete audit trail even
    // if signature fails.
    let ip_addr: Option<String> = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(',').next())
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty());

    let raw_json = serde_json::to_value(&form).unwrap_or(json!({}));
    let reference = form.get("merchant_order_no").cloned();
    let txn_id = form.get("transaction_id").cloned();
    let reported_status = form.get("status").cloned();

    // Compute our own verify_sign from the remaining params and compare.
    let params_vec: Vec<(String, String)> =
        form.iter().map(|(k, v)| (k.clone(), v.clone())).collect();
    let params_ref: Vec<(&str, &str)> = params_vec
        .iter()
        .map(|(k, v)| (k.as_str(), v.as_str()))
        .collect();
    let sig_ok = nihaopay::verify_ipn_sign(&state.config.nihaopay.token, &params_ref);

    let event_id: Uuid = match sqlx::query_scalar(
        r#"INSERT INTO gateway_webhook_events
           (gateway, reference, nihaopay_txn_id, status, verify_sign_valid, ip_addr, raw_payload)
           VALUES ('nihaopay', $1, $2, $3, $4, $5, $6)
           RETURNING id"#,
    )
    .bind(&reference)
    .bind(&txn_id)
    .bind(&reported_status)
    .bind(sig_ok)
    .bind(ip_addr)
    .bind(&raw_json)
    .fetch_one(&state.pool)
    .await
    {
        Ok(id) => id,
        Err(e) => {
            warn!(err=?e, "payments: failed to log webhook event");
            // Even if we can't persist, respond 200 so NihaoPay doesn't
            // loop retries — but log loudly.
            return (StatusCode::OK, "success").into_response();
        }
    };

    if !sig_ok {
        warn!(
            event = %event_id,
            reference = ?reference,
            "payments: IPN verify_sign mismatch — ignoring"
        );
        let _ = sqlx::query(
            "UPDATE gateway_webhook_events SET processed_at = now(), error = 'verify_sign mismatch' WHERE id = $1",
        )
        .bind(event_id)
        .execute(&state.pool)
        .await;
        // Per spec: anything except "success" (or "{verify_sign_failed}")
        // triggers retries. Return a body NihaoPay will not retry on (we've
        // persisted the event, a human can replay later if this was us).
        return (StatusCode::OK, "{verify_sign_failed}").into_response();
    }

    // Look up intent by reference.
    let Some(reference) = reference.clone() else {
        let _ = sqlx::query(
            "UPDATE gateway_webhook_events SET processed_at = now(), error = 'missing merchant_order_no' WHERE id = $1",
        )
        .bind(event_id)
        .execute(&state.pool)
        .await;
        return (StatusCode::OK, "success").into_response();
    };

    let intent = match payments::get_intent_by_reference(&state.pool, &reference).await {
        Ok(Some(i)) => i,
        Ok(None) => {
            warn!(event = %event_id, %reference, "payments: IPN for unknown reference");
            let _ = sqlx::query(
                "UPDATE gateway_webhook_events SET processed_at = now(), error = 'unknown reference' WHERE id = $1",
            )
            .bind(event_id)
            .execute(&state.pool)
            .await;
            return (StatusCode::OK, "success").into_response();
        }
        Err(e) => {
            warn!(err=?e, event = %event_id, "payments: IPN DB lookup failed");
            // Don't ack — let NihaoPay retry.
            return (StatusCode::INTERNAL_SERVER_ERROR, "error").into_response();
        }
    };

    // Record raw IPN on the intent row regardless of branch.
    let _ = payments::record_raw_ipn(&state.pool, intent.id, &raw_json).await;

    let status_str = reported_status.clone().unwrap_or_default();
    let outcome = match status_str.as_str() {
        "success" | "paid" | "succeeded" => {
            match payments::settle_paid(
                &state.pool,
                &intent,
                state.config.nihaopay.purchase_platform_bps,
                state.config.nihaopay.tip_platform_bps,
            )
            .await
            {
                Ok(Some(outcome)) => Some(outcome),
                Ok(None) => None,
                Err(e) => {
                    warn!(err=?e, intent = %intent.id, "payments: settle_paid failed");
                    return (StatusCode::INTERNAL_SERVER_ERROR, "error").into_response();
                }
            }
        }
        "failed" | "expired" | "cancelled" | "canceled" => {
            let s = if status_str == "expired" { "expired" } else { "failed" };
            let _ = payments::mark_failed(&state.pool, intent.id, s).await;
            None
        }
        other => {
            info!(
                intent = %intent.id,
                reported = %other,
                "payments: IPN with non-terminal status — ignoring"
            );
            None
        }
    };

    let _ = sqlx::query(
        "UPDATE gateway_webhook_events SET processed_at = now() WHERE id = $1",
    )
    .bind(event_id)
    .execute(&state.pool)
    .await;

    info!(
        event = %event_id,
        intent = %intent.id,
        reference = %reference,
        reported_status = %status_str,
        outcome = ?outcome,
        "payments: IPN processed"
    );

    // Per NihaoPay spec: respond body `success` (literal, case-sensitive) to
    // acknowledge and stop retries.
    (StatusCode::OK, "success").into_response()
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

fn intent_json(i: &payments::PaymentIntent) -> serde_json::Value {
    json!({
        "id": i.id,
        "kind": i.kind,
        "amount_cents": i.amount_cents,
        "currency": i.currency,
        "vendor": i.vendor,
        "reference": i.reference,
        "nihaopay_txn_id": i.nihaopay_txn_id,
        "status": i.status,
        "target_creator_id": i.target_creator_id,
        "target_item_id": i.target_item_id,
        "tier": i.tier,
        "note": i.note,
        "metadata": i.metadata,
        "created_at": i.created_at,
        "completed_at": i.completed_at,
    })
}

fn bad_request(code: &str, message: &str) -> axum::response::Response {
    (
        StatusCode::BAD_REQUEST,
        Json(json!({
            "ok": false,
            "code": code,
            "message": message,
        })),
    )
        .into_response()
}

fn internal(code: &str, message: &str) -> axum::response::Response {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({
            "ok": false,
            "code": code,
            "message": message,
        })),
    )
        .into_response()
}

// Unused import guard for SecurePayRedirect — kept for potential future
// direct-rendering paths. Suppressing is simpler than hand-writing the match.
#[allow(dead_code)]
fn _use_redirect(_r: SecurePayRedirect) {}
