use std::sync::{Mutex, OnceLock};

use axum::{routing::post, Json, Router};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::prod::auth::validate_token;
use crate::prod::billing::{charge, cost_per_job};
use crate::prod::queue::{Job, JobQueue};
use crate::prod::tenant::TenantManager;

#[derive(Deserialize)]
pub struct Req {
    pub prompt: String,
    pub token: String,
}

#[derive(Serialize)]
pub struct Resp {
    pub job_id: String,
}

fn tenant_manager() -> &'static Mutex<TenantManager> {
    static TENANTS: OnceLock<Mutex<TenantManager>> = OnceLock::new();
    TENANTS.get_or_init(|| Mutex::new(TenantManager::new()))
}

fn queue() -> &'static Mutex<JobQueue> {
    static QUEUE: OnceLock<Mutex<JobQueue>> = OnceLock::new();
    QUEUE.get_or_init(|| Mutex::new(JobQueue::new()))
}

pub async fn generate(Json(req): Json<Req>) -> Json<Resp> {
    let tenant_id = validate_token(&req.token).unwrap_or_default();
    let cost = cost_per_job(20, 256);

    if let Ok(mut manager) = tenant_manager().lock() {
        let tenant = manager.get(&tenant_id);
        assert!(charge(tenant, cost), "no credits");
    }

    let job = Job {
        id: Uuid::new_v4().to_string(),
        tenant_id,
        prompt: req.prompt,
    };

    if let Ok(mut job_queue) = queue().lock() {
        job_queue.push(job.clone());
    }

    Json(Resp { job_id: job.id })
}

pub fn router() -> Router {
    Router::new().route("/generate", post(generate))
}
