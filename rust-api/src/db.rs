use sqlx::{postgres::PgPoolOptions, PgPool};
use std::time::Duration;

fn pool_options() -> PgPoolOptions {
    let max_connections = std::env::var("CSS_DB_MAX_CONNECTIONS")
        .ok()
        .and_then(|v| v.parse::<u32>().ok())
        .filter(|v| *v > 0)
        .unwrap_or(2);
    let acquire_timeout_secs = std::env::var("CSS_DB_ACQUIRE_TIMEOUT_SECS")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .filter(|v| *v > 0)
        .unwrap_or(10);

    PgPoolOptions::new()
        .max_connections(max_connections)
        .min_connections(0)
        .acquire_timeout(Duration::from_secs(acquire_timeout_secs))
}

pub async fn connect(database_url: &str) -> Result<PgPool, sqlx::Error> {
    pool_options().connect(database_url).await
}

pub fn connect_lazy(database_url: &str) -> Result<PgPool, sqlx::Error> {
    pool_options().connect_lazy(database_url)
}

pub async fn migrate(pool: &PgPool) -> Result<(), sqlx::migrate::MigrateError> {
    sqlx::migrate!("./migrations").run(pool).await
}
