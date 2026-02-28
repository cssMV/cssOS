use tracing_subscriber::EnvFilter;

mod auth;
mod billing;
mod config;
mod cssapi;
mod cssapi_openapi;
mod runs_api;
mod runs_list;
mod dag;
mod dag_runtime;
mod ready;
mod dag_export;
mod dag_viz_html;
mod db;
mod dsl;
mod models;
mod metrics;
mod timeutil;
mod jobs;
mod routes;
mod run_state;
mod run_store;
mod run_worker;
mod runner;
mod run_state_io;
mod video;
mod video_dispatch;
mod pipeline_status;
mod video_executor;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let config = config::Config::from_env().expect("DATABASE_URL not configured");
    let pool = db::connect(&config.database_url).await.expect("db connect failed");
    db::migrate(&pool).await.expect("db migrate failed");

    let workers = std::env::var("CSS_RUN_CONCURRENCY")
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .filter(|n| *n > 0)
        .unwrap_or(2);
    jobs::queue::init(256).await;
    let _worker_handles = jobs::worker::start_workers(workers).await;

    let state = routes::AppState { pool: pool.clone(), config: config.clone(), jobs: jobs::Jobs::new() };
    let app = routes::router(state)
        .layer(tower_http::trace::TraceLayer::new_for_http())
        .layer(axum::extract::Extension(pool))
        .layer(axum::extract::Extension(config.session_cookie.clone()));

    let listener = tokio::net::TcpListener::bind(&config.bind_addr)
        .await
        .expect("bind failed");
    axum::serve(listener, app).await.expect("server failed");
}
