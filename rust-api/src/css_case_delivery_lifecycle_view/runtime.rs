use crate::css_case_delivery_lifecycle_view::types::{
    CssCaseDeliveryLifecycleView, DeliveryLifecycleLegacyRequest, DeliveryLifecycleStage,
    DeliveryLifecycleStageKind, DeliveryLifecycleStageNode, DeliveryLifecycleViewRequest,
};

fn lifecycle_stage_from_resolution_state(
    state: &crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState,
) -> DeliveryLifecycleStage {
    use crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState as R;

    match state {
        R::Resolved => DeliveryLifecycleStage::Resolved,
        R::Stabilized => DeliveryLifecycleStage::Stabilized,
        R::Escalated => DeliveryLifecycleStage::Escalated,
        R::UnderManualIntervention => DeliveryLifecycleStage::ManualIntervention,
        R::MonitoringOnly => DeliveryLifecycleStage::Observed,
    }
}

fn legacy_kind_from_stage(stage: &DeliveryLifecycleStage) -> DeliveryLifecycleStageKind {
    match stage {
        DeliveryLifecycleStage::Observed => DeliveryLifecycleStageKind::Initial,
        DeliveryLifecycleStage::ActiveHandling => DeliveryLifecycleStageKind::Monitoring,
        DeliveryLifecycleStage::Escalated => DeliveryLifecycleStageKind::Escalated,
        DeliveryLifecycleStage::ManualIntervention => {
            DeliveryLifecycleStageKind::UnderManualIntervention
        }
        DeliveryLifecycleStage::Stabilized => DeliveryLifecycleStageKind::Stabilized,
        DeliveryLifecycleStage::Resolved => DeliveryLifecycleStageKind::Resolved,
    }
}

fn lifecycle_stage_summary(stage: &DeliveryLifecycleStage) -> String {
    match stage {
        DeliveryLifecycleStage::Observed => "对象已进入系统观测范围。".into(),
        DeliveryLifecycleStage::ActiveHandling => "对象已进入主动处理阶段。".into(),
        DeliveryLifecycleStage::Escalated => "对象已进入升级处理阶段。".into(),
        DeliveryLifecycleStage::ManualIntervention => "对象已进入人工介入阶段。".into(),
        DeliveryLifecycleStage::Stabilized => "对象已进入稳定阶段。".into(),
        DeliveryLifecycleStage::Resolved => "对象已进入已解决阶段。".into(),
    }
}

fn has_stage(stages: &[DeliveryLifecycleStageNode], stage: &DeliveryLifecycleStage) -> bool {
    stages.iter().any(|item| &item.stage == stage)
}

fn push_stage_if_absent(
    stages: &mut Vec<DeliveryLifecycleStageNode>,
    stage: DeliveryLifecycleStage,
    entered_at: Option<String>,
) {
    if has_stage(stages, &stage) {
        return;
    }

    let kind = legacy_kind_from_stage(&stage);
    stages.push(DeliveryLifecycleStageNode {
        summary: lifecycle_stage_summary(&stage),
        title: crate::css_case_delivery_lifecycle_view::composer::stage_title(&kind),
        started_at: entered_at.clone(),
        kind,
        stage,
        entered_at,
    });
}

fn current_stage(
    status: &crate::css_case_delivery_status_view::types::CssCaseDeliveryStatusView,
) -> DeliveryLifecycleStage {
    lifecycle_stage_from_resolution_state(&status.state)
}

fn lifecycle_summary(current_stage: &DeliveryLifecycleStage, stage_count: usize) -> String {
    format!(
        "该对象共经历 {} 个生命周期阶段，当前处于 {:?}。",
        stage_count, current_stage
    )
}

async fn load_resolution_logs_for_legacy(
    pool: &sqlx::PgPool,
    req: &DeliveryLifecycleLegacyRequest,
) -> anyhow::Result<
    Vec<crate::css_case_delivery_resolution_log::types::CssCaseDeliveryResolutionLogRecord>,
