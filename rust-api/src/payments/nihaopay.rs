//! NihaoPay SecurePay v1.2 HTTP client + IPN signature verification.
//!
//! Only implements the three operations we actually use:
//!   - POST /v1.2/transactions/securepay   (create a hosted-page transaction)
//!   - GET  /v1.2/transactions/{id}        (lookup / reconcile)
//!   - POST /v1.2/transactions/{id}/refund (refunds — admin-only path, stub)
//!
//! verify_ipn_sign() reimplements NihaoPay's signing scheme:
//!   MD5(
//!     concat(sorted(key=value for key,value in params if value != "" and key != "verify_sign")
//!            separated by "&")
//!     + "&"
//!     + MD5(TOKEN)          -- lowercase hex
//!   )
//! lowercase hex, UTF-8 byte-wise.
//!
//! We log everything at trace (body) / debug (txn id) and never log the
//! bearer token.

use md5::{Digest, Md5};
use reqwest::Client;
use serde::Deserialize;
use std::collections::BTreeMap;
use std::time::Duration;
use tracing::{debug, warn};

use crate::config::NihaoPayConfig;

#[derive(Debug, thiserror::Error)]
pub enum NihaoPayError {
    #[error("disabled (NIHAOPAY_TOKEN empty)")]
    Disabled,
    #[error("http: {0}")]
    Http(#[from] reqwest::Error),
    #[error("gateway returned {code}: {message}")]
    Api { code: String, message: String },
    #[error("unexpected response: {0}")]
    UnexpectedResponse(String),
}

/// What SecurePay hands back to us when response_format=JSON.
///
/// The spec describes two shapes:
///   1. `{ "url": "https://..." }` — simple redirect (most common)
///   2. `{ "form": { "actionUrl": "...", "method": "POST",
///                   "target": "_top", "params": { k: v, ... } } }`
///      — for vendors that need a POST form submission (some WeChat flows).
///
/// We pass both straight through to the browser so the frontend decides
/// which strategy to use.
#[derive(Debug, Deserialize)]
pub struct SecurePayRaw {
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub form: Option<SecurePayForm>,
    #[serde(default)]
    pub transaction_id: Option<String>,
    // Error fields (present when the gateway refuses the request).
    #[serde(default)]
    pub error: Option<NihaoPayErrorBody>,
    // Some NihaoPay deployments bubble `code` + `message` at the top level.
    #[serde(default)]
    pub code: Option<String>,
    #[serde(default)]
    pub message: Option<String>,
}

#[derive(Debug, Deserialize, serde::Serialize, Clone)]
pub struct SecurePayForm {
    #[serde(rename = "actionUrl")]
    pub action_url: String,
    pub method: String,
    #[serde(default = "default_target")]
    pub target: String,
    #[serde(default)]
    pub params: std::collections::HashMap<String, String>,
}

fn default_target() -> String {
    "_top".into()
}

#[derive(Debug, Deserialize)]
pub struct NihaoPayErrorBody {
    #[serde(default)]
    pub code: Option<String>,
    #[serde(default)]
    pub message: Option<String>,
}

/// Normalized view of a SecurePay result.
#[derive(Debug, Clone, serde::Serialize)]
pub struct SecurePayResult {
    pub transaction_id: Option<String>,
    /// Either `Redirect(url)` or `Form(SecurePayForm)` — wrapped for the
    /// frontend to pick the right flow.
    pub redirect: SecurePayRedirect,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(tag = "mode", rename_all = "snake_case")]
pub enum SecurePayRedirect {
    Url { url: String },
    Form { form: SecurePayForm },
}

/// Parameters we send to POST /v1.2/transactions/securepay.
///
/// Intentionally NOT using serde_urlencoded here — we hand-build the form
/// so we can control ordering (NihaoPay doesn't care about order on request
/// but our own logs stay stable) and keep empty fields out.
#[derive(Debug)]
pub struct SecurePayRequest<'a> {
    pub vendor: &'a str,
    pub reference: &'a str,     // merchant_order_no (≤ 30 alphanumeric)
    pub amount_cents: i64,      // smallest USD unit (cents)
    pub currency: &'a str,      // "USD"
    pub note: Option<&'a str>,  // echoed in IPN
    pub ipn_url: &'a str,
    pub callback_url: &'a str,
    pub timeout_minutes: Option<u32>, // defaults to NihaoPay's default (15m)
}

