use crate::cssapi::request_id::RequestIdLayer;
use crate::cssapi::trace::make_trace_layer;
use opentelemetry_otlp::WithExportConfig;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::EnvFilter;

mod auth;
mod billing;
mod config;
mod cssapi;
mod dag;
mod dag_export;
mod dag_runtime;
mod dag_viz_html;
mod db;
mod distributed;
mod dsl;
mod events;
mod jobs;
mod metrics;
mod models;
mod pipeline_status;
mod ready;
mod routes;
mod run_state;
mod run_state_io;
mod run_store;
mod run_worker;
mod runner;
mod runs_api;
mod runs_list;
mod scheduler;
mod timeutil;
mod video;
mod video_dispatch;
mod video_executor;
mod ws;

#[tokio::main]
async fn main() {
    if std::env::args().any(|a| a == "--print-openapi") {
        let doc = crate::cssapi::openapi::build_openapi();
        print!(
            "{}",
            doc.to_json().unwrap_or_else(|_| "{}".to_string())
        );
        return;
    }

    init_tracing();

    let mode = std::env::var("CSS_MODE").unwrap_or_else(|_| "all".to_string());

    let config = config::Config::from_env().expect("DATABASE_URL not configured");
    let pool = db::connect(&config.database_url)
        .await
        .expect("db connect failed");
    db::migrate(&pool).await.expect("db migrate failed");

    let workers = std::env::var("CSS_RUN_CONCURRENCY")
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .filter(|n| *n > 0)
        .unwrap_or(2);
    let global_limit = num_cpus::get().max(2);
    metrics::set_global_slots_total(global_limit);
    jobs::queue::init(global_limit).await;
    if mode == "worker" || mode == "all" {
        let restored = jobs::worker::restore_incomplete_runs().await.unwrap_or(0);
        if restored > 0 {
            tracing::info!(restored_runs = restored, "restored incomplete runs");
        }
        let _worker_handles = jobs::worker::start_workers(workers).await;
        if mode == "worker" {
            loop {
                tokio::time::sleep(std::time::Duration::from_secs(3600)).await;
            }
        }
    }

    let state = routes::AppState {
        pool: pool.clone(),
        config: config.clone(),
        jobs: jobs::Jobs::new(),
        event_bus: events::global_bus(),
    };
    let app = routes::router(state)
        .layer(RequestIdLayer::default())
        .layer(make_trace_layer())
        .layer(axum::extract::Extension(pool))
        .layer(axum::extract::Extension(config.session_cookie.clone()));

    let listener = tokio::net::TcpListener::bind(&config.bind_addr)
        .await
        .expect("bind failed");
    axum::serve(listener, app).await.expect("server failed");
}

fn init_tracing() {
    let env_filter = EnvFilter::from_default_env();
    let fmt_layer = tracing_subscriber::fmt::layer();

    if let Ok(endpoint) = std::env::var("OTEL_EXPORTER_OTLP_ENDPOINT") {
        let exporter = opentelemetry_otlp::new_exporter()
            .tonic()
            .with_endpoint(endpoint);
        if let Ok(tracer) = opentelemetry_otlp::new_pipeline()
            .tracing()
            .with_exporter(exporter)
            .install_simple()
        {
            let telemetry = tracing_opentelemetry::layer().with_tracer(tracer);
            tracing_subscriber::registry()
                .with(env_filter)
                .with(fmt_layer)
                .with(telemetry)
                .init();
            return;
        }
    }

    tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt_layer)
        .init();
}
