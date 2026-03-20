use crate::cssapi::request_id::RequestIdLayer;
use crate::cssapi::trace::make_trace_layer;
use opentelemetry_otlp::WithExportConfig;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::EnvFilter;

mod artifact_versions;
mod artifacts;
mod artifacts_api;
mod audio_provider;
mod auth;
mod billing;
mod billing_matrix;
mod config;
mod continuity_engine;
mod css_access_gate;
mod css_assurance_api;
mod css_auction_engine;
mod css_auto_bid_engine;
mod css_bid_ledger;
mod css_case_action_log;
mod css_case_actions_engine;
mod css_case_alerts_view;
mod css_case_analytics_view;
mod css_case_api;
mod css_case_briefing_pack;
mod css_case_dashboard_view;
mod css_case_delivery_action_log;
mod css_case_delivery_actions_engine;
mod css_case_delivery_alerts_view;
mod css_case_delivery_analytics_view;
mod css_case_delivery_api;
mod css_case_delivery_assurance_view;
mod css_case_delivery_briefing_pack;
mod css_case_delivery_dashboard_view;
mod css_case_delivery_decision_trace;
mod css_case_delivery_delivery_api;
mod css_case_delivery_digest_engine;
mod css_case_delivery_execution_retry_engine;
mod css_case_delivery_execution_status_view;
mod css_case_delivery_explain_api;
mod css_case_delivery_explain_view;
mod css_case_delivery_export_engine;
mod css_case_delivery_governance;
mod css_case_delivery_inbox_view;
mod css_case_delivery_inspector_view;
mod css_case_delivery_kpi_view;
mod css_case_delivery_lifecycle_view;
mod css_case_delivery_log;
mod css_case_delivery_ops_console;
mod css_case_delivery_policy_audit;
mod css_case_delivery_policy_engine;
mod css_case_delivery_policy_versioning;
mod css_case_delivery_query_engine;
mod css_case_delivery_recovery_view;
mod css_case_delivery_report_api;
mod css_case_delivery_resolution_engine;
mod css_case_delivery_resolution_log;
mod css_case_delivery_retry_engine;
mod css_case_delivery_risk_view;
mod css_case_delivery_signals_cache;
mod css_case_delivery_signals_hub;
mod css_case_delivery_signals_invalidation;
mod css_case_delivery_signals_narrative;
mod css_case_delivery_signals_replay;
mod css_case_delivery_signals_snapshot;
mod css_case_delivery_status_view;
mod css_case_delivery_storyboard;
mod css_case_delivery_subscription_engine;
mod css_case_delivery_summary_engine;
mod css_case_delivery_timeline_explain;
mod css_case_delivery_timeline_merge;
mod css_case_delivery_timeline_ui_model;
mod css_case_delivery_trends_view;
mod css_case_delivery_trust_view;
mod css_case_delivery_workspace;
mod css_case_digest_engine;
mod css_case_export_engine;
mod css_case_inbox_view;
mod css_case_kpi_view;
mod css_case_lifecycle_view;
mod css_case_query_engine;
mod css_case_report_api;
mod css_case_status_view;
mod css_case_subscription_engine;
mod css_case_summary_engine;
mod css_case_timeline_explain;
mod css_case_timeline_merge;
mod css_case_trends_view;
mod css_case_workspace;
mod css_catalog_engine;
mod css_commerce_manifest;
mod css_deal_engine;
mod css_decision_graph;
mod css_dispute_engine;
mod css_entitlement;
mod css_explain_api;
mod css_governance_timeline;
mod css_inspector_view;
mod css_market_view_engine;
mod css_moderation_engine;
mod css_operator_console;
mod css_ownership_engine;
mod css_policy_engine;
mod css_policy_migration;
mod css_policy_versioning;
mod css_reasoning_view;
mod css_reputation_engine;
mod css_resolution_engine;
mod css_resolution_log;
mod css_review_queue;
mod css_rights_engine;
mod css_risk_api;
mod css_rule_audit;
mod css_signals_cache;
mod css_signals_hub;
mod css_signals_invalidation;
mod css_signals_narrative;
mod css_signals_replay;
mod css_signals_snapshot;
mod css_signals_storyboard;
mod css_timeline_ui_model;
mod css_trust_api;
mod css_ts_runtime;
mod cssapi;
mod dag;
mod dag_export;
mod dag_runtime;
mod dag_v3;
mod dag_viz_html;
mod db;
mod distributed;
mod dsl;
mod engine_registry;
mod engines;
mod ephemeral;
mod event_engine;
mod events;
mod film_runtime;
mod i18n;
mod immersion_engine;
mod jobs;
mod market_package;
mod media;
mod metrics;
mod models;
mod narrative_qa;
mod orchestrator;
mod passkey;
mod physics_engine;
mod pipeline_status;
mod presence_engine;
mod procutil;
mod production_view;
mod public_api;
mod quality_config;
mod quality_director;
mod quality_gates;
mod quality_history;
mod quality_versions;
mod ready;
mod release_gate;
mod routes;
mod run_state;
mod run_state_io;
mod run_store;
mod run_worker;
mod runner;
mod runs_api;
mod runs_list;
mod runtime_diff;
mod runtime_replay;
mod scene_semantics_engine;
mod scheduler;
mod schema_keys;
mod subtitles;
mod timeline;
mod timeutil;
mod video;
mod video_dispatch;
mod video_executor;
mod what_if;
mod ws;

#[tokio::main]
async fn main() {
    if std::env::args().any(|a| a == "--print-openapi") {
        let doc = crate::cssapi::openapi::build_openapi();
        print!("{}", doc.to_json().unwrap_or_else(|_| "{}".to_string()));
        return;
    }

    init_tracing();

    let mode = std::env::var("CSS_MODE").unwrap_or_else(|_| "all".to_string());

    let config = config::Config::from_env().expect("DATABASE_URL not configured");
    let pool = db::connect(&config.database_url)
        .await
        .expect("db connect failed");
    let skip_migrate = std::env::var("CSS_SKIP_DB_MIGRATE")
        .ok()
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    if !skip_migrate {
        db::migrate(&pool).await.expect("db migrate failed");
    }
    if let Err(e) = quality_history::init_db(&pool).await {
        tracing::warn!(error = %e, "quality history init failed");
    }

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
    if mode == "api" {
        let _worker_handles = jobs::worker::start_workers(workers).await;
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

#[cfg(feature = "bin_video_assemble")]
#[tokio::main]
async fn main_video_assemble() -> anyhow::Result<()> {
    let runs_dir = std::env::var("RUNS_DIR").unwrap_or_else(|_| "/srv/cssos/runs".to_string());
    let run_id = std::env::var("RUN_ID").map_err(|_| anyhow::anyhow!("RUN_ID required"))?;
    let run_dir = std::path::PathBuf::from(runs_dir)
        .join(run_id)
        .join("build/video");
    let ve = crate::video::VideoExecutor::new(run_dir.clone());
    let out = run_dir.join("video.mp4");
    let shots_n = std::env::var("VIDEO_SHOTS")
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(0);
    let mut shots = Vec::new();
    for i in 0..shots_n {
        shots.push(run_dir.join(format!("shots/video_shot_{:03}.mp4", i)));
    }
    ve.assemble(&shots, &out).await?;
    Ok(())
}