pub async fn create_securepay(
    cfg: &NihaoPayConfig,
    req: SecurePayRequest<'_>,
) -> Result<SecurePayResult, NihaoPayError> {
    if !cfg.is_enabled() {
        return Err(NihaoPayError::Disabled);
    }

    let url = format!("{}/v1.2/transactions/securepay", cfg.base_url);
    let client = Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(NihaoPayError::Http)?;

    // Amount per v1.2: smallest unit (cents).
    let amount = req.amount_cents.to_string();

    let mut form: Vec<(&str, String)> = vec![
        ("merchant_order_no", req.reference.to_string()),
        ("amount", amount),
        ("currency", req.currency.to_string()),
        ("vendor", req.vendor.to_string()),
        ("ipn_url", req.ipn_url.to_string()),
        ("callback_url", req.callback_url.to_string()),
        ("response_format", "JSON".to_string()),
    ];
    if let Some(n) = req.note {
        if !n.is_empty() {
            form.push(("note", n.to_string()));
        }
    }
    if let Some(m) = req.timeout_minutes {
        form.push(("timeout", m.to_string()));
    }

    debug!(
        reference = req.reference,
        vendor = req.vendor,
        amount_cents = req.amount_cents,
        test_mode = cfg.test_mode,
        "nihaopay: POST /v1.2/transactions/securepay"
    );

    let resp = client
        .post(&url)
        .bearer_auth(&cfg.token)
        .header("Accept", "application/json")
        .form(&form)
        .send()
        .await?;

    let status = resp.status();
    let body_text = resp.text().await.unwrap_or_default();

    if !status.is_success() {
        // Try to parse as error body; fall back to raw text.
        if let Ok(err) = serde_json::from_str::<SecurePayRaw>(&body_text) {
            let code = err
                .error
                .as_ref()
                .and_then(|e| e.code.clone())
                .or(err.code)
                .unwrap_or_else(|| status.as_u16().to_string());
            let message = err
                .error
                .as_ref()
                .and_then(|e| e.message.clone())
                .or(err.message)
                .unwrap_or_else(|| body_text.clone());
            return Err(NihaoPayError::Api { code, message });
        }
        return Err(NihaoPayError::Api {
            code: status.as_u16().to_string(),
            message: body_text,
        });
    }

    let parsed: SecurePayRaw = serde_json::from_str(&body_text).map_err(|e| {
        warn!(err=%e, body=%body_text, "nihaopay: failed to parse securepay response");
        NihaoPayError::UnexpectedResponse(format!("parse: {e}"))
    })?;

    // Gateway-level error that came back with 200 (some gateways do this).
    if let Some(code) = parsed.code.clone() {
        if !code.is_empty() && code != "0" && code != "200" {
            return Err(NihaoPayError::Api {
                code,
                message: parsed.message.unwrap_or_default(),
            });
        }
    }

    let redirect = match (parsed.url.clone(), parsed.form.clone()) {
        (Some(url), _) if !url.is_empty() => SecurePayRedirect::Url { url },
        (_, Some(form)) => SecurePayRedirect::Form { form },
        _ => {
            return Err(NihaoPayError::UnexpectedResponse(
                "neither `url` nor `form` present".into(),
            ))
        }
    };

    Ok(SecurePayResult {
        transaction_id: parsed.transaction_id,
        redirect,
    })
}

// ---------------------------------------------------------------------------
// IPN signature verification
// ---------------------------------------------------------------------------

/// Verify a NihaoPay IPN payload's `verify_sign` value.
///
/// `params` is the raw form-posted body (every field, as received, with
/// original string values). `token` is the merchant bearer token (same one
/// used for Authorization on outbound requests).
///
/// Returns true if the computed sig matches the `verify_sign` param.
///
/// Algorithm (from NihaoPay IPN docs):
///   1. Take all params except `verify_sign` whose value is non-empty.
///   2. Sort by key ascending (lexicographic).
///   3. Concatenate as "k1=v1&k2=v2&..." — no URL-encoding, raw values.
///   4. Append "&" + MD5(TOKEN) lowercase hex.
///   5. MD5 the whole string, lowercase hex. Compare to verify_sign.
pub fn verify_ipn_sign<S: AsRef<str>>(token: &str, params: &[(S, S)]) -> bool {
    let received = params
        .iter()
        .find(|(k, _)| k.as_ref() == "verify_sign")
        .map(|(_, v)| v.as_ref().to_string());
    let Some(received) = received else {
        return false;
    };

    let computed = compute_ipn_sign(token, params);
    constant_time_eq(computed.as_bytes(), received.as_bytes())
}

