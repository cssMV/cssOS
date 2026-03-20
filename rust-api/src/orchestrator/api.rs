use axum::{extract::State, http::StatusCode, Json};

use crate::cssapi::error::ApiError;

use super::build::build_execution_plan_from_api;
use super::request::{CreateMvApiRequest, CreateMvApiResponse};

pub async fn create_mv_api(
    State(app): State<crate::routes::AppState>,
    Json(req): Json<CreateMvApiRequest>,
) -> Result<(StatusCode, Json<CreateMvApiResponse>), ApiError> {
    let (_engine_selection, matrix, plan) = build_execution_plan_from_api(&req).map_err(|e| {
        let msg = e.to_string();
        ApiError::unprocessable("INVALID_REQUEST", &msg)
    })?;

    let remaining = crate::billing_matrix::get_user_remaining_credits_usd("demo-user");
    let estimate = crate::billing_matrix::estimate_price(
        &req.engine.name,
        &req.engine.version,
        &matrix,
        remaining,
    );
    if !estimate.quota.allowed {
        return Err(ApiError::unprocessable(
            "INSUFFICIENT_CREDITS",
            "insufficient credits for this request",
        ));
    }

    let run_id = crate::runs_api::create_run_from_dag_plan(&app, &req, &plan)
        .await
        .map_err(|e| {
            let msg = e.to_string();
            ApiError::internal("RUN_CREATE_FAILED", &msg)
        })?;

    Ok((
        StatusCode::ACCEPTED,
        Json(CreateMvApiResponse {
            run_id,
            engine: req.engine,
            billing: Some(estimate),
        }),
    ))
}
