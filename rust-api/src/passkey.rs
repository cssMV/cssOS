use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::json;

use crate::auth::AuthSession;
use crate::routes::AppState;

fn err(code: &str) -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::BAD_REQUEST,
        Json(json!({ "schema": "css.error.v1", "code": code })),
    )
}

fn ok(data: serde_json::Value) -> (StatusCode, Json<serde_json::Value>) {
    (StatusCode::OK, Json(json!({ "ok": true, "data": data })))
}

#[derive(Deserialize)]
pub struct RpQuery {
    #[serde(default)]
    pub user_verification: Option<String>,
}

#[derive(Deserialize)]
pub struct VerifyBody {
    pub credential: serde_json::Value,
}

fn make_challenge() -> String {
    uuid::Uuid::new_v4().to_string().replace('-', "")
}

pub async fn register_options(
    State(_app): State<AppState>,
    AuthSession { user_id }: AuthSession,
    Query(q): Query<RpQuery>,
) -> impl IntoResponse {
    let Some(user_id) = user_id else {
        return err("AUTH_REQUIRED");
    };

    let challenge = make_challenge();
    let key = format!("passkey.reg_state:{}", user_id);
    crate::ephemeral::set_json(
        key,
        std::time::Duration::from_secs(300),
        json!({ "challenge": challenge }),
    );

    ok(json!({
        "publicKey": {
            "challenge": challenge,
            "rp": { "name": "CSS Studio" },
            "user": {
                "id": user_id.to_string(),
                "name": user_id.to_string(),
                "displayName": "CSS Studio"
            },
            "pubKeyCredParams": [{ "type": "public-key", "alg": -7 }],
            "timeout": 60000,
            "attestation": "none",
            "userVerification": q.user_verification.unwrap_or_else(|| "preferred".to_string())
        }
    }))
}

pub async fn register_verify(
    State(_app): State<AppState>,
    AuthSession { user_id }: AuthSession,
    Json(body): Json<VerifyBody>,
) -> impl IntoResponse {
    let Some(user_id) = user_id else {
        return err("AUTH_REQUIRED");
    };
    let key = format!("passkey.reg_state:{}", user_id);
    let Some(_state) = crate::ephemeral::get_json(&key) else {
        return err("PASSKEY_STATE_MISSING");
    };

    if body.credential.is_null() {
        return err("PASSKEY_CRED_INVALID");
    }

    crate::ephemeral::del(&key);
    ok(json!({ "enabled": true }))
}

pub async fn login_options(
    State(_app): State<AppState>,
    AuthSession { user_id }: AuthSession,
    Query(q): Query<RpQuery>,
) -> impl IntoResponse {
    let Some(user_id) = user_id else {
        return err("AUTH_REQUIRED");
    };

    let challenge = make_challenge();
    let key = format!("passkey.auth_state:{}", user_id);
    crate::ephemeral::set_json(
        key,
        std::time::Duration::from_secs(300),
        json!({ "challenge": challenge }),
    );

    ok(json!({
        "publicKey": {
            "challenge": challenge,
            "timeout": 60000,
            "userVerification": q.user_verification.unwrap_or_else(|| "preferred".to_string())
        }
    }))
}

pub async fn login_verify(
    State(_app): State<AppState>,
    AuthSession { user_id }: AuthSession,
    Json(body): Json<VerifyBody>,
) -> impl IntoResponse {
    let Some(user_id) = user_id else {
        return err("AUTH_REQUIRED");
    };
    let key = format!("passkey.auth_state:{}", user_id);
    let Some(_state) = crate::ephemeral::get_json(&key) else {
        return err("PASSKEY_STATE_MISSING");
    };

    if body.credential.is_null() {
        return err("PASSKEY_CRED_INVALID");
    }

    crate::ephemeral::del(&key);
    ok(json!({ "verified": true }))
}
