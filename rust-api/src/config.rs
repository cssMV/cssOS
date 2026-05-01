use std::env;

#[derive(Clone, Debug)]
pub struct NihaoPayConfig {
    /// Bearer token issued by NihaoPay TMS (kept out of code; loaded from
    /// /etc/cssos.env). Empty = payments disabled (checkout endpoint returns
    /// 503, webhook still accepts posts for log-only replay).
    pub token: String,
    /// Base URL. apitest.nihaopay.com for sandbox, api.nihaopay.com for live.
    pub base_url: String,
    /// Public-facing IPN callback URL NihaoPay will POST to.
    pub ipn_url: String,
    /// Public-facing URL we redirect the user back to after the hosted page.
    pub callback_url: String,
    /// True = talk to the sandbox (apitest.nihaopay.com). Used to display a
    /// banner in the UI and to avoid cross-environment IPN mix-ups.
    pub test_mode: bool,
    /// Platform fee on marketplace purchases, in basis points (1000 = 10%).
    pub purchase_platform_bps: i64,
    /// Platform fee on tips, in basis points (0 = 0%).
    pub tip_platform_bps: i64,
}

impl NihaoPayConfig {
    pub fn is_enabled(&self) -> bool {
        !self.token.is_empty()
    }
}

#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    pub bind_addr: String,
    pub session_cookie: String,
    pub session_ttl_days: i64,
    pub billing_unit_price_cents: i64,
    pub env: String,
    pub nihaopay: NihaoPayConfig,
    /// CSSOS_PHASE2_BYOK 20260420 — base64-encoded 32-byte AES-256-GCM master
    /// key used to encrypt rows in `engine_credentials`. Empty string ⇒ BYOK
    /// feature is disabled; dispatch always falls through to the platform
    /// env keys. Set once per environment and never rotated without a
    /// migration (rotation requires re-encrypting every stored row).
    pub engine_cred_master_key: String,
}

impl Config {
    pub fn from_env() -> Result<Self, String> {
        let database_url = env::var("DATABASE_URL")
            .map_err(|_| "DATABASE_URL not configured on api-vm".to_string())?;
        let bind_addr = env::var("RUST_API_BIND").unwrap_or_else(|_| "127.0.0.1:8081".to_string());
        let session_cookie =
            env::var("SESSION_COOKIE_NAME").unwrap_or_else(|_| "cssos_session".to_string());
        let session_ttl_days = env::var("SESSION_TTL_DAYS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(30);
        let billing_unit_price_cents = env::var("BILLING_UNIT_PRICE_CENTS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(1);
        let env = env::var("RUST_ENV").unwrap_or_else(|_| "production".to_string());

        let nihaopay_test_mode = env::var("NIHAOPAY_TEST_MODE")
            .ok()
            .map(|v| matches!(v.as_str(), "1" | "true" | "TRUE" | "yes"))
            .unwrap_or(false);
        let default_base = if nihaopay_test_mode {
            "https://apitest.nihaopay.com"
        } else {
            "https://api.nihaopay.com"
        };
        let nihaopay = NihaoPayConfig {
            token: env::var("NIHAOPAY_TOKEN").unwrap_or_default(),
            base_url: env::var("NIHAOPAY_BASE_URL").unwrap_or_else(|_| default_base.to_string()),
            ipn_url: env::var("NIHAOPAY_IPN_URL")
                .unwrap_or_else(|_| "https://cssstudio.app/api/payments/webhook/nihaopay".into()),
            callback_url: env::var("NIHAOPAY_CALLBACK_URL")
                .unwrap_or_else(|_| "https://cssstudio.app/billing/return".into()),
            test_mode: nihaopay_test_mode,
            purchase_platform_bps: env::var("NIHAOPAY_PURCHASE_PLATFORM_BPS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(1000), // 10%
            tip_platform_bps: env::var("NIHAOPAY_TIP_PLATFORM_BPS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(0), // 0%
        };

        let engine_cred_master_key =
            env::var("ENGINE_CRED_MASTER_KEY").unwrap_or_default();

        Ok(Self {
            database_url,
            bind_addr,
            session_cookie,
            session_ttl_days,
            billing_unit_price_cents,
            env,
            nihaopay,
            engine_cred_master_key,
        })
    }
}