> {
    crate::css_case_delivery_resolution_log::store_pg::list_delivery_resolution_logs_for_subject(
        pool,
        &req.target,
        &req.mode,
    )
    .await
}

async fn load_action_logs_for_legacy(
    pool: &sqlx::PgPool,
    req: &DeliveryLifecycleLegacyRequest,
) -> anyhow::Result<Vec<crate::css_case_delivery_action_log::types::CssCaseDeliveryActionLogRecord>>
{
    crate::css_case_delivery_action_log::store_pg::list_delivery_action_logs_for_subject(
        pool,
        &crate::css_case_delivery_actions_engine::policy::subject_key(&req.target, &req.mode),
    )
    .await
}

fn log_target_from_api_target(
    target: &crate::css_case_delivery_api::types::DeliveryApiTarget,
) -> crate::css_case_delivery_log::types::CaseDeliveryLogTarget {
    match target {
        crate::css_case_delivery_api::types::DeliveryApiTarget::FrontendDownload => {
            crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Dashboard
        }
        crate::css_case_delivery_api::types::DeliveryApiTarget::Bot => {
            crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Alerts
        }
        crate::css_case_delivery_api::types::DeliveryApiTarget::Email => {
            crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Digest
        }
        crate::css_case_delivery_api::types::DeliveryApiTarget::ThirdPartyClient => {
            crate::css_case_delivery_log::types::CaseDeliveryLogTarget::ReportBundle
        }
    }
}

pub async fn build_delivery_lifecycle_view(
    pool: &sqlx::PgPool,
    req: DeliveryLifecycleViewRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryLifecycleView> {
    let legacy = DeliveryLifecycleLegacyRequest {
        target: log_target_from_api_target(&req.target),
        mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode::Attachment,
        consecutive_failures: req.consecutive_failures,
        retry_still_failing: req.latest_failed && req.consecutive_failures > 1,
        replay_limit: None,
        action_limit: None,
    };

    build_delivery_lifecycle_view_from_legacy(pool, legacy, now_rfc3339).await
}

pub async fn build_delivery_lifecycle_view_from_legacy(
    pool: &sqlx::PgPool,
    req: DeliveryLifecycleLegacyRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryLifecycleView> {
    let status = crate::css_case_delivery_status_view::runtime::build_delivery_status_view(
        pool,
        crate::css_case_delivery_status_view::types::DeliveryStatusViewRequest {
            target: req.target.clone(),
            mode: req.mode.clone(),
            consecutive_failures: req.consecutive_failures,
            retry_still_failing: req.retry_still_failing,
            replay_limit: req.replay_limit,
            action_limit: req.action_limit,
        },
    )
    .await?;

    let resolution_logs = load_resolution_logs_for_legacy(pool, &req)
        .await
        .unwrap_or_default();
    let action_logs = load_action_logs_for_legacy(pool, &req)
        .await
        .unwrap_or_default();

    let mut stages = Vec::new();

    push_stage_if_absent(&mut stages, DeliveryLifecycleStage::Observed, None);

    if !action_logs.is_empty() {
        let entered_at = action_logs.iter().map(|x| x.created_at.clone()).min();
        push_stage_if_absent(
            &mut stages,
            DeliveryLifecycleStage::ActiveHandling,
            entered_at,
        );
    }

    let mut ordered_logs = resolution_logs;
    ordered_logs.sort_by(|a, b| a.created_at.cmp(&b.created_at));

    for log in ordered_logs {
        let stage = lifecycle_stage_from_resolution_state(&log.state);
        push_stage_if_absent(&mut stages, stage, Some(log.created_at));
    }

    let current = current_stage(&status);
    let summary = lifecycle_summary(&current, stages.len());

    let _ = now_rfc3339;

    Ok(CssCaseDeliveryLifecycleView {
        current_status: status,
        current_stage: current,
        summary,
        stages,
    })
}
