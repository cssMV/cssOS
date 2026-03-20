fn subject_key(
    target: &crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    mode: &crate::css_case_delivery_log::types::CaseDeliveryLogMode,
) -> String {
    crate::css_case_delivery_signals_snapshot::runtime::subject_key(target, mode)
}

async fn build_replay_delta(
    pool: &sqlx::PgPool,
    subject_key: &str,
) -> anyhow::Result<Option<crate::css_case_delivery_inspector_view::types::DeliveryReplayDeltaView>>
{
    let snapshots =
        crate::css_case_delivery_signals_snapshot::store_pg::list_signals_snapshots_for_subject(
            pool,
            subject_key,
        )
        .await
        .unwrap_or_default();

    if snapshots.len() < 2 {
        return Ok(None);
    }

    let prev = &snapshots[snapshots.len() - 2];
    let curr = &snapshots[snapshots.len() - 1];

    let prev_env = serde_json::from_value::<
        crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotEnvelope,
    >(prev.payload_json.clone())?;
    let curr_env = serde_json::from_value::<
        crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotEnvelope,
    >(curr.payload_json.clone())?;

    let mut changes = Vec::new();

    if format!("{:?}", prev_env.trust.trust_level) != format!("{:?}", curr_env.trust.trust_level) {
        changes.push(format!(
            "trust: {:?} -> {:?}",
            prev_env.trust.trust_level, curr_env.trust.trust_level
        ));
    }

    if format!("{:?}", prev_env.risk.risk_level) != format!("{:?}", curr_env.risk.risk_level) {
        changes.push(format!(
            "risk: {:?} -> {:?}",
            prev_env.risk.risk_level, curr_env.risk.risk_level
        ));
    }

    if format!("{:?}", prev_env.assurance.monitoring_level)
        != format!("{:?}", curr_env.assurance.monitoring_level)
    {
        changes.push(format!(
            "monitoring: {:?} -> {:?}",
            prev_env.assurance.monitoring_level, curr_env.assurance.monitoring_level
        ));
    }

    if prev_env.explain.fields.decisive_rule != curr_env.explain.fields.decisive_rule {
        changes.push(format!(
            "decisive_rule: {:?} -> {:?}",
            prev_env.explain.fields.decisive_rule, curr_env.explain.fields.decisive_rule
        ));
    }

    Ok(Some(
        crate::css_case_delivery_inspector_view::types::DeliveryReplayDeltaView {
            previous_snapshot_id: Some(prev.snapshot_id.clone()),
            current_snapshot_id: Some(curr.snapshot_id.clone()),
            changes,
        },
    ))
}

async fn load_latest_snapshot(
    pool: &sqlx::PgPool,
    subject_key: &str,
) -> anyhow::Result<
    Option<crate::css_case_delivery_signals_snapshot::types::CssCaseDeliverySignalsSnapshotRecord>,
> {
    let snapshots =
        crate::css_case_delivery_signals_snapshot::store_pg::list_signals_snapshots_for_subject(
            pool,
            subject_key,
        )
        .await
        .unwrap_or_default();

    Ok(snapshots.last().cloned())
}

async fn load_active_policy_version(
    pool: &sqlx::PgPool,
) -> anyhow::Result<
    Option<crate::css_case_delivery_policy_versioning::types::DeliveryPolicyVersionRecord>,
> {
    let view = crate::css_case_delivery_policy_versioning::runtime::load_policy_versioning_view(
        pool,
        crate::css_case_delivery_policy_versioning::types::DeliveryPolicyVersioningRequest {},
    )
    .await?;

    Ok(view.active)
}

async fn load_recent_policy_audits(
    pool: &sqlx::PgPool,
    active_policy_version_id: Option<&str>,
) -> anyhow::Result<
    Vec<crate::css_case_delivery_policy_audit::types::CssCaseDeliveryPolicyAuditRecord>,
> {
    crate::css_case_delivery_policy_audit::store_pg::list_policy_audits(
        pool,
        &crate::css_case_delivery_policy_audit::types::DeliveryPolicyAuditQueryRequest {
            action: None,
            policy_version_id: active_policy_version_id.map(|x| x.to_string()),
            policy_id: None,
            actor_user_id: None,
            limit: Some(5),
        },
    )
    .await
}

async fn load_recent_action_logs(
    pool: &sqlx::PgPool,
    subject_key: &str,
) -> anyhow::Result<Vec<crate::css_case_delivery_action_log::types::DeliveryActionLogRecord>> {
    let mut logs =
        crate::css_case_delivery_action_log::store_pg::list_delivery_action_logs_for_subject(
            pool,
            subject_key,
        )
        .await
        .unwrap_or_default();
    logs.truncate(5);
    Ok(logs)
}

fn load_available_actions(
) -> Vec<crate::css_case_delivery_inspector_view::types::DeliveryInspectorActionView> {
    use crate::css_case_delivery_actions_engine::types::DeliveryActionKind;

    [
        DeliveryActionKind::Retry,
        DeliveryActionKind::ForceRefreshSignals,
        DeliveryActionKind::CaptureSnapshot,
        DeliveryActionKind::EscalateOps,
        DeliveryActionKind::RequireManualIntervention,
    ]
    .into_iter()
    .map(
        |kind| crate::css_case_delivery_inspector_view::types::DeliveryInspectorActionView {
            enabled: crate::css_case_delivery_actions_engine::policy::allow_action(&kind),
            kind,
        },
    )
    .collect()
}

