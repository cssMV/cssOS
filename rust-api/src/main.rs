use axum::Router;
use tracing_subscriber::EnvFilter;

mod auth;
mod billing;
mod config;
mod db;
mod models;
mod routes;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let config = config::Config::from_env().expect("DATABASE_URL not configured");
    let pool = db::connect(&config.database_url).await.expect("db connect failed");
    db::migrate(&pool).await.expect("db migrate failed");

    let state = routes::AppState { pool: pool.clone(), config: config.clone() };
    let app = routes::router(state)
        .layer(tower_http::trace::TraceLayer::new_for_http())
        .layer(axum::extract::Extension(pool))
        .layer(axum::extract::Extension(config.session_cookie.clone()));

    let listener = tokio::net::TcpListener::bind(&config.bind_addr)
        .await
        .expect("bind failed");
    axum::serve(listener, app).await.expect("server failed");
}
