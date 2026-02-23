use std::env;

#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    pub bind_addr: String,
    pub session_cookie: String,
    pub session_ttl_days: i64,
    pub billing_unit_price_cents: i64,
    pub env: String,
}

impl Config {
    pub fn from_env() -> Result<Self, String> {
        let database_url = env::var("DATABASE_URL")
            .map_err(|_| "DATABASE_URL not configured on api-vm".to_string())?;
        let bind_addr = env::var("RUST_API_BIND").unwrap_or_else(|_| "127.0.0.1:8081".to_string());
        let session_cookie = env::var("SESSION_COOKIE_NAME").unwrap_or_else(|_| "cssos_session".to_string());
        let session_ttl_days = env::var("SESSION_TTL_DAYS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(30);
        let billing_unit_price_cents = env::var("BILLING_UNIT_PRICE_CENTS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(1);
        let env = env::var("RUST_ENV").unwrap_or_else(|_| "production".to_string());
        Ok(Self {
            database_url,
            bind_addr,
            session_cookie,
            session_ttl_days,
            billing_unit_price_cents,
            env,
        })
    }
}