pub async fn build_delivery_inspector_view(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_inspector_view::types::DeliveryInspectorRequest,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_inspector_view::types::CssCaseDeliveryInspectorView> {
    let key = subject_key(&req.target, &req.mode);
    let workspace =
        crate::css_case_delivery_workspace::runtime::build_delivery_workspace_from_legacy(
            pool,
            crate::css_case_delivery_workspace::types::DeliveryWorkspaceRequest {
                target: req.target.clone(),
                mode: req.mode.clone(),
                delivered: req.delivered,
                failure_streak: req.failure_streak,
                timeline_limit: Some(8),
            },
            now_rfc3339,
        )
        .await?;

    let cached =
        crate::css_case_delivery_signals_cache::runtime::get_or_build_signals_cache_envelope(
            pool,
            crate::css_case_delivery_signals_cache::types::DeliverySignalsCacheRequest {
                target: req.target.clone(),
                mode: req.mode.clone(),
                delivered: req.delivered,
                failure_streak: req.failure_streak,
                consecutive_failures: Some(req.failure_streak),
                retry_still_failing: req.failure_streak >= 2,
            },
            now_rfc3339,
        )
        .await?;

    let latest_snapshot = load_latest_snapshot(pool, &key).await?;
    let replay_delta = build_replay_delta(pool, &key).await?;
    let active_policy = load_active_policy_version(pool).await?;
    let recent_policy_audits = load_recent_policy_audits(
        pool,
        active_policy
            .as_ref()
            .map(|policy| policy.policy_version_id.as_str()),
    )
    .await
    .unwrap_or_default();
    let recent_action_logs = load_recent_action_logs(pool, &key).await?;
    let available_actions = load_available_actions();

    let decision_trace =
        crate::css_case_delivery_decision_trace::runtime::build_delivery_decision_trace(
            pool,
            crate::css_case_delivery_decision_trace::types::DeliveryDecisionTraceRequest {
                target:
                    crate::css_case_delivery_decision_trace::runtime::api_target_from_log_target(
                        &req.target,
                    ),
                consecutive_failures: req.failure_streak,
                latest_failed: !req.delivered,
                source_target: Some(req.target.clone()),
                source_mode: Some(req.mode.clone()),
                retry_still_failing: req.failure_streak >= 2,
                delivered: Some(req.delivered),
                failure_streak: Some(req.failure_streak),
            },
            now_rfc3339,
        )
        .await?;

    let resolution = crate::css_case_delivery_resolution_engine::runtime::resolve_delivery_state(
        pool,
        crate::css_case_delivery_resolution_engine::types::DeliveryResolutionRequest {
            target: req.target.clone(),
            mode: req.mode.clone(),
            delivered: req.delivered,
            failure_streak: req.failure_streak,
        },
        now_rfc3339,
    )
    .await?;

    let explain_detail = cached.explain;
    let trust_detail = cached.trust;
    let risk_detail = cached.risk;
    let timeline_detail =
        crate::css_case_delivery_timeline_ui_model::runtime::build_delivery_timeline_ui_model_from_legacy(
            pool,
            crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineUiModelRequest {
                target: req.target.clone(),
                mode: req.mode.clone(),
                limit: Some(8),
            },
        )
        .await?;
    let merged_timeline =
        crate::css_case_delivery_timeline_merge::runtime::build_delivery_timeline_merge_from_legacy(
            pool,
            crate::css_case_delivery_timeline_merge::types::DeliveryTimelineMergeRequest {
                target: req.target.clone(),
                mode: req.mode.clone(),
            },
        )
        .await?;
    let timeline_explain =
        crate::css_case_delivery_timeline_explain::runtime::build_delivery_timeline_explain_from_legacy(
            pool,
            crate::css_case_delivery_timeline_explain::types::DeliveryTimelineExplainRequest {
                target: req.target.clone(),
                mode: req.mode.clone(),
            },
        )
        .await?;
    let assurance_detail = cached.assurance;
    let signals = cached.hub;
    let header = crate::css_case_delivery_inspector_view::types::DeliveryInspectorHeader {
        title: format!(
            "交付检查器 · {:?}",
            crate::css_case_delivery_decision_trace::runtime::api_target_from_log_target(
                &req.target
            )
        ),
        subtitle: explain_detail.management_summary.clone(),
    };
    let replay_deltas = replay_delta
        .as_ref()
        .map(|delta| {
            delta.changes
                .iter()
                .filter_map(|change| {
                    let mut parts = change.splitn(2, ':');
                    let field = parts.next()?.trim().to_string();
                    let transition = parts.next()?.trim();
                    let mut values = transition.splitn(2, "->");
                    Some(
                        crate::css_case_delivery_inspector_view::types::DeliveryInspectorReplayDelta {
                            field,
                            before: values.next()?.trim().to_string(),
                            after: values.next()?.trim().to_string(),
                        },
                    )
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Ok(
        crate::css_case_delivery_inspector_view::types::CssCaseDeliveryInspectorView {
            header,
            replay_deltas,
            policy_version_id: decision_trace.policy_version_id.clone(),
            policy_version_label: decision_trace.policy_version_name.clone(),
            explain: explain_detail.clone(),
            subject_key: key,
            workspace,
            signals,
            latest_snapshot,
            replay_delta,
            active_policy,
            recent_policy_audits,
            available_actions,
            recent_action_logs,
            decision_trace,
            resolution,
            explain_detail,
            trust_detail,
            risk_detail,
            timeline_detail,
            merged_timeline,
            timeline_explain,
            assurance_detail,
        },
    )
}
