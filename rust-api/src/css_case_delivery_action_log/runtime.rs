use crate::css_case_delivery_action_log::types::{
    CreateDeliveryActionLogRequest, CssCaseDeliveryActionLogRecord, DeliveryActionLogQueryRequest,
};

fn action_target_hash(
    target: &crate::css_case_delivery_actions_engine::types::DeliveryActionTarget,
) -> anyhow::Result<String> {
    use sha2::{Digest, Sha256};

    let s = serde_json::to_string(target)?;
    Ok(format!("{:x}", Sha256::digest(s.as_bytes())))
}

fn api_target_from_log_target(
    target: &crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
) -> crate::css_case_delivery_api::types::DeliveryApiTarget {
    crate::css_case_delivery_decision_trace::runtime::api_target_from_log_target(target)
}

fn action_target_from_legacy(
    target: &crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    delivered: bool,
    failure_streak: usize,
) -> crate::css_case_delivery_actions_engine::types::DeliveryActionTarget {
    crate::css_case_delivery_actions_engine::types::DeliveryActionTarget {
        target: api_target_from_log_target(target),
        consecutive_failures: failure_streak,
        latest_failed: !delivered,
    }
}

pub fn build_delivery_action_log_record(
    req: CreateDeliveryActionLogRequest,
    now_rfc3339: &str,
) -> CssCaseDeliveryActionLogRecord {
    CssCaseDeliveryActionLogRecord {
        action_log_id: format!("cdactlog_{}", uuid::Uuid::new_v4()),
        action: req.action.clone(),
        action_target: req.action_target,
        succeeded: req.succeeded,
        message: req.message,
        created_at: now_rfc3339.to_string(),
        actor_user_id: req.actor_user_id,
        reason: req.reason,
        target: req.target,
        mode: req.mode,
        subject_key: req.subject_key,
        success: req.success,
        result_message: req.result_message,
        payload_name: req.payload_name,
        snapshot_id: req.snapshot_id,
    }
}

pub async fn write_delivery_action_log(
    pool: &sqlx::PgPool,
    req: CreateDeliveryActionLogRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryActionLogRecord> {
    let record = build_delivery_action_log_record(req, now_rfc3339);
    let target_hash = action_target_hash(&record.action_target)?;
    crate::css_case_delivery_action_log::store_pg::insert_delivery_action_log(
        pool,
        &target_hash,
        &record,
    )
    .await?;
    Ok(record)
}

pub async fn log_delivery_action_result(
    pool: &sqlx::PgPool,
    action_req: &crate::css_case_delivery_actions_engine::types::DeliveryActionRequest,
    action_result: &crate::css_case_delivery_actions_engine::types::DeliveryActionResult,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryActionLogRecord> {
    write_delivery_action_log(
        pool,
        CreateDeliveryActionLogRequest {
            action: action_req.action.clone(),
            action_target: action_target_from_legacy(
                &action_req.target,
                action_req.delivered,
                action_req.failure_streak,
            ),
            succeeded: action_result.success,
            message: action_result.message.clone(),
            actor_user_id: action_req.actor_user_id.clone(),
            reason: action_req.reason.clone(),
            target: action_req.target.clone(),
            mode: action_req.mode.clone(),
            subject_key: action_result.subject_key.clone().unwrap_or_else(|| {
                crate::css_case_delivery_actions_engine::policy::subject_key(
                    &action_req.target,
                    &action_req.mode,
                )
            }),
            success: action_result.success,
            result_message: action_result.message.clone(),
            payload_name: action_result.payload_name.clone(),
            snapshot_id: action_result.snapshot_id.clone(),
        },
        now_rfc3339,
    )
    .await
}

pub async fn run_delivery_action_and_log(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_actions_engine::types::DeliveryActionRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryActionLogRecord> {
    let result = crate::css_case_delivery_actions_engine::runtime::execute_delivery_action(
        pool,
        req.clone(),
        now_rfc3339,
    )
    .await;

    match result {
        Ok(ok) => {
            write_delivery_action_log(
                pool,
                CreateDeliveryActionLogRequest {
                    action: ok.action.clone(),
                    action_target: action_target_from_legacy(
                        &req.target,
                        req.delivered,
                        req.failure_streak,
                    ),
                    succeeded: ok.success,
                    message: ok.message.clone(),
                    actor_user_id: req.actor_user_id,
                    reason: req.reason,
                    target: req.target,
                    mode: req.mode,
                    subject_key: ok.subject_key.unwrap_or_default(),
                    success: ok.success,
                    result_message: ok.message,
                    payload_name: ok.payload_name,
                    snapshot_id: ok.snapshot_id,
                },
                now_rfc3339,
            )
            .await
        }
        Err(err) => {
            let subject_key = crate::css_case_delivery_actions_engine::policy::subject_key(
                &req.target,
                &req.mode,
            );
            write_delivery_action_log(
                pool,
                CreateDeliveryActionLogRequest {
                    action: req.action,
                    action_target: action_target_from_legacy(
                        &req.target,
                        req.delivered,
                        req.failure_streak,
                    ),
                    succeeded: false,
                    message: err.to_string(),
                    actor_user_id: req.actor_user_id,
                    reason: req.reason,
                    target: req.target,
                    mode: req.mode,
                    subject_key,
                    success: false,
                    result_message: err.to_string(),
                    payload_name: None,
                    snapshot_id: None,
                },
                now_rfc3339,
            )
            .await
        }
    }
}

pub async fn query_delivery_action_logs(
    pool: &sqlx::PgPool,
    req: DeliveryActionLogQueryRequest,
) -> anyhow::Result<Vec<CssCaseDeliveryActionLogRecord>> {
    let mut logs =
        crate::css_case_delivery_action_log::store_pg::list_delivery_action_logs(pool, &req)
            .await
            .unwrap_or_default();

    logs.retain(|x| {
        if let Some(target) = &req.target {
            if &x.action_target.target != target {
                return false;
            }
        }

        if let Some(action) = &req.action {
            if &x.action != action {
                return false;
            }
        }

        if let Some(succeeded) = req.succeeded {
            if x.succeeded != succeeded {
                return false;
            }
        }

        true
    });

    logs.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    if let Some(limit) = req.limit {
        logs.truncate(limit);
    }

    Ok(logs)
}
