use sha2::{Digest, Sha256};

fn action_target(
    req: &crate::css_case_delivery_timeline_merge::types::DeliveryTimelineMergeViewRequest,
) -> crate::css_case_delivery_actions_engine::types::DeliveryActionTarget {
    crate::css_case_delivery_actions_engine::types::DeliveryActionTarget {
        target: req.target.clone(),
        consecutive_failures: req.consecutive_failures,
        latest_failed: req.latest_failed,
    }
}

fn action_target_hash(
    target: &crate::css_case_delivery_actions_engine::types::DeliveryActionTarget,
) -> anyhow::Result<String> {
    let s = serde_json::to_string(target)?;
    Ok(format!("{:x}", Sha256::digest(s.as_bytes())))
}

fn merged_state_node(
    idx: usize,
    node: &crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineUiNode,
) -> crate::css_case_delivery_timeline_merge::types::DeliveryTimelineMergedNode {
    let tone = crate::css_case_delivery_timeline_merge::composer::tone_from_timeline_node(node);

    crate::css_case_delivery_timeline_merge::types::DeliveryTimelineMergedNode {
        source: crate::css_case_delivery_timeline_merge::types::DeliveryTimelineMergedSource::Signal,
        merged_kind: crate::css_case_delivery_timeline_merge::types::DeliveryTimelineMergedKind::State,
        title: node.title.clone(),
        body: node.body.clone(),
        created_at: node.created_at.clone().unwrap_or_default(),
        is_pivot: node.is_pivot,
        node_id: format!("merged_signal_{idx}"),
        kind: crate::css_case_delivery_timeline_merge::types::DeliveryMergedTimelineNodeKind::SignalState,
        tone,
        summary: node.summary.clone(),
        timestamp: node.timestamp.clone().unwrap_or_default(),
        badges: node.badges.clone(),
        is_turning_point: node.is_turning_point,
        signal_snapshot_id: None,
        action_log_id: None,
    }
}

fn merged_action_node(
    idx: usize,
    log: &crate::css_case_delivery_action_log::types::CssCaseDeliveryActionLogRecord,
) -> crate::css_case_delivery_timeline_merge::types::DeliveryTimelineMergedNode {
    let title = crate::css_case_delivery_timeline_merge::composer::action_title(&log.action);
    let tone = crate::css_case_delivery_timeline_merge::composer::tone_from_action_log(log);

    crate::css_case_delivery_timeline_merge::types::DeliveryTimelineMergedNode {
        source: crate::css_case_delivery_timeline_merge::types::DeliveryTimelineMergedSource::Action,
        merged_kind: crate::css_case_delivery_timeline_merge::types::DeliveryTimelineMergedKind::Action,
        title: title.clone(),
        body: log.message.clone(),
        created_at: log.created_at.clone(),
        is_pivot: true,
        node_id: format!("merged_action_{idx}"),
        kind: crate::css_case_delivery_timeline_merge::types::DeliveryMergedTimelineNodeKind::Action,
        tone,
        summary: log.result_message.clone(),
        timestamp: log.created_at.clone(),
        badges: vec![
            format!("actor: {}", log.actor_user_id),
            format!("success: {}", log.success),
        ],
        is_turning_point: matches!(
            log.action,
            crate::css_case_delivery_actions_engine::types::DeliveryActionKind::Retry
                | crate::css_case_delivery_actions_engine::types::DeliveryActionKind::EscalateOps
                | crate::css_case_delivery_actions_engine::types::DeliveryActionKind::RequireManualIntervention
        ),
        signal_snapshot_id: log.snapshot_id.clone(),
        action_log_id: Some(log.action_log_id.clone()),
    }
}

async fn load_action_logs(
    pool: &sqlx::PgPool,
    req: &crate::css_case_delivery_timeline_merge::types::DeliveryTimelineMergeViewRequest,
) -> anyhow::Result<Vec<crate::css_case_delivery_action_log::types::CssCaseDeliveryActionLogRecord>>
{
    let target = action_target(req);
    let target_hash = action_target_hash(&target)?;
    crate::css_case_delivery_action_log::store_pg::list_delivery_action_logs_by_target_hash(
        pool,
        &target_hash,
    )
    .await
}

fn merged_summary(node_count: usize) -> String {
    format!("该时间线共包含 {} 个状态/动作节点。", node_count)
}

pub async fn build_delivery_timeline_merge(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_timeline_merge::types::DeliveryTimelineMergeViewRequest,
) -> anyhow::Result<crate::css_case_delivery_timeline_merge::types::CssCaseDeliveryTimelineMerge> {
    let timeline =
        crate::css_case_delivery_timeline_ui_model::runtime::build_delivery_timeline_ui_model(
            pool,
            crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineUiViewRequest {
                target: req.target.clone(),
                consecutive_failures: req.consecutive_failures,
                latest_failed: req.latest_failed,
            },
        )
        .await?;

    let action_logs = load_action_logs(pool, &req).await.unwrap_or_default();

    let mut nodes = Vec::new();
    for (idx, node) in timeline.nodes.iter().enumerate() {
        nodes.push(merged_state_node(idx, node));
    }
    for (idx, log) in action_logs.iter().enumerate() {
        nodes.push(merged_action_node(idx, log));
    }

    nodes.sort_by(|a, b| {
        a.created_at
            .cmp(&b.created_at)
            .then_with(|| a.node_id.cmp(&b.node_id))
    });

    Ok(
        crate::css_case_delivery_timeline_merge::types::CssCaseDeliveryTimelineMerge {
            title: "交付完整时间线".into(),
            summary: merged_summary(nodes.len()),
            subject_key: timeline.subject_key.clone(),
            nodes,
        },
    )
}

pub async fn build_delivery_timeline_merge_from_legacy(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_timeline_merge::types::DeliveryTimelineMergeRequest,
) -> anyhow::Result<crate::css_case_delivery_timeline_merge::types::CssCaseDeliveryTimelineMergeView>
{
    let subject_key =
        crate::css_case_delivery_actions_engine::policy::subject_key(&req.target, &req.mode);

    let timeline =
        crate::css_case_delivery_timeline_ui_model::runtime::build_delivery_timeline_ui_model_from_legacy(
            pool,
            crate::css_case_delivery_timeline_ui_model::types::DeliveryTimelineUiModelRequest {
                target: req.target.clone(),
                mode: req.mode.clone(),
                limit: None,
            },
        )
        .await?;

    let action_logs =
        crate::css_case_delivery_action_log::store_pg::list_delivery_action_logs_for_subject(
            pool,
            &subject_key,
        )
        .await
        .unwrap_or_default();

    let mut nodes = Vec::new();
    for (idx, node) in timeline.nodes.iter().enumerate() {
        nodes.push(merged_state_node(idx, node));
    }
    for (idx, log) in action_logs.iter().enumerate() {
        nodes.push(merged_action_node(idx, log));
    }

    nodes.sort_by(|a, b| {
        a.timestamp
            .cmp(&b.timestamp)
            .then_with(|| a.node_id.cmp(&b.node_id))
    });

    Ok(
        crate::css_case_delivery_timeline_merge::types::CssCaseDeliveryTimelineMergeView {
            title: "交付完整时间线".into(),
            summary: merged_summary(nodes.len()),
            subject_key,
            nodes,
        },
    )
}