/// Compute the expected verify_sign for a given payload. Exposed separately
/// for tests and for logging a "expected vs got" diff on mismatches.
pub fn compute_ipn_sign<S: AsRef<str>>(token: &str, params: &[(S, S)]) -> String {
    // Skip verify_sign itself and empty values; per docs, only non-empty
    // fields participate.
    let mut map: BTreeMap<&str, &str> = BTreeMap::new();
    for (k, v) in params {
        let key = k.as_ref();
        let val = v.as_ref();
        if key == "verify_sign" {
            continue;
        }
        if val.is_empty() {
            continue;
        }
        map.insert(key, val);
    }

    let joined = map
        .iter()
        .map(|(k, v)| format!("{k}={v}"))
        .collect::<Vec<_>>()
        .join("&");

    let token_md5 = md5_hex(token.as_bytes());
    let combined = format!("{joined}&{token_md5}");
    md5_hex(combined.as_bytes())
}

fn md5_hex(bytes: &[u8]) -> String {
    let mut h = Md5::new();
    h.update(bytes);
    let out = h.finalize();
    // lowercase hex (16 bytes -> 32 chars)
    let mut s = String::with_capacity(32);
    for b in out {
        s.push_str(&format!("{:02x}", b));
    }
    s
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn md5_hex_matches_known_vector() {
        // `md5("") == d41d8cd98f00b204e9800998ecf8427e`
        assert_eq!(md5_hex(b""), "d41d8cd98f00b204e9800998ecf8427e");
        // `md5("abc") == 900150983cd24fb0d6963f7d28e17f72`
        assert_eq!(md5_hex(b"abc"), "900150983cd24fb0d6963f7d28e17f72");
    }

    #[test]
    fn compute_ipn_sign_sorts_and_skips_empty_and_self() {
        // token = "secret"
        // params = b=2, a=1, c="", verify_sign="ignored"
        // -> sorted+nonempty = "a=1&b=2"
        // -> md5("secret") = 5ebe2294ecd0e0f08eab7690d2a6ee69
        // -> md5("a=1&b=2&5ebe2294ecd0e0f08eab7690d2a6ee69") = <computed>
        let params = [
            ("b", "2"),
            ("a", "1"),
            ("c", ""),
            ("verify_sign", "ignored"),
        ];
        let sig = compute_ipn_sign("secret", &params);
        // Sanity: md5 of "a=1&b=2&5ebe2294ecd0e0f08eab7690d2a6ee69"
        let expected = md5_hex(b"a=1&b=2&5ebe2294ecd0e0f08eab7690d2a6ee69");
        assert_eq!(sig, expected);
    }

    #[test]
    fn verify_ipn_sign_round_trips() {
        let token = "merchant_token_value";
        let params_owned: Vec<(String, String)> = vec![
            ("status".into(), "success".into()),
            ("transaction_id".into(), "9999".into()),
            ("amount".into(), "100".into()),
            ("currency".into(), "USD".into()),
        ];
        let sig = compute_ipn_sign(
            token,
            &params_owned
                .iter()
                .map(|(k, v)| (k.as_str(), v.as_str()))
                .collect::<Vec<_>>(),
        );

        let mut with_sign = params_owned.clone();
        with_sign.push(("verify_sign".into(), sig.clone()));
        let refs: Vec<(&str, &str)> = with_sign
            .iter()
            .map(|(k, v)| (k.as_str(), v.as_str()))
            .collect();
        assert!(verify_ipn_sign(token, &refs));

        // Tampered amount must fail.
        let mut tampered = with_sign.clone();
        tampered[2].1 = "1000000".into(); // change amount
        let refs2: Vec<(&str, &str)> = tampered
            .iter()
            .map(|(k, v)| (k.as_str(), v.as_str()))
            .collect();
        assert!(!verify_ipn_sign(token, &refs2));
    }
}
